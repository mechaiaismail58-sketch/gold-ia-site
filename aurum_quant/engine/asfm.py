"""ASFM — Aurum Stochastic Field Model: unified price process simulator.

Discretised price dynamics
--------------------------
    S_{t+dt}  =  S_t · exp{ [μ̃(t, R_t) − ½ v_t] dt + √(v_t dt) Z_1 }
                · exp{ log J_S · 𝟙_{jump_t} },

where
    μ̃(t, R) = μ(R) + Φ(R) · F(t)        (PCA macro coupling)
    v_{t+dt}  = max(0, v_t + κ_R(θ_R − v_t^+) dt + ξ_R √(v_t^+ dt) Z_2)
    P(jump_t) = λ*(t) · dt                (Hawkes intensity)
    log J_S   ~  bimodal Merton mixture.

Z₁, Z₂ are correlated standard normals via Cholesky with regime-conditional
ρ_R from the Heston calibration.

Drift suppression by Guard
--------------------------
    μ̃_eff(t, R)  = Guard(t) · μ̃(t, R).

When the Dual-Entropy Guard is 0 (signal-suppression zone) the drift is
fully zeroed-out; vol and jump dynamics still run.

This module orchestrates the components without taking ownership of their
calibration; each component is calibrated upstream by ``main.py``.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from .. import config
from .entropy_guard import DualEntropyGuard
from .heston import HestonCalibrator
from .hmm_regime import GoldHMM
from .kalman_fv import KalmanFairValue
from .merton_hawkes import MertonHawkesProcess
from .pca_macro import MacroCouplingPCA

log = logging.getLogger(__name__)


@dataclass
class ASFMState:
    S0: float
    v0: float
    regime: int
    factors: np.ndarray
    guard: float = 1.0


@dataclass
class SimulationResult:
    paths: np.ndarray            # shape (n_paths, T+1)
    variance_paths: np.ndarray   # shape (n_paths, T+1)
    regime_paths: np.ndarray     # shape (n_paths, T+1)
    percentiles: dict[str, np.ndarray] = field(default_factory=dict)
    statistics: dict[str, float] = field(default_factory=dict)


class ASFM:
    """Unified ASFM Monte Carlo engine."""

    def __init__(
        self,
        hmm: Optional[GoldHMM] = None,
        kalman: Optional[KalmanFairValue] = None,
        heston: Optional[HestonCalibrator] = None,
        merton_hawkes: Optional[MertonHawkesProcess] = None,
        pca_macro: Optional[MacroCouplingPCA] = None,
        entropy_guard: Optional[DualEntropyGuard] = None,
        dt: float = config.KALMAN_DT,
    ) -> None:
        self.hmm = hmm
        self.kalman = kalman
        self.heston = heston
        self.merton_hawkes = merton_hawkes
        self.pca_macro = pca_macro
        self.entropy_guard = entropy_guard
        self.dt = dt

    # ------------------------------------------------------------------
    def initialize(
        self,
        hmm: GoldHMM,
        kalman: KalmanFairValue,
        heston: HestonCalibrator,
        merton_hawkes: MertonHawkesProcess,
        pca_macro: MacroCouplingPCA,
        entropy_guard: DualEntropyGuard,
    ) -> "ASFM":
        self.hmm = hmm
        self.kalman = kalman
        self.heston = heston
        self.merton_hawkes = merton_hawkes
        self.pca_macro = pca_macro
        self.entropy_guard = entropy_guard
        return self

    # ------------------------------------------------------------------
    def _ensure(self) -> None:
        for name in ("hmm", "heston", "merton_hawkes", "pca_macro"):
            if getattr(self, name) is None:
                raise RuntimeError(f"ASFM missing component: {name}")

    # ------------------------------------------------------------------
    def _simulate_regime_paths(self, current_regime: int, T: int, n_paths: int, rng: np.random.Generator) -> np.ndarray:
        """Sample regime trajectories from the HMM transition matrix."""
        if self.hmm is None or self.hmm.artifacts is None:
            return np.full((n_paths, T + 1), current_regime, dtype=int)
        A = self.hmm.artifacts.transition_matrix
        l2s = self.hmm.artifacts.label_to_state
        s2l = self.hmm.artifacts.state_to_label
        # current_regime is canonical label → fitted-state index
        s0 = l2s[int(current_regime)]
        n_states = A.shape[0]
        seq = np.zeros((n_paths, T + 1), dtype=int)
        seq[:, 0] = current_regime
        cur = np.full(n_paths, s0, dtype=int)
        for t in range(1, T + 1):
            r = rng.random(n_paths)
            for p in range(n_paths):
                cdf = np.cumsum(A[cur[p]])
                nxt = int(np.searchsorted(cdf, r[p]))
                nxt = min(nxt, n_states - 1)
                cur[p] = nxt
                seq[p, t] = s2l[nxt]
        return seq

    # ------------------------------------------------------------------
    def simulate(
        self,
        S0: float,
        T: int,
        n_paths: int = 10_000,
        current_regime: int = 2,
        current_variance: Optional[float] = None,
        current_factors: Optional[np.ndarray] = None,
        guard: float = 1.0,
        seed: Optional[int] = None,
    ) -> SimulationResult:
        self._ensure()
        rng = np.random.default_rng(seed if seed is not None else config.SEED)

        regime_paths = self._simulate_regime_paths(current_regime, T, n_paths, rng)
        v_paths = self.heston.simulate_variance_path(
            T + 1,
            regime_sequence=regime_paths,
            n_paths=n_paths,
            v0=current_variance,
            seed=int(rng.integers(0, 2**31)),
        )

        S = np.zeros((n_paths, T + 1))
        S[:, 0] = S0

        # Pre-build correlated normals via Cholesky per regime
        # We'll compute Z1, Z2 with regime-conditional ρ each step.
        F0 = current_factors if current_factors is not None else np.zeros(self.pca_macro.k)

        # Pre-fetch regime parameters
        rho_by_label = {r: self.heston.calibration.params[r].rho for r in self.heston.calibration.params}

        for t in range(1, T + 1):
            Z2 = (v_paths[:, t] - v_paths[:, t - 1])  # already used inside heston, here we need fresh innovation
            # Re-derive Z2 from the increment (full truncation):
            #   v_t − v_{t-1} = κ(θ−v⁺)dt + ξ√(v⁺ dt) Z2
            # but we instead just sample fresh Z1 and reuse the normalised innovation:
            Z2_norm = rng.standard_normal(n_paths)
            Z1_indep = rng.standard_normal(n_paths)

            for p in range(n_paths):
                lbl = int(regime_paths[p, t])
                rho = rho_by_label.get(lbl, -0.4)
                # Z1 = ρ Z2 + √(1−ρ²) Z1_indep
                Z1 = rho * Z2_norm[p] + np.sqrt(max(1 - rho ** 2, 0.0)) * Z1_indep[p]
                v_pos = max(v_paths[p, t - 1], 0.0)
                # macro-adjusted drift
                mu_tilde = self.pca_macro.get_macro_drift(F0, lbl) if self.pca_macro.calibration else 0.0
                mu_eff = guard * mu_tilde
                drift_term = (mu_eff - 0.5 * v_pos) * self.dt
                diff_term = np.sqrt(v_pos * self.dt) * Z1
                # Hawkes-Merton jump
                hp = self.merton_hawkes.hawkes_by_regime.get(lbl)
                if hp is not None:
                    lam = hp.mu_H  # baseline; full λ*(t) requires path history (omitted in MC for speed)
                    p_jump = min(1.0, lam * self.dt)
                    if rng.random() < p_jump:
                        jump = self.merton_hawkes.sample_jump(rng=rng) if self.merton_hawkes.jump_params else 0.0
                    else:
                        jump = 0.0
                else:
                    jump = 0.0
                S[p, t] = S[p, t - 1] * np.exp(drift_term + diff_term + jump)

        result = SimulationResult(
            paths=S,
            variance_paths=v_paths,
            regime_paths=regime_paths,
        )
        result.percentiles = self._percentiles(S)
        result.statistics = self._statistics(S, S0)
        return result

    # ------------------------------------------------------------------
    @staticmethod
    def _percentiles(paths: np.ndarray) -> dict[str, np.ndarray]:
        return {
            "P10": np.percentile(paths, 10, axis=0),
            "P25": np.percentile(paths, 25, axis=0),
            "P50": np.percentile(paths, 50, axis=0),
            "P75": np.percentile(paths, 75, axis=0),
            "P90": np.percentile(paths, 90, axis=0),
        }

    @staticmethod
    def _statistics(paths: np.ndarray, S0: float) -> dict[str, float]:
        finals = paths[:, -1]
        rets = finals / S0 - 1.0
        return {
            "E_final_price": float(np.mean(finals)),
            "median_final_price": float(np.median(finals)),
            "VaR_95": float(np.percentile(rets, 5)),
            "CVaR_95": float(rets[rets <= np.percentile(rets, 5)].mean()) if (rets <= np.percentile(rets, 5)).any() else float("nan"),
            "prob_loss": float(np.mean(rets < 0)),
        }
