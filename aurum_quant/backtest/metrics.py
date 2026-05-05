"""Performance metrics implemented from scratch (no external backtest libs).

All ratios are annualised assuming 252 trading days unless stated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional, Sequence

import numpy as np
import pandas as pd


# ===========================================================================
@dataclass
class Trade:
    pnl_dollars: float
    rr_realized: float
    win: bool
    signal_class: str = "?"
    regime: int = 0
    timestamp: Optional[pd.Timestamp] = None
    c_window: str = ""


def _arr(returns: Iterable[float]) -> np.ndarray:
    a = np.asarray(list(returns), dtype=float)
    return a[np.isfinite(a)]


# ---------------------------------------------------------------------------
def win_rate(trades: Sequence[Trade]) -> float:
    if not trades:
        return 0.0
    return float(sum(1 for t in trades if t.win) / len(trades))


def sharpe_ratio(returns: Iterable[float], rf: float = 0.0, periods: int = 252) -> float:
    a = _arr(returns)
    if len(a) < 2:
        return 0.0
    excess = a - rf / periods
    std = float(np.std(excess, ddof=1))
    if std <= 0:
        return 0.0
    return float(np.sqrt(periods) * np.mean(excess) / std)


def sortino_ratio(returns: Iterable[float], rf: float = 0.0, periods: int = 252) -> float:
    a = _arr(returns)
    if len(a) < 2:
        return 0.0
    excess = a - rf / periods
    downside = excess[excess < 0]
    if len(downside) == 0:
        return float("inf")
    dd = float(np.std(downside, ddof=1))
    if dd <= 0:
        return 0.0
    return float(np.sqrt(periods) * np.mean(excess) / dd)


def max_drawdown(equity_curve: Iterable[float]) -> float:
    a = np.asarray(list(equity_curve), dtype=float)
    if len(a) == 0:
        return 0.0
    peak = np.maximum.accumulate(a)
    dd = (a - peak) / peak
    return float(dd.min())


def calmar_ratio(returns: Iterable[float], equity_curve: Iterable[float], periods: int = 252) -> float:
    a = _arr(returns)
    if len(a) == 0:
        return 0.0
    annual_ret = float(np.mean(a) * periods)
    mdd = abs(max_drawdown(equity_curve))
    if mdd <= 0:
        return float("inf")
    return float(annual_ret / mdd)


def profit_factor(trades: Sequence[Trade]) -> float:
    gp = sum(t.pnl_dollars for t in trades if t.pnl_dollars > 0)
    gl = sum(-t.pnl_dollars for t in trades if t.pnl_dollars < 0)
    if gl <= 0:
        return float("inf") if gp > 0 else 0.0
    return float(gp / gl)


def average_rr_realized(trades: Sequence[Trade]) -> float:
    if not trades:
        return 0.0
    return float(np.mean([t.rr_realized for t in trades]))


def expectancy(trades: Sequence[Trade]) -> float:
    """Average PnL per trade in R-multiples (RR units)."""
    if not trades:
        return 0.0
    return float(np.mean([t.rr_realized if t.win else -1.0 for t in trades]))


def expected_shortfall(returns: Iterable[float], confidence: float = 0.95) -> float:
    a = _arr(returns)
    if len(a) == 0:
        return 0.0
    cutoff = float(np.percentile(a, (1.0 - confidence) * 100))
    tail = a[a <= cutoff]
    if tail.size == 0:
        return cutoff
    return float(tail.mean())


def crps(simulated_paths: np.ndarray, realized_prices: np.ndarray) -> float:
    """Continuous Ranked Probability Score (Hersbach 2000).

    Empirical CDF approximation:
        CRPS(F, y) ≈ E|X − y| − ½ E|X − X'|.
    """
    sims = np.asarray(simulated_paths, dtype=float)
    real = np.asarray(realized_prices, dtype=float)
    if sims.ndim == 1:
        sims = sims[None, :]
    if sims.shape[1] != len(real):
        L = min(sims.shape[1], len(real))
        sims = sims[:, :L]
        real = real[:L]
    if sims.size == 0:
        return float("nan")
    n = sims.shape[0]
    # E|X − y| per timestep
    diff_y = float(np.mean(np.abs(sims - real[None, :])))
    # E|X − X'|, take a stratified sample for cost
    sample = min(n, 200)
    idx = np.random.default_rng(0).choice(n, size=sample, replace=False)
    s = sims[idx]
    diff_xx = float(np.mean(np.abs(s[:, None, :] - s[None, :, :])))
    return diff_y - 0.5 * diff_xx


# ---------------------------------------------------------------------------
def equity_from_pnl(initial: float, trades: Sequence[Trade]) -> pd.Series:
    equity = [initial]
    for t in trades:
        equity.append(equity[-1] + t.pnl_dollars)
    return pd.Series(equity, name="equity")
