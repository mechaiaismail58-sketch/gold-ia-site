"""MertonHawkesProcess — coupled jump-diffusion + self-exciting intensity.

Merton bimodal jumps
--------------------
Historical jumps are detected as |r_t| > 3 σ_{20d}.  Their log-magnitudes
are fit by a 2-component Gaussian mixture:

    log J  ~  p_up · N(μ↑, σ↑²)  +  (1 − p_up) · N(μ↓, σ↓²)

(MLE via :func:`scipy.optimize.minimize`.)

Hawkes self-exciting intensity
------------------------------
Exceedance events:  |r_t| > 2 σ_{20d}.  Conditional intensity

    λ*(t) = μ_H + Σ_{t_i < t}  α exp(−β (t − t_i)).

Maximum-likelihood estimator with closed-form cumulative compensator:

    log L = Σ_i log λ*(t_i) − ∫_0^T λ*(s) ds,
    ∫_0^T λ*(s) ds = μ_H T + (α/β) Σ_i [1 − exp(−β (T − t_i))].

Stationarity (α/β < 1) is enforced by capping at 0.85 if violated.
A separate Hawkes is fit per HMM regime.

Coupling
--------
Replaces the constant Merton λ by the time-varying λ*(t).  When
λ*(t) > 3 μ_H this triggers ``clustering_alert`` — fed straight into
Layer 5 of the 9-layer filter.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from scipy import optimize
from scipy.stats import norm

from .. import config

log = logging.getLogger(__name__)


# ===========================================================================
@dataclass
class JumpParams:
    lambda_base: float        # average jumps per year
    mu_up: float
    sigma_up: float
    mu_dn: float
    sigma_dn: float
    p_up: float


@dataclass
class HawkesParams:
    mu_H: float               # baseline intensity (per day)
    alpha: float
    beta: float

    @property
    def stationary(self) -> bool:
        return self.alpha < self.beta and self.beta > 0

    @property
    def branching_ratio(self) -> float:
        return self.alpha / max(self.beta, 1e-9)


# ===========================================================================
def _detect_threshold_events(returns: pd.Series, k: float, window: int = 20) -> pd.Series:
    sigma = returns.rolling(window).std()
    mask = returns.abs() > (k * sigma)
    return returns[mask].dropna()


# ===========================================================================
class MertonHawkesProcess:
    """Joint Merton + Hawkes calibration & evaluation."""

    def __init__(
        self,
        jump_k: float = config.HAWKES_JUMP_K,
        exceed_k: float = config.HAWKES_EXCEEDANCE_K,
        stationarity_cap: float = config.HAWKES_STATIONARITY_CAP,
        clustering_alert: float = config.HAWKES_CLUSTERING_ALERT,
    ) -> None:
        self.jump_k = jump_k
        self.exceed_k = exceed_k
        self.stationarity_cap = stationarity_cap
        self.clustering_alert = clustering_alert
        self.jump_params: Optional[JumpParams] = None
        self.hawkes_by_regime: dict[int, HawkesParams] = {}

    # ------------------------------------------------------------------
    # Merton bimodal jump calibration
    # ------------------------------------------------------------------
    def calibrate_jumps(self, returns: pd.Series) -> JumpParams:
        returns = returns.dropna().astype(float)
        jumps = _detect_threshold_events(returns, k=self.jump_k)
        n_jumps = len(jumps)
        n_years = max(1.0, len(returns) / 252.0)
        lambda_base = n_jumps / n_years

        if n_jumps < 10:
            log.warning("Only %d jumps detected — using diffuse priors", n_jumps)
            self.jump_params = JumpParams(
                lambda_base=lambda_base,
                mu_up=0.02, sigma_up=0.01,
                mu_dn=-0.025, sigma_dn=0.012,
                p_up=0.55,
            )
            return self.jump_params

        x = jumps.to_numpy()

        # MLE for two-component mixture
        def neg_ll(params: np.ndarray) -> float:
            mu_u, log_su, mu_d, log_sd, logit_p = params
            su, sd = np.exp(log_su), np.exp(log_sd)
            p = 1.0 / (1.0 + np.exp(-logit_p))
            l_u = norm.pdf(x, loc=mu_u, scale=max(su, 1e-6))
            l_d = norm.pdf(x, loc=mu_d, scale=max(sd, 1e-6))
            l = p * l_u + (1 - p) * l_d
            l = np.clip(l, 1e-300, None)
            return -float(np.sum(np.log(l)))

        x0 = np.array([
            float(np.median(x[x > 0])) if (x > 0).any() else 0.02,
            np.log(float(np.std(x[x > 0])) or 0.01) if (x > 0).any() else np.log(0.01),
            float(np.median(x[x < 0])) if (x < 0).any() else -0.02,
            np.log(float(np.std(x[x < 0])) or 0.01) if (x < 0).any() else np.log(0.01),
            0.0,
        ])
        try:
            res = optimize.minimize(neg_ll, x0, method="Nelder-Mead", options={"xatol": 1e-6, "maxiter": 5000})
            mu_u, log_su, mu_d, log_sd, logit_p = res.x
        except Exception as exc:
            log.error("Merton MLE failed: %s — using empirical splits", exc)
            mu_u = float(np.mean(x[x > 0])) if (x > 0).any() else 0.02
            mu_d = float(np.mean(x[x < 0])) if (x < 0).any() else -0.02
            log_su = np.log(float(np.std(x[x > 0])) or 0.01)
            log_sd = np.log(float(np.std(x[x < 0])) or 0.01)
            logit_p = 0.0

        p_up = float(1.0 / (1.0 + np.exp(-logit_p)))
        self.jump_params = JumpParams(
            lambda_base=float(lambda_base),
            mu_up=float(mu_u),
            sigma_up=float(np.exp(log_su)),
            mu_dn=float(mu_d),
            sigma_dn=float(np.exp(log_sd)),
            p_up=float(np.clip(p_up, 0.05, 0.95)),
        )
        return self.jump_params

    # ------------------------------------------------------------------
    # Hawkes per-regime MLE
    # ------------------------------------------------------------------
    def _hawkes_loglik(self, t_events: np.ndarray, T: float, params: np.ndarray) -> float:
        mu_H, alpha, beta = params
        if mu_H <= 0 or alpha < 0 or beta <= 0:
            return -1e12

        # Compute λ*(t_i) recursively in O(n)
        n = len(t_events)
        if n == 0:
            return -mu_H * T

        intensity_at_events = np.zeros(n)
        intensity_at_events[0] = mu_H
        A = 0.0
        for i in range(1, n):
            dt_i = t_events[i] - t_events[i - 1]
            A = np.exp(-beta * dt_i) * (A + alpha)
            intensity_at_events[i] = mu_H + A

        log_term = float(np.sum(np.log(np.clip(intensity_at_events, 1e-300, None))))

        # Closed-form compensator integral
        comp = mu_H * T + (alpha / beta) * float(np.sum(1.0 - np.exp(-beta * (T - t_events))))

        return log_term - comp

    def _calibrate_hawkes_segment(self, t_events: np.ndarray, T: float) -> HawkesParams:
        if len(t_events) < 10:
            mu_H = max(1e-3, len(t_events) / max(T, 1.0))
            return HawkesParams(mu_H=mu_H, alpha=0.0, beta=1.0)

        def neg_ll(theta: np.ndarray) -> float:
            mu_H = np.exp(theta[0])
            alpha = np.exp(theta[1])
            beta = np.exp(theta[2])
            return -self._hawkes_loglik(t_events, T, np.array([mu_H, alpha, beta]))

        x0 = np.array([np.log(max(1e-3, len(t_events) / T)), np.log(0.5), np.log(2.0)])
        try:
            res = optimize.minimize(neg_ll, x0, method="Nelder-Mead", options={"xatol": 1e-5, "maxiter": 8000})
            mu_H, alpha, beta = np.exp(res.x)
        except Exception as exc:
            log.error("Hawkes MLE failed: %s", exc)
            mu_H = max(1e-3, len(t_events) / T)
            alpha, beta = 0.5, 2.0

        # enforce stationarity
        if alpha / max(beta, 1e-9) >= 1.0:
            alpha = self.stationarity_cap * beta
            log.warning("Hawkes branching ratio ≥ 1 — capped at α/β = %.2f", self.stationarity_cap)
        return HawkesParams(mu_H=float(mu_H), alpha=float(alpha), beta=float(beta))

    def calibrate_hawkes(
        self,
        returns: pd.Series,
        regime_sequence: pd.Series,
    ) -> dict[int, HawkesParams]:
        returns = returns.dropna().astype(float)
        regimes = regime_sequence.reindex(returns.index).ffill().bfill().astype(int)

        # event times in days from start
        sigma = returns.rolling(20).std()
        events = (returns.abs() > self.exceed_k * sigma)
        events = events.fillna(False)

        idx_to_day = {idx: i for i, idx in enumerate(returns.index)}
        for label in (1, 2, 3, 4):
            mask = (regimes == label) & events
            t_events = np.array([idx_to_day[ix] for ix in returns.index[mask]], dtype=float)
            # Reset clock per regime: use length of regime as T
            T = float((regimes == label).sum())
            if T <= 0:
                T = float(len(returns))
            self.hawkes_by_regime[label] = self._calibrate_hawkes_segment(t_events, T)

        return self.hawkes_by_regime

    # ------------------------------------------------------------------
    # Real-time intensity & alerts
    # ------------------------------------------------------------------
    def compute_current_intensity(
        self,
        recent_returns: pd.Series,
        current_regime: int,
    ) -> float:
        params = self.hawkes_by_regime.get(int(current_regime))
        if params is None:
            return 0.0
        rets = recent_returns.dropna().astype(float)
        sigma = rets.rolling(20).std()
        events = rets.abs() > self.exceed_k * sigma
        events = events.fillna(False)
        if not events.any():
            return params.mu_H
        # day index relative to last observation
        t_now = float(len(rets) - 1)
        event_days = np.where(events.values)[0].astype(float)
        decay = np.exp(-params.beta * (t_now - event_days))
        return float(params.mu_H + params.alpha * decay.sum())

    def is_clustering_alert(
        self,
        recent_returns: pd.Series,
        current_regime: int,
        threshold: Optional[float] = None,
    ) -> bool:
        threshold = threshold if threshold is not None else self.clustering_alert
        params = self.hawkes_by_regime.get(int(current_regime))
        if params is None:
            return False
        lam = self.compute_current_intensity(recent_returns, current_regime)
        return lam > threshold * params.mu_H

    # ------------------------------------------------------------------
    # Sampling
    # ------------------------------------------------------------------
    def sample_jump(self, direction: Optional[str] = None, rng: Optional[np.random.Generator] = None) -> float:
        if self.jump_params is None:
            raise RuntimeError("Jump distribution not calibrated")
        rng = rng or np.random.default_rng()
        if direction is None:
            direction = "up" if rng.random() < self.jump_params.p_up else "dn"
        if direction == "up":
            return float(rng.normal(self.jump_params.mu_up, self.jump_params.sigma_up))
        return float(rng.normal(self.jump_params.mu_dn, self.jump_params.sigma_dn))

    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        print("\n[Merton-Hawkes] jump distribution")
        if self.jump_params:
            jp = self.jump_params
            print(f"  λ_base={jp.lambda_base:.2f}/yr, p_up={jp.p_up:.2f}")
            print(f"  up:  μ={jp.mu_up:+.4f} σ={jp.sigma_up:.4f}")
            print(f"  dn:  μ={jp.mu_dn:+.4f} σ={jp.sigma_dn:.4f}")
        print("\n[Merton-Hawkes] regime intensities")
        for r in (1, 2, 3, 4):
            p = self.hawkes_by_regime.get(r)
            if p is None:
                continue
            print(
                f"  R{r}: μ_H={p.mu_H:.3f}  α={p.alpha:.3f}  β={p.beta:.3f}  "
                f"α/β={p.branching_ratio:.3f}  {'✓ stationary' if p.stationary else '✗ NON-stationary'}"
            )
