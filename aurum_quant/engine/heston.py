"""HestonCalibrator — regime-specific stochastic-volatility calibration.

Variance dynamics (CIR / Heston)
--------------------------------
    dv_t = κ (θ − v_t) dt + ξ √v_t  dW^v_t,
    dW^S_t · dW^v_t = ρ dt.

Per HMM regime R ∈ {1..4} we calibrate (κ, θ, ξ, ρ, v0).  The objective is
to match the empirical autocorrelation structure of realised variance:
this is robust to jumps in returns (the jump component is handled in
:mod:`engine.merton_hawkes`).  A particle-swarm minimisation (Optuna TPE
acts as the surrogate when SciPy DE is unavailable) is used because the
ACF objective is non-convex.

Feller condition
----------------
Probability of v_t ever touching 0 is zero iff  2 κ θ > ξ².  After
calibration we project parameters onto the feasible set if violated:

    if 2 κ θ ≤ ξ²:  ξ ←  √(2 κ θ · 0.99)

(scaling ξ down preserves κ, θ which are the more economically meaningful
parameters).

Simulation
----------
Full-truncation Euler-Maruyama (Lord, Koekkoek & Van Dijk, 2010):

    v_{t+dt} = max(0,  v_t + κ (θ − v_t^+) dt + ξ √(v_t^+ dt) Z_v),
    where  v_t^+ = max(v_t, 0).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import optuna
import pandas as pd

from .. import config

log = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)


# ---------------------------------------------------------------------------
@dataclass
class HestonParams:
    regime: int
    kappa: float
    theta: float
    xi: float
    rho: float
    v0: float
    feller_satisfied: bool

    def project_feller(self, slack: float = 0.99) -> "HestonParams":
        """Return a copy with Feller satisfied (scaling ξ if needed)."""
        if 2 * self.kappa * self.theta > self.xi ** 2:
            return HestonParams(self.regime, self.kappa, self.theta, self.xi, self.rho, self.v0, True)
        new_xi = float(np.sqrt(2 * self.kappa * self.theta * slack))
        return HestonParams(self.regime, self.kappa, self.theta, new_xi, self.rho, self.v0, True)


@dataclass
class HestonCalibration:
    params: dict[int, HestonParams] = field(default_factory=dict)


# ---------------------------------------------------------------------------
def _empirical_var_acf(rv: np.ndarray, lags: tuple[int, ...]) -> np.ndarray:
    """ACF of realised variance at given lags."""
    rv = rv - rv.mean()
    var0 = float(np.dot(rv, rv) / len(rv))
    if var0 == 0:
        return np.zeros(len(lags))
    out = np.zeros(len(lags))
    for i, h in enumerate(lags):
        if h <= 0 or h >= len(rv):
            continue
        c = float(np.dot(rv[h:], rv[:-h]) / (len(rv) - h))
        out[i] = c / var0
    return out


def _model_var_acf(kappa: float, lags: tuple[int, ...], dt: float = 1.0 / 252.0) -> np.ndarray:
    """Theoretical CIR variance autocorrelation: Corr[v_t, v_{t+h}] = exp(−κ h dt)."""
    return np.exp(-kappa * np.asarray(lags, dtype=float) * dt)


# ---------------------------------------------------------------------------
class HestonCalibrator:
    """Calibrate per-regime Heston parameters from realised variance."""

    LAGS: tuple[int, ...] = (1, 3, 5, 10, 20, 40, 60)

    def __init__(self, dt: float = 1.0 / 252.0, n_trials: int = 80, seed: int = config.SEED):
        self.dt = dt
        self.n_trials = n_trials
        self.seed = seed
        self.calibration = HestonCalibration()

    # ------------------------------------------------------------------
    def _objective(self, returns: np.ndarray) -> callable:
        # rolling 5d realised variance as proxy
        rv = pd.Series(returns ** 2).rolling(5).mean().dropna().to_numpy()
        if len(rv) < 100:
            raise ValueError("Insufficient samples to compute RV ACF")
        emp_acf = _empirical_var_acf(rv, self.LAGS)
        emp_var_mean = float(np.mean(rv))
        emp_var_std = float(np.std(rv))
        cov_rv_r = float(np.cov(rv[1:], returns[1:][: len(rv) - 1])[0, 1]) if len(rv) > 2 else 0.0

        def fn(trial: optuna.Trial) -> float:
            kappa = trial.suggest_float("kappa", 0.5, 30.0, log=True)
            theta = trial.suggest_float("theta", 1e-5, 0.5, log=True)
            xi = trial.suggest_float("xi", 1e-3, 2.0, log=True)
            rho = trial.suggest_float("rho", -0.95, 0.0)

            model_acf = _model_var_acf(kappa, self.LAGS, self.dt)
            err_acf = float(np.mean((model_acf - emp_acf) ** 2))

            # match unconditional mean of v ≈ θ
            err_mean = (theta - emp_var_mean) ** 2 / max(emp_var_mean ** 2, 1e-12)

            # match vol-of-variance: stationary Var[v] = (ξ² θ) / (2κ)
            var_v_model = (xi ** 2) * theta / max(2.0 * kappa, 1e-9)
            err_volvol = (var_v_model - emp_var_std ** 2) ** 2 / max(emp_var_std ** 4, 1e-18)

            # ρ encourages negative correlation between price and variance shock
            err_rho = (rho - np.sign(cov_rv_r) * min(0.7, abs(cov_rv_r) * 100)) ** 2 * 0.05

            return err_acf + 0.3 * err_mean + 0.2 * err_volvol + err_rho

        return fn

    # ------------------------------------------------------------------
    def calibrate(
        self,
        returns: pd.Series,
        regime_sequence: pd.Series,
    ) -> HestonCalibration:
        """Calibrate one Heston parameter set per regime."""
        returns = returns.astype(float).dropna()
        regimes = regime_sequence.reindex(returns.index).ffill().bfill().astype(int)

        for label in (1, 2, 3, 4):
            mask = (regimes == label).values
            sub = returns[mask].to_numpy()
            if len(sub) < 200:
                log.warning("Heston regime %d: only %d samples — using fallback", label, len(sub))
                self.calibration.params[label] = self._fallback(label, sub)
                continue
            try:
                study = optuna.create_study(
                    direction="minimize",
                    sampler=optuna.samplers.TPESampler(seed=self.seed + label),
                )
                study.optimize(self._objective(sub), n_trials=self.n_trials, show_progress_bar=False)
                p = study.best_params
                params = HestonParams(
                    regime=label,
                    kappa=float(p["kappa"]),
                    theta=float(p["theta"]),
                    xi=float(p["xi"]),
                    rho=float(p["rho"]),
                    v0=float(np.var(sub) * 252.0),
                    feller_satisfied=False,
                ).project_feller()
                self.calibration.params[label] = params
            except Exception as exc:
                log.error("Heston regime %d calibration failed: %s", label, exc)
                self.calibration.params[label] = self._fallback(label, sub)

        return self.calibration

    @staticmethod
    def _fallback(label: int, returns: np.ndarray) -> HestonParams:
        v = float(np.var(returns) * 252.0) if returns.size else 0.04
        return HestonParams(
            regime=label,
            kappa=2.0,
            theta=v,
            xi=min(0.5, float(np.sqrt(1.5 * v))),
            rho=-0.4,
            v0=v,
            feller_satisfied=True,
        )

    # ------------------------------------------------------------------
    def simulate_variance_path(
        self,
        T: int,
        regime_sequence: np.ndarray,
        n_paths: int = 1,
        v0: Optional[float] = None,
        seed: Optional[int] = None,
    ) -> np.ndarray:
        """Full-truncation Euler-Maruyama simulator.

        ``regime_sequence`` is shape (T,) of integer regime labels per step,
        OR shape (n_paths, T).  ``v0`` defaults to the calibrated v0 of the
        first-step regime.
        """
        rng = np.random.default_rng(seed if seed is not None else self.seed)
        regime_seq = np.asarray(regime_sequence, dtype=int)
        if regime_seq.ndim == 1:
            regime_seq = np.tile(regime_seq, (n_paths, 1))
        elif regime_seq.shape[0] != n_paths:
            raise ValueError("regime_sequence shape mismatch")

        v = np.zeros((n_paths, T))
        first_label = int(regime_seq[0, 0])
        v[:, 0] = v0 if v0 is not None else self.calibration.params[first_label].v0

        for t in range(1, T):
            Z = rng.standard_normal(n_paths)
            for i in range(n_paths):
                lbl = int(regime_seq[i, t])
                p = self.calibration.params.get(lbl) or self.calibration.params[1]
                v_pos = max(v[i, t - 1], 0.0)
                drift = p.kappa * (p.theta - v_pos) * self.dt
                diff = p.xi * np.sqrt(v_pos * self.dt) * Z[i]
                v[i, t] = max(0.0, v[i, t - 1] + drift + diff)
        return v

    # ------------------------------------------------------------------
    def get_current_vol_estimate(self, recent_returns: pd.Series, regime: int) -> float:
        """Point-in-time annualised vol estimate (sqrt(v))."""
        v_emp = float(recent_returns.var() * 252.0) if len(recent_returns) > 5 else None
        p = self.calibration.params.get(int(regime))
        if p is None and v_emp is None:
            return 0.20
        if p is None:
            return float(np.sqrt(max(v_emp, 1e-6)))
        if v_emp is None:
            return float(np.sqrt(p.v0))
        # blend short-window estimate with regime mean (½/½)
        v = 0.5 * v_emp + 0.5 * p.theta
        return float(np.sqrt(max(v, 1e-6)))

    # ------------------------------------------------------------------
    def print_calibration_summary(self) -> None:
        print("\n[Heston] regime parameters")
        print(f"{'R':<4s}{'κ':>10s}{'θ':>12s}{'ξ':>10s}{'ρ':>8s}{'v0':>12s}{'Feller':>8s}")
        for r in (1, 2, 3, 4):
            p = self.calibration.params.get(r)
            if p is None:
                print(f"R{r}: <not calibrated>")
                continue
            f_ok = (2 * p.kappa * p.theta > p.xi ** 2)
            print(
                f"R{r:<3d}{p.kappa:>10.3f}{p.theta:>12.5f}{p.xi:>10.3f}"
                f"{p.rho:>8.2f}{p.v0:>12.5f}{'✓' if f_ok else '✗':>8s}"
            )
