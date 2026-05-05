"""Preprocessor — feature engineering, fractional differentiation, splits.

Implements Lopez de Prado (2018, *Advances in Financial Machine Learning*,
ch. 5) fractional differentiation: a memory-preserving alternative to
integer differencing.  The binomial expansion

    (1 - L)^d  x_t = Σ_{k=0}^∞  ω_k  x_{t-k},
    ω_0 = 1,  ω_k = ω_{k-1} · −(d − k + 1) / k

is truncated when |ω_k| < ``WEIGHT_TOLERANCE``.  The optimal ``d ∈ (0, 1)``
per feature is the smallest value such that the ADF test rejects the unit
root null at 5%.

Stationarity is double-checked with KPSS as a second opinion.
"""
from __future__ import annotations

import logging
import warnings
from dataclasses import dataclass, field
from typing import Iterable

import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller, kpss

from .. import config

log = logging.getLogger(__name__)

WEIGHT_TOLERANCE: float = 1e-5
ADF_PVALUE_TARGET: float = 0.05


# =====================================================================
# Technical indicator helpers
# =====================================================================
def _adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Wilder's Average Directional Index (ADX) — measures trend strength 0-100."""
    alpha = 1.0 / period
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    atr = tr.ewm(alpha=alpha, adjust=False).mean()

    up_move = high - high.shift(1)
    dn_move = low.shift(1) - low
    dm_plus = up_move.where((up_move > dn_move) & (up_move > 0), 0.0)
    dm_minus = dn_move.where((dn_move > up_move) & (dn_move > 0), 0.0)

    di_plus = 100.0 * dm_plus.ewm(alpha=alpha, adjust=False).mean() / atr.replace(0, np.nan)
    di_minus = 100.0 * dm_minus.ewm(alpha=alpha, adjust=False).mean() / atr.replace(0, np.nan)
    sum_di = (di_plus + di_minus).replace(0, np.nan)
    dx = 100.0 * (di_plus - di_minus).abs() / sum_di
    return dx.ewm(alpha=alpha, adjust=False).mean()


# =====================================================================
# Fractional differentiation (Lopez de Prado, 2018)
# =====================================================================
def get_weights(d: float, size: int) -> np.ndarray:
    """Generalised binomial weights ω_k for (1−L)^d, k = 0..size−1."""
    w = [1.0]
    for k in range(1, size):
        w_k = -w[-1] * (d - k + 1) / k
        w.append(w_k)
    return np.asarray(w[::-1])  # reversed so newest obs is last


def get_weights_ffd(d: float, thres: float = WEIGHT_TOLERANCE) -> np.ndarray:
    """Fixed-window fractional-diff weights truncated at |ω_k| < thres."""
    w = [1.0]
    k = 1
    while True:
        w_k = -w[-1] * (d - k + 1) / k
        if abs(w_k) < thres:
            break
        w.append(w_k)
        k += 1
        if k > 10_000:
            break
    return np.asarray(w[::-1])


def frac_diff_ffd(series: pd.Series, d: float, thres: float = WEIGHT_TOLERANCE) -> pd.Series:
    """Apply fixed-width fractional differentiation to a series.

    Uses a fixed window so the variance is stationary across time
    (Lopez de Prado, *AFML* p. 83).
    """
    w = get_weights_ffd(d, thres=thres)
    width = len(w) - 1
    out = np.full(len(series), np.nan)
    arr = series.to_numpy(dtype=float)
    for i in range(width, len(arr)):
        window = arr[i - width : i + 1]
        if np.isnan(window).any():
            continue
        out[i] = float(np.dot(w, window))
    return pd.Series(out, index=series.index, name=series.name)


def find_min_d(
    series: pd.Series,
    d_grid: Iterable[float] = tuple(np.round(np.arange(0.0, 1.01, 0.05), 2)),
    pvalue_target: float = ADF_PVALUE_TARGET,
    thres: float = WEIGHT_TOLERANCE,
) -> tuple[float, pd.Series, float]:
    """Smallest d in ``d_grid`` whose differenced series rejects unit root.

    Returns
    -------
    (d_opt, differenced_series, adf_pvalue)
    """
    best: tuple[float, pd.Series, float] | None = None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for d in d_grid:
            try:
                diff = frac_diff_ffd(series, d=float(d), thres=thres).dropna()
                if len(diff) < 100:
                    continue
                pval = adfuller(diff, maxlag=1, regression="c", autolag=None)[1]
            except Exception as exc:
                log.debug("frac_diff failed at d=%s: %s", d, exc)
                continue
            if pval < pvalue_target:
                return float(d), diff, float(pval)
            if best is None or pval < best[2]:
                best = (float(d), diff, float(pval))
    if best is None:
        # fallback: integer differencing
        return 1.0, series.diff().dropna(), float("nan")
    return best


# =====================================================================
# Stationarity diagnostics
# =====================================================================
def stationarity_report(series: pd.Series, label: str) -> dict:
    s = series.dropna()
    if len(s) < 50:
        return {"label": label, "n": len(s), "adf_p": np.nan, "kpss_p": np.nan}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        adf_p = adfuller(s, maxlag=1, regression="c", autolag=None)[1]
        try:
            kpss_p = kpss(s, regression="c", nlags="auto")[1]
        except Exception:
            kpss_p = np.nan
    return {"label": label, "n": int(len(s)), "adf_p": float(adf_p), "kpss_p": float(kpss_p)}


# =====================================================================
# Preprocessor pipeline
# =====================================================================
@dataclass
class PreprocResult:
    features: pd.DataFrame
    optimal_d: dict[str, float] = field(default_factory=dict)
    stationarity_before: list[dict] = field(default_factory=list)
    stationarity_after: list[dict] = field(default_factory=list)


class Preprocessor:
    """Convert the merged macro panel into stationary features."""

    # Features that are already stationary (returns) and need no frac diff.
    NATIVELY_STATIONARY: tuple[str, ...] = (
        "log_return",
        "abs_return_5d",
        "abs_return_10d",
        "abs_return_20d",
        "intraday_range",
    )
    # Derived macro features — stationary or intentionally raw — passed through as-is.
    PASSTHROUGH_FEATURES: tuple[str, ...] = (
        "real_rate_abs",
        "real_rate_delta_21d",
        "dxy_momentum_ratio",
        "cot_z_260d",
        "gold_vs_trend",    # (close - EMA_63) / ATR_20  — normalised distance to trend
        "trend_strength",   # ADX_14 — trend strength 0-100
    )
    # Features whose level should be frac-diffed.
    LEVEL_FEATURES: tuple[str, ...] = (
        "realized_vol_20d",
        "ofi_proxy_20d",
        "gold_rates_beta_63d",
        "dxy_level",
        "vix_level",
        "gvz_level",
        "wti_level",
        "real_rate_level",
        "cot_net_long_level",
    )

    def __init__(self, frac_diff_thres: float = WEIGHT_TOLERANCE) -> None:
        self.frac_diff_thres = frac_diff_thres

    # ------------------------------------------------------------------
    def build_features(self, panel: pd.DataFrame) -> pd.DataFrame:
        """Compute the raw (pre-frac-diff) feature set."""
        f = pd.DataFrame(index=panel.index)
        close = panel["gold_close"].astype(float)
        opn = panel["gold_open"].astype(float)
        high = panel["gold_high"].astype(float)
        low = panel["gold_low"].astype(float)

        f["log_return"] = np.log(close / close.shift(1))
        f["realized_vol_20d"] = f["log_return"].rolling(20).std() * np.sqrt(252)

        for w in (5, 10, 20):
            f[f"abs_return_{w}d"] = f["log_return"].abs().rolling(w).mean()

        # Order-flow imbalance proxy: signed body / total range.
        body = (close - opn).rolling(20).sum()
        rng = (high - low).rolling(20).sum()
        f["ofi_proxy_20d"] = body / rng.replace(0, np.nan)

        # Rolling 63d OLS β of gold returns on real-rate changes.
        if "real_rate_10y" in panel.columns:
            rr = panel["real_rate_10y"].astype(float)
            drr = rr.diff()
            r = f["log_return"]
            cov = r.rolling(63).cov(drr)
            var = drr.rolling(63).var()
            f["gold_rates_beta_63d"] = cov / var.replace(0, np.nan)
        else:
            f["gold_rates_beta_63d"] = np.nan

        f["intraday_range"] = (high - low) / close

        # New macro features (pass-through — no frac diff required).
        if "real_rate_10y" in panel.columns:
            rr = panel["real_rate_10y"].astype(float)
            f["real_rate_abs"] = rr                   # raw level: regime awareness for tree models
            f["real_rate_delta_21d"] = rr.diff(21)    # velocity of rate change
        else:
            f["real_rate_abs"] = np.nan
            f["real_rate_delta_21d"] = np.nan

        if "dxy" in panel.columns:
            dxy = panel["dxy"].astype(float)
            ret_20 = np.log(dxy / dxy.shift(20))
            ret_63 = np.log(dxy / dxy.shift(63))
            ret_63_safe = ret_63.where(ret_63.abs() > 1e-6, np.nan)
            f["dxy_momentum_ratio"] = ret_20 / ret_63_safe  # dollar acceleration vs trend
        else:
            f["dxy_momentum_ratio"] = np.nan

        if "cot_net_long" in panel.columns:
            cot = panel["cot_net_long"].astype(float)
            mu_cot = cot.rolling(260).mean()
            sd_cot = cot.rolling(260).std()
            f["cot_z_260d"] = (cot - mu_cot) / sd_cot.replace(0, np.nan)
        else:
            f["cot_z_260d"] = np.nan

        # gold_vs_trend: normalised distance from EMA-63 trend (R2 pullback signal)
        atr20 = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1).rolling(20).mean()
        ema63 = close.ewm(span=63, adjust=False).mean()
        f["gold_vs_trend"] = (close - ema63) / atr20.replace(0, np.nan)

        # trend_strength: ADX-14 (0-100, higher = stronger trend)
        f["trend_strength"] = _adx(high, low, close, period=14)

        # Macro levels (fractionally differentiated below).
        f["dxy_level"] = panel.get("dxy", np.nan)
        f["vix_level"] = panel.get("vix", np.nan)
        f["gvz_level"] = panel.get("gvz", np.nan)
        f["wti_level"] = panel.get("wti", np.nan)
        f["real_rate_level"] = panel.get("real_rate_10y", np.nan)
        f["cot_net_long_level"] = panel.get("cot_net_long", np.nan)

        return f

    # ------------------------------------------------------------------
    def fit_transform(self, panel: pd.DataFrame) -> PreprocResult:
        raw = self.build_features(panel)

        # --- stationarity report BEFORE differentiation ---
        before: list[dict] = [stationarity_report(raw[c], c) for c in raw.columns]

        # --- fractional differentiation on level features ---
        frac: dict[str, pd.Series] = {}
        d_map: dict[str, float] = {}
        for col in self.LEVEL_FEATURES:
            if col not in raw.columns:
                continue
            s = raw[col].dropna()
            if s.empty:
                d_map[col] = float("nan")
                frac[col] = pd.Series(np.nan, index=raw.index, name=col)
                continue
            d_opt, diff, _ = find_min_d(s, thres=self.frac_diff_thres)
            d_map[col] = d_opt
            full = pd.Series(np.nan, index=raw.index, name=col)
            full.loc[diff.index] = diff.values
            frac[col] = full

        # Pass-through natively stationary features.
        feats = pd.DataFrame(index=raw.index)
        for col in self.NATIVELY_STATIONARY:
            if col in raw.columns:
                feats[col] = raw[col]
        for col, ser in frac.items():
            feats[col] = ser
        for col in self.PASSTHROUGH_FEATURES:
            if col in raw.columns:
                feats[col] = raw[col]

        # Forward momentum features (already stationary as returns of returns).
        for w in (5, 10, 20):
            feats[f"momentum_{w}d"] = raw["log_return"].rolling(w).mean()

        after: list[dict] = [stationarity_report(feats[c], c) for c in feats.columns]

        return PreprocResult(features=feats, optimal_d=d_map, stationarity_before=before, stationarity_after=after)

    # ------------------------------------------------------------------
    def split(
        self,
        feats: pd.DataFrame,
        train_end: str = config.TRAIN_END,
        validation_end: str = config.VALIDATION_END,
    ) -> dict[str, pd.DataFrame]:
        train = feats.loc[: train_end].copy()
        val = feats.loc[train_end:validation_end].iloc[1:].copy()
        test = feats.loc[validation_end:].iloc[1:].copy()
        return {"train": train, "validation": val, "test": test}

    # ------------------------------------------------------------------
    @staticmethod
    def print_report(result: PreprocResult) -> None:
        print("\n[Preprocessor] fractional differentiation d* per feature")
        for col, d in result.optimal_d.items():
            print(f"  {col:<25s} d* = {d:.2f}")
        print("\n[Preprocessor] stationarity (ADF p-value) — after diff")
        for row in result.stationarity_after:
            mark = "OK" if (row["adf_p"] < 0.05) else "!!"
            print(f"  {mark} {row['label']:<25s} ADF p={row['adf_p']:.4f}  KPSS p={row['kpss_p']:.4f}  n={row['n']}")


# =====================================================================
# Intraday (1h) helpers — OFI and Class-C window tagging
# =====================================================================
def compute_intraday_ofi(bars_1h: pd.DataFrame, window: int = 20) -> pd.Series:
    """Order-flow imbalance from 1h OHLCV bars.

    OFI = rolling_sum(body_fraction × volume) / rolling_sum(volume)
    where body_fraction = (close − open) / (high − low) [signed, in [−1, +1]].
    Represents net buy pressure scaled by bar range and volume.
    """
    close = bars_1h["Close"].astype(float)
    opn = bars_1h["Open"].astype(float)
    high = bars_1h["High"].astype(float)
    low = bars_1h["Low"].astype(float)
    vol = bars_1h["Volume"].replace(0, np.nan).astype(float)
    rng = (high - low).replace(0, np.nan)
    body_frac = (close - opn) / rng
    weighted = body_frac * vol
    ofi = weighted.rolling(window).sum() / vol.rolling(window).sum()
    return ofi.rename("ofi_1h")


def tag_c_windows(bars_1h: pd.DataFrame) -> pd.Series:
    """Assign each 1h bar to a Class-C temporal window (or '' if none).

    Uses the UTC minute boundaries defined in config.CLASS_C_WINDOWS_UTC.
    Each bar is identified by the minute-of-day of its timestamp.
    """
    from .. import config as _cfg  # avoid circular at module level
    minute = bars_1h.index.hour * 60 + bars_1h.index.minute
    tags = pd.Series("", index=bars_1h.index, name="c_window")
    for name, (start_m, end_m) in _cfg.CLASS_C_WINDOWS_UTC.items():
        mask = (minute >= start_m) & (minute <= end_m)
        tags[mask] = name
    return tags


# =====================================================================
# Hard guard: prevent test-period leakage
# =====================================================================
def assert_no_test_leakage(frame: pd.DataFrame, validation_end: str = config.VALIDATION_END) -> None:
    cutoff = pd.Timestamp(validation_end)
    if frame.index.max() > cutoff:
        raise AssertionError(
            f"Test-period leakage: input frame extends to {frame.index.max().date()} "
            f"but model is being trained — must be ≤ {cutoff.date()}"
        )
