"""Aurum Quant — central configuration.

All numeric thresholds and architectural constants live here.  No other
module is allowed to define magic numbers; values must be referenced from
this file (or passed in via constructor arguments derived from it).
"""
from __future__ import annotations

from pathlib import Path
from typing import Final

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent
DATA_DIR: Final[Path] = PROJECT_ROOT / "data"
CACHE_DIR: Final[Path] = DATA_DIR / "cache"
MODELS_DIR: Final[Path] = CACHE_DIR / "models"
PLOTS_DIR: Final[Path] = CACHE_DIR / "plots"

for _p in (CACHE_DIR, MODELS_DIR, PLOTS_DIR):
    _p.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
START_DATE: Final[str] = "2010-01-01"
TRAIN_END: Final[str] = "2024-10-31"       # models trained on 2010-2024-10
VALIDATION_START: Final[str] = "2024-11-01"  # OOS evaluation window starts here
VALIDATION_END: Final[str] = "2025-04-30"  # OOS evaluation window ends here (6 months)

# Multi-period validation windows (for stress-testing across market regimes).
# Note: with TRAIN_END=2024-10-31, windows 1 and 2 are in-sample; window 3 is OOS.
VALIDATION_WINDOWS: Final[list[tuple[str, str, str]]] = [
    ("COVID_2019_2020",  "2019-01-01", "2020-06-30"),   # COVID crash + recovery
    ("FED_2022_2023",    "2022-01-01", "2023-06-30"),   # Fed hawkish cycle
    ("BULL_2024_2025",   "2024-11-01", "2025-04-30"),   # geopolitical bull (OOS)
    # Extended OOS: train=2010-2023, eval=all of 2024+early 2025 (use --strict-cutoff)
    ("BULL_2024_ALL",    "2024-01-01", "2025-04-30"),
    # Class C 1h window validation: start auto-clipped to actual 1h data (~730d back)
    ("CLASS_C_1H",       "2024-05-15", "2025-04-30"),
]

# Free key from https://fred.stlouisfed.org/docs/api/api_key.html
# Set the FRED_API_KEY environment variable, or replace the literal below.
import os
FRED_API_KEY: Final[str] = os.environ.get("FRED_API_KEY", "YOUR_FRED_API_KEY_HERE")

# ---------------------------------------------------------------------------
# Yahoo / FRED / CFTC tickers
# ---------------------------------------------------------------------------
TICKER_GOLD: Final[str] = "GC=F"          # XAU/USD futures front month
TICKER_DXY: Final[str] = "DX-Y.NYB"
TICKER_VIX: Final[str] = "^VIX"
TICKER_GVZ: Final[str] = "^GVZ"           # Gold VIX
TICKER_WTI: Final[str] = "CL=F"

FRED_REAL_RATE: Final[str] = "DFII10"     # 10y TIPS daily

TICKER_GOLD_INTRADAY: Final[str] = "GC=F"    # same ticker works for 1h bars
INTRADAY_START: Final[str] = "2022-01-01"    # earliest date for 1h OFI / C-window testing
INTRADAY_CHUNK_DAYS: Final[int] = 58         # safe chunk size for yfinance 1h requests

CFTC_DISAGG_URL: Final[str] = "https://www.cftc.gov/dea/newcot/c_disagg.txt"
CFTC_GOLD_CODE: Final[str] = "088691"

CACHE_MAX_AGE_HOURS: Final[float] = 24.0

# ---------------------------------------------------------------------------
# HMM
# ---------------------------------------------------------------------------
N_REGIMES: Final[int] = 4
HMM_CONVERGENCE_THRESHOLD: Final[float] = 1e-6
HMM_MAX_ITER: Final[int] = 1000

REGIME_LABELS: Final[dict[int, str]] = {
    1: "R1_HIGH_VOL",
    2: "R2_NORMAL_TREND",
    3: "R3_LOW_VOL_DRIFT",
    4: "R4_MEAN_REVERTING",
}

# ---------------------------------------------------------------------------
# Kalman
# ---------------------------------------------------------------------------
KALMAN_DT: Final[float] = 1.0 / 252.0

# Regime-conditional process / measurement noise scaling.
# (Q_scale, R_scale) — multipliers on the base noise covariance.
KALMAN_REGIME_Q: Final[dict[int, float]] = {1: 4.0, 2: 1.5, 3: 0.5, 4: 1.0}
KALMAN_REGIME_R: Final[dict[int, float]] = {1: 4.0, 2: 1.5, 3: 0.5, 4: 1.0}

# ---------------------------------------------------------------------------
# Entropy guard
# ---------------------------------------------------------------------------
APEN_M: Final[int] = 2
APEN_R_FACTOR: Final[float] = 0.2
APEN_N: Final[int] = 50
APEN_THRESHOLD_SUPPRESS: Final[float] = 0.90
APEN_THRESHOLD_OPTIMAL: Final[float] = 0.65
W2_PERCENTILE: Final[float] = 90.0

# ---------------------------------------------------------------------------
# Hawkes
# ---------------------------------------------------------------------------
HAWKES_EXCEEDANCE_K: Final[float] = 2.0       # |r| > K * rolling sigma
HAWKES_JUMP_K: Final[float] = 3.0             # Merton jump threshold
HAWKES_STATIONARITY_CAP: Final[float] = 0.85  # alpha/beta cap
HAWKES_CLUSTERING_ALERT: Final[float] = 3.0   # lambda_star / mu_H

# ---------------------------------------------------------------------------
# PCA
# ---------------------------------------------------------------------------
PCA_K_FACTORS: Final[int] = 6
PCA_MIN_VARIANCE_EXPLAINED: Final[float] = 0.70
MACRO_ALIGNMENT_MIN: Final[float] = 0.65

# ---------------------------------------------------------------------------
# Signal scoring
# ---------------------------------------------------------------------------
SCORER_FEATURES: Final[tuple[str, ...]] = (
    # HMM regime probabilities
    "P_R2", "P_R3",
    # Kalman fair-value gap
    "kalman_gap_sigma",
    # Microstructure
    "ofi_proxy_20d",
    # Macro coupling (PCA alignment)
    "macro_alignment",
    # Entropy guard
    "apen", "w2",
    # Jump clustering
    "hawkes_ratio",
    # COT positioning
    "cot_z52",
    # Seasonality / vol / beta
    "seasonality", "vol_ratio", "beta_dev",
    # Momentum
    "momentum_5d", "momentum_10d", "momentum_20d",
    # New: real-rate regime features
    "real_rate_abs", "real_rate_delta_21d",
    # New: dollar acceleration
    "dxy_momentum_ratio",
    # New: long-memory COT z-score
    "cot_z_260d",
)

CLASS_A_THRESHOLD: Final[float] = 88.0    # nine_layer composite score
CLASS_B_THRESHOLD: Final[float] = 80.0    # nine_layer composite score
CLASS_C_THRESHOLD: Final[float] = 68.0    # nine_layer composite score (live); Class C floor

# Walk-forward raw-probability thresholds (100 × p_win_regime).
# Each regime model has a different score ceiling, so thresholds are regime-specific.
REGIME_SCORE_THRESHOLDS: Final[dict[int, float]] = {
    2: 25.0,   # R2 pullback-in-trend (~15% base rate → probs cap ~38%)
    3: 55.0,   # R3 Kalman gap reversal (AUC ~0.53)
    4: 55.0,   # R4 entropy / Hawkes (AUC ~0.59)
}

# Per-regime class buckets for walk-forward classification (raw score × 100).
# A = top ~10% of the regime's score range; B = next ~20%; C = rest above threshold.
# R4 is NOT eligible for Class C (regime restriction).
REGIME_CLASS_A: Final[dict[int, float]] = {2: 33.0, 3: 60.0, 4: 60.0}
REGIME_CLASS_B: Final[dict[int, float]] = {2: 29.0, 3: 57.0, 4: 57.0}
# R4 C-class eligibility is False (see evaluator)

KALMAN_GAP_MIN_SIGMA: Final[float] = 1.2
META_MODEL_MIN: Final[float] = 0.45

# ---------------------------------------------------------------------------
# NineLayerFilter — dual-threshold constants (optimal = Class A, near = Class B)
# ---------------------------------------------------------------------------
# Layer 1: HMM P(R2+R3)
LAYER1_HMM_OPTIMAL: Final[float] = 0.75
LAYER1_HMM_NEAR: Final[float] = 0.55

# Layer 2: Entropy guard value
LAYER2_GUARD_OPTIMAL: Final[float] = 0.60
LAYER2_GUARD_NEAR: Final[float] = 0.25

# Layer 3: Kalman |gap_σ|
LAYER3_GAP_OPTIMAL: Final[float] = 1.80
LAYER3_GAP_NEAR: Final[float] = 0.90      # absolute minimum; values in [0.90, 1.20) are near only

# Layer 4: Macro alignment
LAYER4_ALIGN_OPTIMAL: Final[float] = 0.75
LAYER4_ALIGN_NEAR: Final[float] = 0.50

# Layer 5: Hawkes λ*/μ (must be below threshold to pass)
LAYER5_HAWKES_OPTIMAL: Final[float] = 2.0
LAYER5_HAWKES_NEAR: Final[float] = 3.5

# Layer 6: Wasserstein scale = 1 − W2/wt (must be above threshold)
LAYER6_W2_SCALE_OPTIMAL: Final[float] = 0.40
LAYER6_W2_SCALE_NEAR: Final[float] = 0.0

# ---------------------------------------------------------------------------
# UTC temporal windows for Class C signals (start_minute, end_minute since 00:00 UTC)
CLASS_C_WINDOWS_UTC: Final[dict[str, tuple[int, int]]] = {
    "LONDON_GOLD_FIX": (14 * 60 + 52, 15 * 60),
    "NY_OPEN_MOMENTUM": (13 * 60 + 30, 13 * 60 + 45),
    "LONDON_CLOSE_REVERSION": (16 * 60, 16 * 60 + 15),
}

# ---------------------------------------------------------------------------
# Sizing
# ---------------------------------------------------------------------------
CLASS_A_BASE_RISK: Final[float] = 0.035
CLASS_B_BASE_RISK: Final[float] = 0.020
CLASS_C_BASE_RISK: Final[float] = 0.010
MAX_PORTFOLIO_RISK: Final[float] = 0.04
DAILY_STOP_DD: Final[float] = 0.025

# ---------------------------------------------------------------------------
# Transaction costs (XAU/USD, points)
# ---------------------------------------------------------------------------
SPREAD_POINTS: Final[float] = 0.30
SLIPPAGE_POINTS: Final[float] = 0.15
GOLD_POINT_VALUE_USD: Final[float] = 1.0   # 1 USD per ounce per 1.00 move @ 1 oz contract

# ---------------------------------------------------------------------------
# Backtest
# ---------------------------------------------------------------------------
WALK_FORWARD_TRAIN_DAYS: Final[int] = 252
WALK_FORWARD_TEST_DAYS: Final[int] = 63
WALK_FORWARD_GAP_DAYS: Final[int] = 21
MIN_WIN_RATE: Final[float] = 0.62
MIN_SHARPE: Final[float] = 1.10
MIN_MONTHLY_SIGNALS: Final[float] = 4.0

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
SEED: Final[int] = 42
