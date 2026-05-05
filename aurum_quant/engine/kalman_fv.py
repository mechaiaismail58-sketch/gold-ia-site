"""KalmanFairValue — regime-conditional Kalman filter for fair-value estimation.

State-space model
-----------------
Latent state x_t = [log_FV_t, trend_t]^T:

    x_t   = F · x_{t−1} + w_t,    w_t ~ N(0, Q(R_t))
    z_t   = H · x_t      + v_t,    v_t ~ N(0, R(R_t))

with constant-velocity F = [[1, dt], [0, 1]],  H = [1, 0],
and the noise covariances Q, R scaled per HMM regime R_t (config).

Fair-value gap
--------------
Per timestep we compute

    gap_t  =  (price_t − FV_t) /  (σ_rolling_t · FV_t)

expressed in units of one-σ.  This drives Layer 3 of the 9-layer filter.

Time-varying β tracker
----------------------
A second 1-D Kalman tracks β_t in

    r^gold_t = β_t · Δrr_t + ε_t

with Innovation Covariance Matching (Mehra 1972) for adaptive Q estimation.
This β series feeds :mod:`engine.bai_perron` for break detection and
:mod:`engine.pca_macro` for the time-varying real-rate loading.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from filterpy.kalman import KalmanFilter

from .. import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
@dataclass
class KalmanResult:
    fair_value: pd.Series          # exp(filtered log fair value)
    log_fair_value: pd.Series
    trend: pd.Series
    gap_sigma: pd.Series           # (P − FV) / (σ_roll · FV)
    innovations: pd.Series
    state_cov_diag: pd.DataFrame   # P_diag per timestep


# ---------------------------------------------------------------------------
class KalmanFairValue:
    """Regime-conditional 2-state Kalman filter on log price."""

    def __init__(
        self,
        dt: float = config.KALMAN_DT,
        base_q_diag: tuple[float, float] = (1e-6, 1e-9),
        base_r: float = 1e-4,
        sigma_window: int = 20,
        regime_q: dict[int, float] = config.KALMAN_REGIME_Q,
        regime_r: dict[int, float] = config.KALMAN_REGIME_R,
    ) -> None:
        self.dt = dt
        self.base_q_diag = base_q_diag
        self.base_r = base_r
        self.sigma_window = sigma_window
        self.regime_q = dict(regime_q)
        self.regime_r = dict(regime_r)
        self._kf: Optional[KalmanFilter] = None
        self.result: Optional[KalmanResult] = None

    # ------------------------------------------------------------------
    def _build_filter(self, x0: np.ndarray) -> KalmanFilter:
        kf = KalmanFilter(dim_x=2, dim_z=1)
        kf.F = np.array([[1.0, self.dt], [0.0, 1.0]])
        kf.H = np.array([[1.0, 0.0]])
        kf.x = x0.reshape(2, 1)
        kf.P = np.diag([1.0, 1.0])
        kf.Q = np.diag(self.base_q_diag)
        kf.R = np.array([[self.base_r]])
        return kf

    def _q_for_regime(self, regime: int) -> np.ndarray:
        scale = self.regime_q.get(int(regime), 1.0)
        return np.diag([self.base_q_diag[0] * scale, self.base_q_diag[1] * scale])

    def _r_for_regime(self, regime: int) -> np.ndarray:
        scale = self.regime_r.get(int(regime), 1.0)
        return np.array([[self.base_r * scale]])

    # ------------------------------------------------------------------
    def fit(self, log_prices: pd.Series, regime_sequence: pd.Series) -> KalmanResult:
        """Run the filter pass on full log-price history."""
        log_prices = log_prices.dropna().astype(float)
        regimes = regime_sequence.reindex(log_prices.index).ffill().bfill().astype(int)

        # rolling realised σ in log-return space
        rets = log_prices.diff()
        sigma_roll = rets.rolling(self.sigma_window).std().bfill()

        x0 = np.array([float(log_prices.iloc[0]), 0.0])
        kf = self._build_filter(x0)
        n = len(log_prices)
        log_fv = np.zeros(n)
        trend = np.zeros(n)
        innov = np.zeros(n)
        cov = np.zeros((n, 2))

        for t, (idx, z) in enumerate(log_prices.items()):
            r_t = int(regimes.iloc[t])
            kf.Q = self._q_for_regime(r_t)
            kf.R = self._r_for_regime(r_t)
            kf.predict()
            kf.update(np.array([[float(z)]]))
            log_fv[t] = float(kf.x[0, 0])
            trend[t] = float(kf.x[1, 0])
            innov[t] = float(kf.y[0, 0])
            cov[t] = np.diag(kf.P)

        log_fv_s = pd.Series(log_fv, index=log_prices.index, name="log_fv")
        fv_s = np.exp(log_fv_s).rename("fair_value")
        trend_s = pd.Series(trend, index=log_prices.index, name="trend")
        innov_s = pd.Series(innov, index=log_prices.index, name="innovation")
        cov_df = pd.DataFrame(cov, index=log_prices.index, columns=["P_fv", "P_trend"])

        # gap_t in σ units — guard against tiny σ to avoid blow-ups
        prices = np.exp(log_prices)
        sigma_safe = sigma_roll.clip(lower=1e-6)
        gap = (prices - fv_s) / (sigma_safe * fv_s)
        gap = gap.rename("gap_sigma")

        self._kf = kf
        self.result = KalmanResult(
            fair_value=fv_s,
            log_fair_value=log_fv_s,
            trend=trend_s,
            gap_sigma=gap,
            innovations=innov_s,
            state_cov_diag=cov_df,
        )
        return self.result

    # ------------------------------------------------------------------
    def get_current_gap(
        self,
        recent_log_prices: pd.Series,
        current_regime: int,
    ) -> float:
        """Online estimate of gap_t given the latest price and regime."""
        if self._kf is None:
            self.fit(recent_log_prices, pd.Series(current_regime, index=recent_log_prices.index))
        kf = self._kf
        kf.Q = self._q_for_regime(current_regime)
        kf.R = self._r_for_regime(current_regime)
        kf.predict()
        kf.update(np.array([[float(recent_log_prices.iloc[-1])]]))
        log_fv = float(kf.x[0, 0])
        fv = float(np.exp(log_fv))
        sigma = float(recent_log_prices.diff().tail(self.sigma_window).std() or 1e-6)
        price = float(np.exp(recent_log_prices.iloc[-1]))
        return (price - fv) / (sigma * fv)

    # ------------------------------------------------------------------
    def plot_fair_value(
        self,
        prices: pd.Series,
        out_path: Path | None = None,
    ) -> Path:
        if self.result is None:
            raise RuntimeError("KalmanFairValue not fitted")
        out_path = out_path or (config.PLOTS_DIR / "kalman_fv.png")
        fig, axes = plt.subplots(2, 1, figsize=(14, 7), sharex=True)
        axes[0].plot(prices.index, prices.values, color="black", lw=0.7, label="price")
        axes[0].plot(self.result.fair_value.index, self.result.fair_value.values, color="#1f77b4", lw=1.2, label="Kalman FV")
        axes[0].legend()
        axes[0].set_title("Kalman fair value")
        axes[1].plot(self.result.gap_sigma.index, self.result.gap_sigma.values, color="#d62728", lw=0.6)
        axes[1].axhline(+1.2, color="black", lw=0.5, ls="--")
        axes[1].axhline(-1.2, color="black", lw=0.5, ls="--")
        axes[1].set_title("Gap (σ units)")
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path


# ===========================================================================
# Adaptive β tracker — Innovation Covariance Matching (Mehra 1972)
# ===========================================================================
class AdaptiveBetaTracker:
    """Track β_t in r_t^gold = β_t Δrr_t + ε_t with Q tuned by Mehra ICM."""

    def __init__(self, window: int = 63, base_q: float = 1e-6, base_r: float = 1e-4):
        self.window = window
        self.base_q = base_q
        self.base_r = base_r
        self.beta_series: Optional[pd.Series] = None

    def fit(self, gold_returns: pd.Series, real_rate_changes: pd.Series) -> pd.Series:
        r = gold_returns.astype(float)
        x = real_rate_changes.astype(float).reindex(r.index)
        df = pd.concat([r, x], axis=1).dropna()
        df.columns = ["r", "x"]
        n = len(df)

        beta = 0.0
        P = 1.0
        Q = self.base_q
        R = self.base_r

        betas = np.zeros(n)
        innov = np.zeros(n)
        innov_var_window: list[float] = []

        for t, (idx, row) in enumerate(df.iterrows()):
            xt = float(row["x"])
            zt = float(row["r"])

            # predict
            P_pred = P + Q
            # update
            S = xt * P_pred * xt + R
            if S <= 0:
                S = 1e-12
            K = (P_pred * xt) / S
            y = zt - beta * xt
            beta = beta + K * y
            P = (1.0 - K * xt) * P_pred

            betas[t] = beta
            innov[t] = y

            # Mehra ICM: empirical innovation variance vs S
            innov_var_window.append(y * y)
            if len(innov_var_window) > self.window:
                innov_var_window.pop(0)
            if len(innov_var_window) >= self.window:
                emp = float(np.mean(innov_var_window))
                # adapt Q to close the gap (clip for stability)
                Q_new = max(1e-10, Q + 0.01 * (emp - S))
                Q = float(np.clip(Q_new, 1e-10, 1e-2))

        self.beta_series = pd.Series(betas, index=df.index, name="beta_gold_realrate")
        return self.beta_series
