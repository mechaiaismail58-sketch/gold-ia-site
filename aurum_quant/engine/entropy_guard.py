"""DualEntropyGuard — Approximate Entropy + Wasserstein-2 distance.

Approximate Entropy (Pincus 1991)
---------------------------------
For series x_1..x_N, embedding dim m, tolerance r:

    C_i^m(r) = (# j : max_{0≤k<m} |x_{i+k} − x_{j+k}| ≤ r) / (N − m + 1)
    Φ^m(r)   = (N − m + 1)^{-1}  Σ_i  log C_i^m(r)
    ApEn(m, r, N) = Φ^m(r) − Φ^{m+1}(r).

Defaults: m = 2, r = 0.2 · σ, N = 50 (rolling).  Higher ApEn ⇒ more
randomness; signals are suppressed when ApEn > 0.90.

Wasserstein-2 distance
----------------------
Per regime we cache a reference distribution (training-period returns).
For each timestep we compute  W₁  between the last 20 returns and the
reference (1-D Earth Mover's Distance, ``scipy.stats.wasserstein_distance``).
The threshold is the 90th percentile of W per regime on training data.

Combined guard
--------------
    Guard(t)  =  𝟙{ApEn(t) < 0.90}  ·  max(0, 1 − W(t)/W_thresh).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import wasserstein_distance

from .. import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Approximate entropy — vectorised window evaluator
# ---------------------------------------------------------------------------
def approximate_entropy(window: np.ndarray, m: int = 2, r: Optional[float] = None) -> float:
    """ApEn for a single window."""
    N = len(window)
    if N < m + 2:
        return float("nan")
    if r is None:
        r = 0.2 * float(np.std(window, ddof=1))
    if r <= 0:
        return float("nan")

    def phi(emb: int) -> float:
        # Build embedding matrix (N - emb + 1, emb)
        rows = N - emb + 1
        if rows <= 0:
            return 0.0
        mat = np.lib.stride_tricks.sliding_window_view(window, emb)
        # Chebyshev distance pairwise
        diffs = np.abs(mat[:, None, :] - mat[None, :, :]).max(axis=-1)
        counts = (diffs <= r).sum(axis=1) / rows
        counts = np.clip(counts, 1e-12, None)
        return float(np.mean(np.log(counts)))

    return float(phi(m) - phi(m + 1))


def rolling_apen(returns: pd.Series, m: int, window: int) -> pd.Series:
    """Rolling ApEn series.  Slow but bounded — N=50 keeps it manageable."""
    arr = returns.to_numpy(dtype=float)
    out = np.full(len(arr), np.nan)
    for i in range(window - 1, len(arr)):
        w = arr[i - window + 1 : i + 1]
        if np.isnan(w).any():
            continue
        out[i] = approximate_entropy(w, m=m, r=0.2 * float(np.std(w, ddof=1) or 0.0))
    return pd.Series(out, index=returns.index, name="apen")


# ---------------------------------------------------------------------------
@dataclass
class GuardCalibration:
    apen_threshold: float
    w2_threshold_per_regime: dict[int, float] = field(default_factory=dict)
    reference_per_regime: dict[int, np.ndarray] = field(default_factory=dict)
    apen_history: Optional[pd.Series] = None
    w2_history: Optional[pd.Series] = None
    guard_history: Optional[pd.Series] = None


class DualEntropyGuard:
    """Combined ApEn + W2 confidence multiplier."""

    def __init__(
        self,
        m: int = config.APEN_M,
        window: int = config.APEN_N,
        apen_suppress: float = config.APEN_THRESHOLD_SUPPRESS,
        w2_percentile: float = config.W2_PERCENTILE,
        ref_window: int = 20,
    ) -> None:
        self.m = m
        self.window = window
        self.apen_suppress = apen_suppress
        self.w2_percentile = w2_percentile
        self.ref_window = ref_window
        self.calibration: Optional[GuardCalibration] = None

    # ------------------------------------------------------------------
    def fit(self, returns: pd.Series, regime_sequence: pd.Series) -> GuardCalibration:
        returns = returns.dropna().astype(float)
        regimes = regime_sequence.reindex(returns.index).ffill().bfill().astype(int)

        # Reference distribution per regime: empirical training returns.
        ref: dict[int, np.ndarray] = {}
        for label in (1, 2, 3, 4):
            mask = (regimes == label).values
            sub = returns.values[mask]
            sub = sub[np.isfinite(sub)]
            ref[label] = sub if sub.size >= 20 else returns.dropna().values

        # ApEn rolling
        apen = rolling_apen(returns, m=self.m, window=self.window)

        # W2 rolling against current regime's reference
        w2 = pd.Series(np.nan, index=returns.index)
        rets_arr = returns.values
        for i in range(self.ref_window - 1, len(returns)):
            recent = rets_arr[i - self.ref_window + 1 : i + 1]
            if np.isnan(recent).any():
                continue
            r_label = int(regimes.iloc[i])
            ref_dist = ref.get(r_label, returns.dropna().values)
            w2.iat[i] = wasserstein_distance(recent, ref_dist)

        # Per-regime W2 thresholds at 90th percentile
        w2_thresh: dict[int, float] = {}
        for label in (1, 2, 3, 4):
            mask = (regimes == label) & w2.notna()
            if mask.sum() >= 20:
                w2_thresh[label] = float(np.percentile(w2[mask].values, self.w2_percentile))
            else:
                w2_thresh[label] = float(np.nanpercentile(w2.values, self.w2_percentile))

        # Combined guard
        guard = pd.Series(0.0, index=returns.index)
        for i in range(len(returns)):
            ap = apen.iloc[i]
            w = w2.iloc[i]
            if not np.isfinite(ap) or not np.isfinite(w):
                guard.iloc[i] = np.nan
                continue
            if ap >= self.apen_suppress:
                guard.iloc[i] = 0.0
                continue
            r_label = int(regimes.iloc[i])
            wt = w2_thresh.get(r_label, 1.0)
            guard.iloc[i] = float(max(0.0, 1.0 - w / max(wt, 1e-9)))

        self.calibration = GuardCalibration(
            apen_threshold=self.apen_suppress,
            w2_threshold_per_regime=w2_thresh,
            reference_per_regime=ref,
            apen_history=apen,
            w2_history=w2,
            guard_history=guard,
        )
        return self.calibration

    # ------------------------------------------------------------------
    def compute_apen(self, returns_window: np.ndarray) -> float:
        return approximate_entropy(returns_window, m=self.m)

    def compute_w2(self, recent_returns: np.ndarray, current_regime: int) -> float:
        if self.calibration is None:
            raise RuntimeError("Guard not fitted")
        ref = self.calibration.reference_per_regime.get(int(current_regime))
        if ref is None or len(ref) == 0:
            return 0.0
        return float(wasserstein_distance(recent_returns, ref))

    def get_guard(self, recent_returns: pd.Series, current_regime: int) -> float:
        if self.calibration is None:
            raise RuntimeError("Guard not fitted")
        rec = recent_returns.dropna().astype(float).values[-self.window :]
        if len(rec) < self.window:
            return 0.0
        ap = self.compute_apen(rec)
        w = self.compute_w2(rec[-self.ref_window :], current_regime)
        if not np.isfinite(ap) or not np.isfinite(w):
            return 0.0
        if ap >= self.apen_suppress:
            return 0.0
        wt = self.calibration.w2_threshold_per_regime.get(int(current_regime), 1.0)
        return float(max(0.0, 1.0 - w / max(wt, 1e-9)))

    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        if self.calibration is None:
            return
        cal = self.calibration
        print("\n[DualEntropyGuard]")
        print(f"  ApEn suppress threshold: {cal.apen_threshold}")
        print("  W2 thresholds per regime (90th pct):")
        for r, t in cal.w2_threshold_per_regime.items():
            print(f"    R{r}: {t:.5f}")
        if cal.guard_history is not None:
            zero_pct = float((cal.guard_history.fillna(0) == 0).mean()) * 100
            mean_g = float(cal.guard_history.dropna().mean())
            print(f"  Guard=0 fraction:  {zero_pct:.1f}%")
            print(f"  Mean guard value:  {mean_g:.3f}")

    def plot_entropy_history(self, out_path: Path | None = None) -> Path:
        if self.calibration is None:
            raise RuntimeError("Not fitted")
        out_path = out_path or (config.PLOTS_DIR / "entropy_guard.png")
        fig, axes = plt.subplots(3, 1, figsize=(14, 8), sharex=True)
        cal = self.calibration
        axes[0].plot(cal.apen_history.index, cal.apen_history.values, lw=0.6, color="#d62728")
        axes[0].axhline(cal.apen_threshold, color="black", lw=0.5, ls="--")
        axes[0].set_title("Approximate Entropy")
        axes[1].plot(cal.w2_history.index, cal.w2_history.values, lw=0.6, color="#1f77b4")
        axes[1].set_title("Wasserstein-2 vs regime reference")
        axes[2].plot(cal.guard_history.index, cal.guard_history.values, lw=0.6, color="#2ca02c")
        axes[2].set_title("Combined Guard(t) ∈ [0,1]")
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path
