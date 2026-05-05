"""WalkForwardBacktester — Phase 0 out-of-sample validation engine.

Protocol
--------
Train 252d → 21d gap → test 63d, slide by 63d.  ~18-20 iterations on the
2010-2023 history.  Each iteration retrains the HMM, the XGB scorer, and
recalibrates the entropy thresholds, then generates signals on the
previously-unseen 63d test window.

Trade simulation
----------------
Entry at the next day's open after a signal.  Exit:
    1. SL hit first (use day's High/Low to detect)
    2. TP hit first
    3. Timeout at 5 days

A spread+slippage cost is applied to entry and exit.  Each fully-resolved
trade emits a :class:`backtest.metrics.Trade`.

GO/NO-GO criteria (2022-01-01 → 2023-06-30 out-of-sample)
---------------------------------------------------------
* WR ≥ 62%
* Sharpe ≥ 1.10
* Average monthly signals ≥ 4

If all three pass → ``EDGE VALIDATED — PROCEED TO PHASE 1``.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .. import config
from .metrics import (
    Trade,
    average_rr_realized,
    calmar_ratio,
    equity_from_pnl,
    max_drawdown,
    profit_factor,
    sharpe_ratio,
    sortino_ratio,
    win_rate,
)

log = logging.getLogger(__name__)


# ===========================================================================
@dataclass
class IterationResult:
    iteration: int
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    n_signals: int
    n_trades: int
    win_rate: float
    sharpe: float
    pnl_dollars: float
    trades: list[Trade] = field(default_factory=list)


@dataclass
class BacktestReport:
    iterations: list[IterationResult] = field(default_factory=list)
    overall_metrics: dict[str, float] = field(default_factory=dict)
    go_no_go: str = "PENDING"


# ===========================================================================
class WalkForwardBacktester:
    def __init__(
        self,
        signal_factory,                 # callable(train_panel) → callable(market_state) → Optional[Signal]
        train_window: int = config.WALK_FORWARD_TRAIN_DAYS,
        test_window: int = config.WALK_FORWARD_TEST_DAYS,
        gap: int = config.WALK_FORWARD_GAP_DAYS,
        spread_pts: float = config.SPREAD_POINTS,
        slippage_pts: float = config.SLIPPAGE_POINTS,
        risk_per_trade_dollars: float = 1_000.0,
        timeout_days: int = 5,
    ) -> None:
        self.signal_factory = signal_factory
        self.train_window = train_window
        self.test_window = test_window
        self.gap = gap
        self.spread = spread_pts
        self.slippage = slippage_pts
        self.risk_per_trade = risk_per_trade_dollars
        self.timeout_days = timeout_days
        self.report = BacktestReport()

    # ------------------------------------------------------------------
    def _simulate_trade(
        self,
        signal: dict,
        ohlc: pd.DataFrame,
        entry_idx: int,
    ) -> Optional[Trade]:
        if entry_idx >= len(ohlc):
            return None
        entry_price = float(ohlc.iloc[entry_idx]["gold_open"])
        side = 1 if signal["direction"] == "LONG" else -1
        sl = float(signal["stop_loss"])
        tp = float(signal["take_profit"])

        # Effective entry/exit costs
        entry_eff = entry_price + side * (self.spread + self.slippage)
        sl_dist = abs(entry_eff - sl)
        if sl_dist <= 0:
            return None

        for k in range(self.timeout_days):
            if entry_idx + k >= len(ohlc):
                break
            row = ohlc.iloc[entry_idx + k]
            high = float(row["gold_high"])
            low = float(row["gold_low"])
            if side == 1:
                if low <= sl:
                    pnl = (sl - entry_eff) * (self.risk_per_trade / sl_dist)
                    rr = -1.0
                    return Trade(pnl, rr, win=False)
                if high >= tp:
                    pnl = (tp - entry_eff) * (self.risk_per_trade / sl_dist)
                    rr = float((tp - entry_eff) / sl_dist)
                    return Trade(pnl, rr, win=True)
            else:
                if high >= sl:
                    pnl = (entry_eff - sl) * (self.risk_per_trade / sl_dist)
                    return Trade(pnl, -1.0, win=False)
                if low <= tp:
                    pnl = (entry_eff - tp) * (self.risk_per_trade / sl_dist)
                    rr = float((entry_eff - tp) / sl_dist)
                    return Trade(pnl, rr, win=True)
        # Timeout — close at last close
        last = float(ohlc.iloc[min(entry_idx + self.timeout_days - 1, len(ohlc) - 1)]["gold_close"])
        pnl = (last - entry_eff) * side * (self.risk_per_trade / sl_dist)
        rr = pnl / self.risk_per_trade
        return Trade(pnl, rr, win=pnl > 0)

    # ------------------------------------------------------------------
    def run(
        self,
        ohlc: pd.DataFrame,
        oos_start: Optional[pd.Timestamp] = None,
        oos_end: Optional[pd.Timestamp] = None,
    ) -> BacktestReport:
        if "gold_open" not in ohlc.columns:
            raise ValueError("OHLC frame must have gold_open/high/low/close")

        n = len(ohlc)
        i = 0
        iter_id = 0
        results: list[IterationResult] = []

        while i + self.train_window + self.gap + self.test_window <= n:
            tr = ohlc.iloc[i : i + self.train_window]
            te_start = i + self.train_window + self.gap
            te = ohlc.iloc[te_start : te_start + self.test_window]
            if oos_start is not None and te.index[0] < oos_start:
                i += self.test_window
                iter_id += 1
                continue
            if oos_end is not None and te.index[-1] > oos_end:
                break

            # Train signal generator on this window
            try:
                evaluator = self.signal_factory(tr)
            except Exception as exc:
                log.error("signal_factory failed iter %d: %s", iter_id, exc)
                i += self.test_window
                iter_id += 1
                continue

            trades: list[Trade] = []
            n_signals = 0
            for j in range(len(te) - 1):
                row_idx = te.index[j]
                try:
                    signal = evaluator(row_idx)
                except Exception:
                    signal = None
                if signal is None:
                    continue
                n_signals += 1
                global_entry = ohlc.index.get_loc(te.index[j + 1])
                tr_obj = self._simulate_trade(signal, ohlc, global_entry)
                if tr_obj is not None:
                    tr_obj.signal_class = signal.get("signal_class", "?")
                    tr_obj.regime = signal.get("regime", 0)
                    tr_obj.timestamp = signal.get("timestamp", row_idx)
                    tr_obj.c_window = signal.get("c_window", "")
                    trades.append(tr_obj)

            wr = win_rate(trades)
            rets = [t.pnl_dollars / self.risk_per_trade for t in trades]
            sh = sharpe_ratio(rets)
            pnl = float(sum(t.pnl_dollars for t in trades))
            results.append(
                IterationResult(
                    iteration=iter_id,
                    train_start=tr.index[0],
                    train_end=tr.index[-1],
                    test_start=te.index[0],
                    test_end=te.index[-1],
                    n_signals=n_signals,
                    n_trades=len(trades),
                    win_rate=wr,
                    sharpe=sh,
                    pnl_dollars=pnl,
                    trades=trades,
                )
            )
            print(f"  iter {iter_id:2d} | {te.index[0].date()}→{te.index[-1].date()} "
                  f"| signals={n_signals:3d} trades={len(trades):3d} "
                  f"WR={wr:.2%} Sharpe={sh:+.2f} PnL=${pnl:+,.0f}")
            i += self.test_window
            iter_id += 1

        self.report.iterations = results
        self.report.overall_metrics = self._aggregate(results)
        self.report.go_no_go = self._verdict(self.report.overall_metrics)
        return self.report

    # ------------------------------------------------------------------
    def _aggregate(self, iters: Sequence[IterationResult]) -> dict[str, float]:
        all_trades: list[Trade] = []
        for it in iters:
            all_trades.extend(it.trades)
        if not all_trades:
            return {"win_rate": 0.0, "sharpe": 0.0, "monthly_signals": 0.0}
        rets = [t.pnl_dollars / self.risk_per_trade for t in all_trades]
        eq = equity_from_pnl(100_000.0, all_trades).values
        n_months = max(1.0, sum(it.n_signals for it in iters) and (
            (iters[-1].test_end - iters[0].test_start).days / 30.4) or 1.0)
        result: dict[str, float] = {
            "win_rate": win_rate(all_trades),
            "sharpe": sharpe_ratio(rets),
            "sortino": sortino_ratio(rets),
            "max_drawdown": max_drawdown(eq),
            "calmar": calmar_ratio(rets, eq),
            "profit_factor": profit_factor(all_trades),
            "average_rr": average_rr_realized(all_trades),
            "n_trades": float(len(all_trades)),
            "n_signals": float(sum(it.n_signals for it in iters)),
            "monthly_signals": float(sum(it.n_signals for it in iters) / n_months),
        }
        for cls in ("A", "B", "C"):
            cls_trades = [t for t in all_trades if t.signal_class == cls]
            if cls_trades:
                cls_rets = [t.pnl_dollars / self.risk_per_trade for t in cls_trades]
                result[f"wr_class_{cls}"] = win_rate(cls_trades)
                result[f"n_class_{cls}"] = float(len(cls_trades))
                result[f"sharpe_class_{cls}"] = sharpe_ratio(cls_rets) if len(cls_trades) >= 5 else float("nan")
        return result

    # ------------------------------------------------------------------
    @staticmethod
    def _verdict(m: dict[str, float]) -> str:
        wr_ok = m.get("win_rate", 0) >= config.MIN_WIN_RATE
        sh_ok = m.get("sharpe", 0) >= config.MIN_SHARPE
        sig_ok = m.get("monthly_signals", 0) >= config.MIN_MONTHLY_SIGNALS
        if wr_ok and sh_ok and sig_ok:
            return "EDGE VALIDATED — PROCEED TO PHASE 1"
        diag = []
        if not wr_ok:
            diag.append(f"WR {m.get('win_rate',0):.1%} < {config.MIN_WIN_RATE:.0%}")
        if not sh_ok:
            diag.append(f"Sharpe {m.get('sharpe',0):.2f} < {config.MIN_SHARPE}")
        if not sig_ok:
            diag.append(f"signals/mo {m.get('monthly_signals',0):.1f} < {config.MIN_MONTHLY_SIGNALS}")
        return "FAILED — " + "; ".join(diag)

    # ------------------------------------------------------------------
    def get_performance_by_period(self) -> pd.DataFrame:
        rows = []
        for it in self.report.iterations:
            rows.append({
                "iter": it.iteration,
                "test_start": it.test_start,
                "test_end": it.test_end,
                "signals": it.n_signals,
                "trades": it.n_trades,
                "win_rate": it.win_rate,
                "sharpe": it.sharpe,
                "pnl": it.pnl_dollars,
            })
        return pd.DataFrame(rows)

    def get_overall_metrics(self) -> dict[str, float]:
        return dict(self.report.overall_metrics)

    # ------------------------------------------------------------------
    def print_report(self) -> None:
        print("\n[WalkForward] aggregate metrics")
        skip = {f"wr_class_{c}" for c in "ABC"} | {f"n_class_{c}" for c in "ABC"}
        for k, v in self.report.overall_metrics.items():
            if k in skip:
                continue
            print(f"  {k:<18s} {v:+.4f}" if isinstance(v, float) else f"  {k:<18s} {v}")
        m = self.report.overall_metrics
        n_months = max(1.0, m.get("n_signals", 0) and (
            (self.report.iterations[-1].test_end - self.report.iterations[0].test_start).days / 30.4
            if self.report.iterations else 1.0) or 1.0)
        cls_lines = []
        for cls in ("A", "B", "C"):
            n = int(m.get(f"n_class_{cls}", 0))
            if n == 0:
                continue
            wr  = m.get(f"wr_class_{cls}", float("nan"))
            sh  = m.get(f"sharpe_class_{cls}", float("nan"))
            spm = n / n_months
            wr_s  = f"{wr:.1%}" if not np.isnan(wr) else "  n/a"
            sh_s  = f"{sh:+.2f}" if not np.isnan(sh) else "  n/a"
            cls_lines.append(f"  Class {cls}: n={n:>3d}  WR={wr_s}  Sharpe={sh_s}  sigs/mo={spm:.1f}")
        if cls_lines:
            print("[WalkForward] per-class breakdown")
            for line in cls_lines:
                print(line)
        print(f"\n[WalkForward] verdict: {self.report.go_no_go}")

    def plot_equity_curve(self, out_path: Path | None = None) -> Path:
        out_path = out_path or (config.PLOTS_DIR / "wf_equity.png")
        all_trades: list[Trade] = []
        for it in self.report.iterations:
            all_trades.extend(it.trades)
        eq = equity_from_pnl(100_000.0, all_trades)
        fig, ax = plt.subplots(figsize=(14, 5))
        ax.plot(eq.values, lw=1.0, color="#1f77b4")
        ax.set_title("Walk-forward equity curve (100k seed)")
        ax.set_xlabel("trade #")
        ax.set_ylabel("equity ($)")
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path
