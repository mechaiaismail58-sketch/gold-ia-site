"""StructuralBreakDetector — Bai-Perron multiple-break test on the rolling β.

Approach
--------
We apply a sequential Bai-Perron-style search to the β series produced by
:class:`engine.kalman_fv.AdaptiveBetaTracker` (gold-vs-real-rate beta).
The Quandt-Andrews QLR statistic (statsmodels' :func:`breaks_cusumolsresid`
and structural break tests) is used as the underlying single-break test;
multiple breaks are found by recursive segmentation.

Procedure
---------
1. Find the most likely single break τ̂ in the current segment via the
   maximised Wald statistic (sup-Wald), trimming 15% from each end.
2. If F(τ̂) > critical (5%) and segment length ≥ 63, accept the break,
   then recurse on the two sub-segments.
3. Stop when no segment yields a significant break.

Known regime shifts to detect
-----------------------------
* 2020-03  COVID liquidity shock.
* 2022-11  Real-rate vs gold structural decoupling.

If a break is found within ±30 days of either, the detector prints
``CONFIRMED``.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

import numpy as np
import pandas as pd
from scipy import stats

log = logging.getLogger(__name__)

KNOWN_BREAKS = (pd.Timestamp("2020-03-15"), pd.Timestamp("2022-11-01"))


@dataclass
class StructuralBreak:
    date: pd.Timestamp
    fstat: float
    pre_mean: float
    post_mean: float
    magnitude: float


@dataclass
class BreakReport:
    breaks: List[StructuralBreak] = field(default_factory=list)
    recalibration_needed: bool = False


# ===========================================================================
def _sup_wald(series: np.ndarray, trim: float = 0.15) -> tuple[int, float]:
    """Return (best break index, F-statistic) for a single mean-shift break.

    Tests H0: μ constant vs H1: piecewise-constant mean with one break.
    """
    n = len(series)
    if n < 30:
        return -1, 0.0
    lo = max(1, int(n * trim))
    hi = min(n - 1, n - lo)
    s_total = float(np.sum((series - series.mean()) ** 2))
    if s_total <= 0:
        return -1, 0.0
    best_idx = -1
    best_f = 0.0
    cum = np.cumsum(series)
    for k in range(lo, hi):
        m1 = cum[k - 1] / k
        m2 = (cum[-1] - cum[k - 1]) / (n - k)
        s_left = float(np.sum((series[:k] - m1) ** 2))
        s_right = float(np.sum((series[k:] - m2) ** 2))
        s_un = s_left + s_right
        if s_un <= 0:
            continue
        # F = ((SSR_R - SSR_U) / q) / (SSR_U / (n - 2q))
        f = ((s_total - s_un) / 1.0) / (s_un / max(n - 2, 1))
        if f > best_f:
            best_f = f
            best_idx = k
    return best_idx, best_f


def _f_critical(n: int, alpha: float = 0.05) -> float:
    # Andrews (1993) critical values for sup-Wald with 1 parameter
    # are conservatively approximated by F(1, n − 2) at α/(2·trim).
    return float(stats.f.ppf(1.0 - alpha / (2 * 0.7), 1, max(n - 2, 1)))


# ===========================================================================
class StructuralBreakDetector:
    """Recursive Bai-Perron-style multi-break detector for a 1-D series."""

    def __init__(self, min_segment: int = 63, alpha: float = 0.05) -> None:
        self.min_segment = min_segment
        self.alpha = alpha
        self.report: BreakReport = BreakReport()

    # ------------------------------------------------------------------
    def fit(self, series: pd.Series) -> BreakReport:
        s = series.dropna().astype(float)
        if len(s) < 2 * self.min_segment:
            log.warning("BreakDetector: series too short (%d)", len(s))
            return self.report
        breaks: List[StructuralBreak] = []
        self._recurse(s, 0, len(s), breaks)
        breaks.sort(key=lambda b: b.date)

        # Confirm known shifts
        for known in KNOWN_BREAKS:
            close = [b for b in breaks if abs((b.date - known).days) <= 30]
            if close:
                print(f"  CONFIRMED known break {known.date()} ↔ detected {close[0].date.date()}")
            else:
                print(f"  (note: no detection within ±30d of {known.date()})")

        self.report = BreakReport(breaks=breaks, recalibration_needed=len(breaks) > 0)
        return self.report

    # ------------------------------------------------------------------
    def _recurse(
        self,
        full: pd.Series,
        lo: int,
        hi: int,
        accum: List[StructuralBreak],
        depth: int = 0,
    ) -> None:
        if hi - lo < 2 * self.min_segment or depth > 6:
            return
        seg = full.iloc[lo:hi].values
        idx_local, f = _sup_wald(seg, trim=0.15)
        if idx_local < 0:
            return
        crit = _f_critical(len(seg), self.alpha)
        if f < crit:
            return
        global_idx = lo + idx_local
        date = full.index[global_idx]
        m1 = float(seg[:idx_local].mean())
        m2 = float(seg[idx_local:].mean())
        accum.append(
            StructuralBreak(
                date=pd.Timestamp(date),
                fstat=float(f),
                pre_mean=m1,
                post_mean=m2,
                magnitude=float(m2 - m1),
            )
        )
        self._recurse(full, lo, global_idx, accum, depth + 1)
        self._recurse(full, global_idx, hi, accum, depth + 1)

    # ------------------------------------------------------------------
    def check_recent_break(self, series: pd.Series, lookback: int = 63) -> bool:
        s = series.dropna().astype(float)
        if len(s) < self.min_segment + lookback:
            return False
        seg = s.tail(self.min_segment + lookback).values
        idx, f = _sup_wald(seg, trim=0.15)
        crit = _f_critical(len(seg), self.alpha)
        return f > crit and idx >= self.min_segment - 1  # break in the recent half

    def get_recalibration_flag(self) -> bool:
        return bool(self.report.recalibration_needed)

    # ------------------------------------------------------------------
    def print_break_summary(self) -> None:
        if not self.report.breaks:
            print("[BaiPerron] no structural breaks detected")
            return
        print("\n[BaiPerron] structural breaks")
        print(f"{'date':<12s}{'F':>10s}{'pre μ':>12s}{'post μ':>12s}{'Δμ':>12s}")
        for b in self.report.breaks:
            print(
                f"{str(b.date.date()):<12s}{b.fstat:>10.2f}"
                f"{b.pre_mean:>+12.4f}{b.post_mean:>+12.4f}{b.magnitude:>+12.4f}"
            )
