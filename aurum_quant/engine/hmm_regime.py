"""GoldHMM — 4-state Gaussian HMM for gold market regimes.

Mathematical structure
----------------------
Latent state Z_t ∈ {1,2,3,4}, observation X_t ∈ R^3 with

    X_t | Z_t = i  ~  N(μ_i, Σ_i),
    P(Z_t = j | Z_{t−1} = i) = A_{ij}.

Parameters (π, A, μ_i, Σ_i) are fitted by Baum–Welch (EM) — implemented via
:mod:`hmmlearn`.  Latent state inference uses Viterbi for the MAP path and
the forward algorithm for the filtered posterior π_t = P(Z_t | X_{1..t}).

After fitting, states are relabelled by emission volatility (descending
σ on the log-return component) so that the canonical mapping always holds:

    R1 = highest σ        → ``HIGH_VOL``      (crisis / shock)
    R2 = 2nd-highest σ + positive μ_return → ``NORMAL_TREND``
    R3 = lowest σ         → ``LOW_VOL_DRIFT`` (consolidation)
    R4 = remaining (≈0 or negative μ_return) → ``MEAN_REVERTING``

Note on Feller condition: this HMM does **not** directly govern the CIR
variance dynamics (those live in :mod:`engine.heston`).  The conceptual
link is that R1's high-σ state primes the CIR mean-reversion target and
the Feller condition 2 κ θ > ξ² is enforced inside the Heston calibrator.
"""
from __future__ import annotations

import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM
from sklearn.cluster import KMeans

from .. import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result containers
# ---------------------------------------------------------------------------
@dataclass
class RegimeStats:
    regime_id: int
    label: str
    mu_annual: float
    sigma_annual: float
    n_days: int
    mean_duration: float
    mean_obs: np.ndarray
    cov_obs: np.ndarray


@dataclass
class HMMArtifacts:
    transition_matrix: np.ndarray
    start_prob: np.ndarray
    means: np.ndarray
    covars: np.ndarray
    label_to_state: dict[int, int]   # canonical label (1..4) → fitted state idx
    state_to_label: dict[int, int]
    feature_columns: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# GoldHMM
# ---------------------------------------------------------------------------
class GoldHMM:
    """4-state Gaussian HMM with canonical regime labels."""

    FEATURES: tuple[str, ...] = ("log_return", "realized_vol_20d", "abs_return_5d")

    def __init__(
        self,
        n_components: int = config.N_REGIMES,
        tol: float = config.HMM_CONVERGENCE_THRESHOLD,
        max_iter: int = config.HMM_MAX_ITER,
        seed: int = config.SEED,
    ) -> None:
        if n_components != 4:
            raise ValueError("GoldHMM is hard-wired for 4 regimes (R1..R4)")
        self.n_components = n_components
        self.tol = tol
        self.max_iter = max_iter
        self.seed = seed
        self.model: Optional[GaussianHMM] = None
        self.artifacts: Optional[HMMArtifacts] = None
        self.regimes: list[RegimeStats] = []
        self._fit_columns: list[str] = []

    # ------------------------------------------------------------------
    # Pre-fit helpers
    # ------------------------------------------------------------------
    def _matrix(self, frame: pd.DataFrame) -> np.ndarray:
        missing = [c for c in self.FEATURES if c not in frame.columns]
        if missing:
            raise KeyError(f"HMM input missing features: {missing}")
        X = frame[list(self.FEATURES)].dropna().to_numpy(dtype=float)
        if X.shape[0] < 250:
            raise ValueError(f"Insufficient observations for HMM (n={X.shape[0]})")
        return X

    def _kmeans_init(self, X: np.ndarray) -> dict:
        """Seed Baum-Welch with k-means clusters on (return, |return|)."""
        rng = np.random.default_rng(self.seed)
        seed_features = np.column_stack([X[:, 0], np.abs(X[:, 0])])
        km = KMeans(n_clusters=self.n_components, n_init=10, random_state=self.seed).fit(seed_features)
        labels = km.labels_

        means = np.zeros((self.n_components, X.shape[1]))
        covars = np.zeros((self.n_components, X.shape[1], X.shape[1]))
        start_prob = np.zeros(self.n_components)
        for k in range(self.n_components):
            mask = labels == k
            if mask.sum() < 10:
                # degenerate cluster — sample randomly to avoid singular cov
                idx = rng.integers(0, X.shape[0], size=50)
                Xk = X[idx]
            else:
                Xk = X[mask]
            means[k] = Xk.mean(axis=0)
            covars[k] = np.cov(Xk.T) + 1e-6 * np.eye(X.shape[1])
            start_prob[k] = mask.sum() / X.shape[0]
        start_prob = start_prob / start_prob.sum()
        return {"means": means, "covars": covars, "start_prob": start_prob}

    # ------------------------------------------------------------------
    # Canonical relabelling
    # ------------------------------------------------------------------
    @staticmethod
    def _canonical_labels(
        means: np.ndarray, covars: np.ndarray
    ) -> tuple[dict[int, int], dict[int, int]]:
        """Map fitted-state index → canonical label R1..R4.

        Sorts by emission std on the log-return component (col 0) DESC.
        R1 = highest σ; R3 = lowest σ; among the middle two, the one with
        higher μ_return is R2 (normal trend), the other is R4 (mean reversion).
        """
        sigmas = np.sqrt(np.maximum(covars[:, 0, 0], 1e-12))
        mus = means[:, 0]
        order = np.argsort(-sigmas)  # highest σ first
        r1 = int(order[0])
        r3 = int(order[-1])
        middle = [int(i) for i in order[1:-1]]
        # the middle one with higher μ → R2, the other → R4
        if mus[middle[0]] >= mus[middle[1]]:
            r2, r4 = middle[0], middle[1]
        else:
            r2, r4 = middle[1], middle[0]
        label_to_state = {1: r1, 2: r2, 3: r3, 4: r4}
        state_to_label = {v: k for k, v in label_to_state.items()}
        return label_to_state, state_to_label

    # ------------------------------------------------------------------
    # Fit
    # ------------------------------------------------------------------
    def fit(self, X_train: pd.DataFrame) -> "GoldHMM":
        X = self._matrix(X_train)
        self._fit_columns = list(self.FEATURES)
        seed_pack = self._kmeans_init(X)

        model = GaussianHMM(
            n_components=self.n_components,
            covariance_type="full",
            n_iter=self.max_iter,
            tol=self.tol,
            init_params="t",   # let EM learn transitions; keep our μ, Σ, start
            params="stmc",
            random_state=self.seed,
            verbose=False,
        )
        model.startprob_ = seed_pack["start_prob"]
        model.means_ = seed_pack["means"]
        model.covars_ = seed_pack["covars"]
        model.fit(X)

        label_to_state, state_to_label = self._canonical_labels(model.means_, model.covars_)

        self.model = model
        self.artifacts = HMMArtifacts(
            transition_matrix=model.transmat_.copy(),
            start_prob=model.startprob_.copy(),
            means=model.means_.copy(),
            covars=model.covars_.copy(),
            label_to_state=label_to_state,
            state_to_label=state_to_label,
            feature_columns=self._fit_columns,
        )
        self._compute_regime_stats(X_train)
        return self

    # ------------------------------------------------------------------
    def _compute_regime_stats(self, frame: pd.DataFrame) -> None:
        if self.model is None or self.artifacts is None:
            return
        states = self.predict_regime(frame)  # canonical labels
        rets = frame["log_return"].reindex(states.index).to_numpy(dtype=float)

        regimes: list[RegimeStats] = []
        for label in (1, 2, 3, 4):
            state_idx = self.artifacts.label_to_state[label]
            mask = (states.values == label)
            n = int(mask.sum())
            r_in = rets[mask]
            r_in = r_in[np.isfinite(r_in)]
            mu = float(np.mean(r_in)) * 252 if r_in.size else 0.0
            sig = float(np.std(r_in, ddof=1)) * np.sqrt(252) if r_in.size > 1 else 0.0
            # Mean duration: 1 / (1 − A_ii) with A in canonical relabelling.
            a_ii = float(self.artifacts.transition_matrix[state_idx, state_idx])
            duration = 1.0 / max(1e-9, 1.0 - a_ii)
            regimes.append(
                RegimeStats(
                    regime_id=label,
                    label=config.REGIME_LABELS[label],
                    mu_annual=mu,
                    sigma_annual=sig,
                    n_days=n,
                    mean_duration=duration,
                    mean_obs=self.artifacts.means[state_idx].copy(),
                    cov_obs=self.artifacts.covars[state_idx].copy(),
                )
            )
        self.regimes = regimes

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def _ensure_fit(self) -> None:
        if self.model is None or self.artifacts is None:
            raise RuntimeError("HMM not fitted")

    def predict_regime(self, frame: pd.DataFrame) -> pd.Series:
        """Viterbi MAP sequence as canonical labels (1..4)."""
        self._ensure_fit()
        sub = frame[list(self.FEATURES)].dropna()
        states_idx = self.model.predict(sub.to_numpy(dtype=float))
        labels = np.array([self.artifacts.state_to_label[int(s)] for s in states_idx])
        return pd.Series(labels, index=sub.index, name="regime")

    def predict_proba(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Filtered posterior P(Z_t = label | X_{1..t}) for each canonical label."""
        self._ensure_fit()
        sub = frame[list(self.FEATURES)].dropna()
        post = self.model.predict_proba(sub.to_numpy(dtype=float))  # (T, K)
        # reorder columns from fitted-state idx to canonical 1..4
        cols = np.zeros_like(post)
        for label in (1, 2, 3, 4):
            cols[:, label - 1] = post[:, self.artifacts.label_to_state[label]]
        return pd.DataFrame(cols, index=sub.index, columns=[f"P_R{i}" for i in (1, 2, 3, 4)])

    def get_current_regime(self, latest_obs: pd.DataFrame) -> tuple[int, np.ndarray]:
        """Most recent (label, posterior_vector)."""
        proba = self.predict_proba(latest_obs)
        if proba.empty:
            raise RuntimeError("Cannot infer regime — empty observation frame")
        last = proba.iloc[-1].to_numpy()
        label = int(np.argmax(last)) + 1
        return label, last

    # ------------------------------------------------------------------
    # IO
    # ------------------------------------------------------------------
    def save(self, path: Path | str) -> None:
        path = Path(path)
        with path.open("wb") as fh:
            pickle.dump({"model": self.model, "artifacts": self.artifacts, "regimes": self.regimes}, fh)

    @classmethod
    def load(cls, path: Path | str) -> "GoldHMM":
        path = Path(path)
        with path.open("rb") as fh:
            blob = pickle.load(fh)
        obj = cls()
        obj.model = blob["model"]
        obj.artifacts = blob["artifacts"]
        obj.regimes = blob.get("regimes", [])
        obj._fit_columns = list(cls.FEATURES)
        return obj

    # ------------------------------------------------------------------
    # Diagnostics & viz
    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        if not self.regimes:
            print("[GoldHMM] not yet fitted")
            return
        print("\n[GoldHMM] regime summary (sorted R1→R4)")
        print(f"{'id':<3s}{'label':<22s}{'days':>6s}{'μ_ann':>10s}{'σ_ann':>10s}{'dur':>8s}")
        for r in self.regimes:
            print(
                f"{r.regime_id:<3d}{r.label:<22s}{r.n_days:>6d}"
                f"{r.mu_annual:>+10.3f}{r.sigma_annual:>10.3f}{r.mean_duration:>8.1f}"
            )
        if self.artifacts is not None:
            print("\nTransition matrix (canonical R1..R4 ordering):")
            A = self.artifacts.transition_matrix
            l2s = self.artifacts.label_to_state
            for i in (1, 2, 3, 4):
                row = " ".join(f"{A[l2s[i], l2s[j]]:.3f}" for j in (1, 2, 3, 4))
                print(f"  R{i} -> {row}")

    def plot_regimes(self, prices: pd.Series, sequence: pd.Series, out_path: Path | None = None) -> Path:
        out_path = out_path or (config.PLOTS_DIR / "regime_plot.png")
        fig, ax = plt.subplots(figsize=(14, 5))
        colors = {1: "#d62728", 2: "#2ca02c", 3: "#1f77b4", 4: "#ff7f0e"}
        ax.plot(prices.index, prices.values, color="black", lw=0.8, alpha=0.6)
        for label in (1, 2, 3, 4):
            mask = (sequence == label)
            if mask.any():
                ax.fill_between(
                    prices.index,
                    prices.min(),
                    prices.max(),
                    where=mask.reindex(prices.index, fill_value=False).values,
                    color=colors[label],
                    alpha=0.10,
                    label=config.REGIME_LABELS[label],
                )
        ax.set_title("Gold price coloured by HMM regime (R1..R4)")
        ax.legend(loc="upper left", fontsize=8, ncol=4)
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path
