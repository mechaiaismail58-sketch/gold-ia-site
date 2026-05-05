"""MultiEngineAllocator — combines VolumeEngine and MeanReversionSniper signals.

Responsibilities:
  - Track capital allocation and open exposure per engine
  - Reject signals that would breach correlation or concentration limits
  - Enforce daily stop (-2%) and weekly stop (-4%) circuit breakers
  - Expose a combined backtest runner and Monte Carlo P(challenge pass) estimator

Challenge pass definition (FTMO-style defaults):
  - Profit target   : +10% of initial balance
  - Max daily DD    : -2%
  - Max overall DD  : -5% (conservative for prop-firm challenge phase)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from .engines.volume_engine import EngineSignal

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
@dataclass
class AllocationState:
    initial_balance: float = 100_000.0
    current_balance: float = 100_000.0
    peak_balance: float = 100_000.0
    day_open_balance: float = 100_000.0
    week_open_balance: float = 100_000.0
    current_day: Optional[pd.Timestamp] = None
    current_week: Optional[int] = None       # ISO week number
    daily_stopped: bool = False
    weekly_stopped: bool = False
    exposure_per_engine: dict = field(default_factory=dict)   # engine → open risk $

    @property
    def total_dd_pct(self) -> float:
        return (self.current_balance - self.peak_balance) / self.peak_balance

    @property
    def daily_dd_pct(self) -> float:
        return (self.current_balance - self.day_open_balance) / self.day_open_balance

    @property
    def weekly_dd_pct(self) -> float:
        return (self.current_balance - self.week_open_balance) / self.week_open_balance

    @property
    def profit_pct(self) -> float:
        return (self.current_balance - self.initial_balance) / self.initial_balance


@dataclass
class AllocatorConfig:
    daily_stop: float = 0.02       # -2% daily DD → halt
    weekly_stop: float = 0.04      # -4% weekly DD → halt
    max_corr_cap: float = 0.50     # reject if two engines have same direction open
    max_engine_risk_pct: float = 0.03  # max open risk per engine (% of balance)
    challenge_profit_target: float = 0.10   # +10% for challenge pass
    challenge_max_dd: float = 0.05          # -5% overall DD limit (challenge)


# ---------------------------------------------------------------------------
class MultiEngineAllocator:
    """Combines signals from multiple engines with risk budgeting.

    Usage
    -----
    allocator = MultiEngineAllocator(engines=[vol_engine, mrs_engine])
    signals = allocator.run_day(timestamp)   # returns accepted EngineSignals
    allocator.record_outcome(signal, pnl)    # update balance / exposure
    """

    def __init__(
        self,
        engines: list,
        cfg: Optional[AllocatorConfig] = None,
        initial_balance: float = 100_000.0,
    ) -> None:
        self.engines = engines
        self.cfg = cfg or AllocatorConfig()
        self.state = AllocationState(
            initial_balance=initial_balance,
            current_balance=initial_balance,
            peak_balance=initial_balance,
            day_open_balance=initial_balance,
            week_open_balance=initial_balance,
        )
        self._open_signals: dict[str, EngineSignal] = {}   # engine → open signal

    # ------------------------------------------------------------------
    def _refresh_period(self, ts: pd.Timestamp) -> None:
        """Reset daily/weekly stop trackers at period boundaries."""
        day = ts.normalize()
        week = ts.isocalendar().week

        if self.state.current_day != day:
            self.state.day_open_balance = self.state.current_balance
            self.state.daily_stopped = False
            self.state.current_day = day

        if self.state.current_week != week:
            self.state.week_open_balance = self.state.current_balance
            self.state.weekly_stopped = False
            self.state.current_week = week

    def _circuit_breaker(self) -> bool:
        """Return True (blocked) if daily or weekly stop is hit."""
        if self.state.daily_dd_pct <= -self.cfg.daily_stop:
            self.state.daily_stopped = True
        if self.state.weekly_dd_pct <= -self.cfg.weekly_stop:
            self.state.weekly_stopped = True
        return self.state.daily_stopped or self.state.weekly_stopped

    def _correlation_ok(self, sig: EngineSignal) -> bool:
        """Reject if another engine already holds the opposite direction at same time."""
        for open_sig in self._open_signals.values():
            if open_sig.engine == sig.engine:
                continue
            if open_sig.direction != sig.direction:
                # Opposite directions simultaneously → correlation hedge, allow
                pass
            # Same direction from two engines: check combined risk
            combined = (
                self.state.exposure_per_engine.get(open_sig.engine, 0)
                + sig.risk_fraction * self.state.current_balance
            )
            if combined / self.state.current_balance > self.cfg.max_corr_cap:
                return False
        return True

    def _engine_budget_ok(self, sig: EngineSignal) -> bool:
        """Reject if engine already has too much open risk."""
        current_risk = self.state.exposure_per_engine.get(sig.engine, 0.0)
        new_risk = sig.risk_fraction * self.state.current_balance
        return (current_risk + new_risk) / self.state.current_balance <= self.cfg.max_engine_risk_pct

    # ------------------------------------------------------------------
    def run_day(self, timestamp: pd.Timestamp) -> list[EngineSignal]:
        """Collect and filter signals from all engines for one timestamp."""
        self._refresh_period(timestamp)
        if self._circuit_breaker():
            return []

        candidates: list[EngineSignal] = []
        for engine in self.engines:
            sig = engine.generate(timestamp)
            if sig is not None:
                candidates.append(sig)

        accepted: list[EngineSignal] = []
        for sig in candidates:
            if not self._correlation_ok(sig):
                log.debug("%s rejected: correlation cap", sig.engine)
                continue
            if not self._engine_budget_ok(sig):
                log.debug("%s rejected: engine budget", sig.engine)
                continue
            risk_dollars = sig.risk_fraction * self.state.current_balance
            self._open_signals[sig.engine] = sig
            self.state.exposure_per_engine[sig.engine] = (
                self.state.exposure_per_engine.get(sig.engine, 0.0) + risk_dollars
            )
            accepted.append(sig)

        return accepted

    # ------------------------------------------------------------------
    def record_outcome(self, sig: EngineSignal, pnl_dollars: float) -> None:
        """Update account state after a trade closes."""
        self.state.current_balance += pnl_dollars
        self.state.peak_balance = max(self.state.peak_balance, self.state.current_balance)
        # Clear open exposure for this engine
        risk = sig.risk_fraction * self.state.current_balance
        prev = self.state.exposure_per_engine.get(sig.engine, 0.0)
        self.state.exposure_per_engine[sig.engine] = max(0.0, prev - risk)
        if sig.engine in self._open_signals:
            del self._open_signals[sig.engine]


# ---------------------------------------------------------------------------
def run_multi_engine_backtest(
    allocator: MultiEngineAllocator,
    ohlc: pd.DataFrame,
    oos_start: pd.Timestamp,
    oos_end: pd.Timestamp,
) -> dict:
    """Simulate all engines over the OOS period using daily close prices.

    Returns a metrics dict with per-engine and combined statistics.
    """
    from ..backtest.metrics import Trade

    idx = ohlc.loc[oos_start:oos_end].index
    all_trades_by_engine: dict[str, list] = {}
    combined_pnl: list[float] = []

    for ts in idx:
        price = float(ohlc.loc[ts, "gold_close"])
        signals = allocator.run_day(ts)

        for sig in signals:
            engine = sig.engine
            # Simulate: next-bar outcome (simplified — same daily-bar logic as walk_forward)
            # Entry = close, check TP/SL over next 63 bars
            sl_dist = abs(sig.entry_price - sig.stop_loss)
            tp_dist = abs(sig.take_profit - sig.entry_price)
            if sl_dist < 1e-6:
                continue
            rr_target = tp_dist / sl_dist
            risk_dollars = sig.risk_fraction * allocator.state.current_balance

            # Simulate forward
            future = ohlc.loc[ts:].iloc[1:64]
            outcome = "timeout"
            rr_realized = -0.3   # timeout default
            for _, row in future.iterrows():
                hi = float(row["gold_high"])
                lo = float(row["gold_low"])
                if sig.direction == "LONG":
                    if lo <= sig.stop_loss:
                        outcome = "SL"
                        rr_realized = -1.0
                        break
                    if hi >= sig.take_profit:
                        outcome = "TP"
                        rr_realized = rr_target
                        break
                else:
                    if hi >= sig.stop_loss:
                        outcome = "SL"
                        rr_realized = -1.0
                        break
                    if lo <= sig.take_profit:
                        outcome = "TP"
                        rr_realized = rr_target
                        break

            pnl = rr_realized * risk_dollars
            trade = {
                "engine": engine,
                "timestamp": ts,
                "direction": sig.direction,
                "regime": sig.regime,
                "signal_class": sig.signal_class,
                "win": outcome == "TP",
                "pnl": pnl,
                "rr": rr_realized,
            }
            all_trades_by_engine.setdefault(engine, []).append(trade)
            combined_pnl.append(pnl)
            allocator.record_outcome(sig, pnl)

    metrics = _compute_metrics(all_trades_by_engine, combined_pnl, oos_start, oos_end)
    metrics["_raw_trades"] = all_trades_by_engine
    return metrics


def _compute_metrics(
    trades_by_engine: dict,
    combined_pnl: list,
    oos_start: pd.Timestamp,
    oos_end: pd.Timestamp,
) -> dict:
    months = max(1, (oos_end - oos_start).days / 30.44)
    result: dict = {"by_engine": {}, "combined": {}}

    for engine, trades in trades_by_engine.items():
        n = len(trades)
        if n == 0:
            continue
        wins = sum(t["win"] for t in trades)
        rrs = np.array([t["rr"] for t in trades])
        pnls = np.array([t["pnl"] for t in trades])
        sharpe = float(rrs.mean() / (rrs.std() + 1e-9) * np.sqrt(252)) if n > 1 else float("nan")
        cum_pnl = float(pnls.sum())
        cum_ret = np.cumsum(pnls)
        rolling_max = np.maximum.accumulate(cum_ret)
        drawdowns = cum_ret - rolling_max
        max_dd = float(drawdowns.min()) if len(drawdowns) > 0 else 0.0
        result["by_engine"][engine] = {
            "n": n,
            "wr": wins / n,
            "sharpe": sharpe,
            "pnl": cum_pnl,
            "max_dd": max_dd,
            "sigs_mo": n / months,
        }

    if combined_pnl:
        pnls = np.array(combined_pnl)
        rrs_all = pnls / 1000.0   # normalise by $1k risk unit
        cum = np.cumsum(pnls)
        rolling_max = np.maximum.accumulate(np.maximum(cum, 0))
        dd = cum - rolling_max
        result["combined"] = {
            "n": len(pnls),
            "pnl": float(pnls.sum()),
            "sharpe": float(rrs_all.mean() / (rrs_all.std() + 1e-9) * np.sqrt(252)) if len(pnls) > 1 else float("nan"),
            "max_dd": float(dd.min()),
        }

    return result


# ---------------------------------------------------------------------------
def monte_carlo_challenge_pass(
    trades: list[dict],
    n_sims: int = 10_000,
    initial_balance: float = 100_000.0,
    profit_target_pct: float = 0.10,
    max_dd_pct: float = 0.05,
    challenge_days: int = 30,
    seed: int = 42,
) -> float:
    """Estimate P(challenge pass) by bootstrap-resampling the trade sequence.

    A challenge is "passed" if, after *challenge_days* of trading, the account
    has reached *profit_target_pct* gain without ever breaching *max_dd_pct*.

    Returns the fraction of simulations that pass.
    """
    if not trades:
        return 0.0
    rng = np.random.default_rng(seed)
    pnls = np.array([t["pnl"] for t in trades])
    n_pass = 0
    # Estimate trades per day from historical data
    if "timestamp" in trades[0]:
        dates = pd.to_datetime([t["timestamp"] for t in trades])
        active_days = max(1, (dates.max() - dates.min()).days)
        trades_per_day = len(trades) / max(1, active_days)
    else:
        trades_per_day = 0.5
    n_trades_sim = max(1, round(trades_per_day * challenge_days))

    for _ in range(n_sims):
        sampled = rng.choice(pnls, size=n_trades_sim, replace=True)
        bal = initial_balance
        peak = initial_balance
        passed = False
        breached = False
        for pnl in sampled:
            bal += pnl
            peak = max(peak, bal)
            if (peak - bal) / initial_balance >= max_dd_pct:
                breached = True
                break
            if (bal - initial_balance) / initial_balance >= profit_target_pct:
                passed = True
                break
        if passed and not breached:
            n_pass += 1

    return n_pass / n_sims
