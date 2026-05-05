"""MacroCouplingPCA — 6-factor macro decomposition with regime-conditional drift.

Macro panel:  [real_rates, DXY, VIX (inverted), COT_net_long, WTI, GVZ].

Procedure
---------
1. Standardise each series (z-score, full sample).
2. PCA(K=6) — retain ≥ 70% variance.
3. Regime-conditional loading vectors Φ(R) ∈ R^K via OLS:

        r^gold_t = Φ(R_t) · F_t + ε_t,    R_t = current HMM regime.

4. Adjusted drift used by ASFM:

        μ̃(t, R) = μ(R) + Φ(R) · F(t).

5. Alignment score for Layer 4 of the 9-layer filter:

        align = (sgn · Φ(R)) · F(t)  /  ‖Φ(R) · F(t)‖

   where ``sgn`` is +1 for LONG, −1 for SHORT.
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
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from .. import config

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
@dataclass
class MacroCalibration:
    pca: PCA
    scaler: StandardScaler
    feature_names: list[str]
    explained_variance_ratio: np.ndarray
    regime_loadings: dict[int, np.ndarray] = field(default_factory=dict)
    regime_mu_residual: dict[int, float] = field(default_factory=dict)
    factors: Optional[pd.DataFrame] = None


class MacroCouplingPCA:
    """K=6 PCA on macro factors with regime-conditional gold beta vectors."""

    DEFAULT_FEATURES: tuple[str, ...] = (
        "real_rate_10y",
        "dxy",
        "vix",
        "cot_net_long",
        "wti",
        "gvz",
    )

    def __init__(
        self,
        k: int = config.PCA_K_FACTORS,
        min_explained: float = config.PCA_MIN_VARIANCE_EXPLAINED,
        features: Optional[tuple[str, ...]] = None,
    ) -> None:
        self.k = k
        self.min_explained = min_explained
        self.features = features or self.DEFAULT_FEATURES
        self.calibration: Optional[MacroCalibration] = None

    # ------------------------------------------------------------------
    def _build_panel(self, panel: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
        usable = [f for f in self.features if f in panel.columns]
        if len(usable) < 4:
            raise ValueError(f"Need at least 4 macro features, got {usable}")
        X = panel[usable].copy()
        # invert VIX so all factors point in the same "risk-on" direction
        if "vix" in X.columns:
            X["vix"] = -X["vix"]
        X = X.dropna()
        return X, usable

    # ------------------------------------------------------------------
    def fit(
        self,
        panel: pd.DataFrame,
        gold_returns: pd.Series,
        regime_sequence: pd.Series,
    ) -> MacroCalibration:
        X, usable = self._build_panel(panel)
        scaler = StandardScaler().fit(X.values)
        Xz = scaler.transform(X.values)
        # Cap k to available features (CFTC may be absent)
        k_actual = min(self.k, X.shape[1])
        if k_actual < self.k:
            log.warning("PCA: only %d macro features available, reducing k from %d to %d", X.shape[1], self.k, k_actual)
        self.k = k_actual
        pca = PCA(n_components=self.k, random_state=config.SEED).fit(Xz)
        F = pca.transform(Xz)

        explained = pca.explained_variance_ratio_
        cum = float(explained.sum())
        if cum < self.min_explained:
            log.warning("PCA cumulative variance %.2f < target %.2f", cum, self.min_explained)

        factors = pd.DataFrame(F, index=X.index, columns=[f"F{i+1}" for i in range(self.k)])

        # regime-conditional Φ(R) via OLS
        rets = gold_returns.reindex(factors.index).dropna()
        F_aligned = factors.reindex(rets.index)
        regimes = regime_sequence.reindex(rets.index).ffill().bfill().astype(int)

        regime_loadings: dict[int, np.ndarray] = {}
        regime_mu: dict[int, float] = {}
        for label in (1, 2, 3, 4):
            mask = (regimes == label).values
            if mask.sum() < 30:
                regime_loadings[label] = np.zeros(self.k)
                regime_mu[label] = 0.0
                continue
            Y = rets.values[mask]
            Xr = F_aligned.values[mask]
            # design: [1, F1..Fk]
            ones = np.ones((Xr.shape[0], 1))
            D = np.hstack([ones, Xr])
            try:
                coef, *_ = np.linalg.lstsq(D, Y, rcond=None)
                regime_mu[label] = float(coef[0])
                regime_loadings[label] = coef[1:].astype(float)
            except Exception as exc:
                log.error("OLS failed for regime %d: %s", label, exc)
                regime_loadings[label] = np.zeros(self.k)
                regime_mu[label] = 0.0

        self.calibration = MacroCalibration(
            pca=pca,
            scaler=scaler,
            feature_names=usable,
            explained_variance_ratio=explained,
            regime_loadings=regime_loadings,
            regime_mu_residual=regime_mu,
            factors=factors,
        )
        return self.calibration

    # ------------------------------------------------------------------
    def get_current_factors(self, latest_macro_row: pd.Series) -> np.ndarray:
        cal = self._require()
        x = np.array([latest_macro_row.get(f, np.nan) for f in cal.feature_names], dtype=float)
        if np.isnan(x).any():
            raise ValueError(f"Missing macro values: {cal.feature_names}")
        if "vix" in cal.feature_names:
            i = cal.feature_names.index("vix")
            x[i] = -x[i]
        z = cal.scaler.transform(x.reshape(1, -1))
        return cal.pca.transform(z).ravel()

    # ------------------------------------------------------------------
    def get_macro_drift(self, current_factors: np.ndarray, regime: int) -> float:
        cal = self._require()
        phi = cal.regime_loadings.get(int(regime), np.zeros(self.k))
        mu0 = cal.regime_mu_residual.get(int(regime), 0.0)
        return float(mu0 + phi @ current_factors)

    # ------------------------------------------------------------------
    def get_alignment_score(
        self,
        signal_direction: int,
        current_factors: np.ndarray,
        regime: int,
    ) -> float:
        """Scalar alignment in [−1, 1].  ``signal_direction`` ∈ {+1, −1}."""
        cal = self._require()
        phi = cal.regime_loadings.get(int(regime), np.zeros(self.k))
        proj = phi * current_factors
        proj_signed = signal_direction * proj
        denom = float(np.linalg.norm(proj))
        if denom < 1e-12:
            return 0.0
        return float(np.sum(proj_signed) / denom)

    # ------------------------------------------------------------------
    def _require(self) -> MacroCalibration:
        if self.calibration is None:
            raise RuntimeError("MacroCouplingPCA not fitted")
        return self.calibration

    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        cal = self._require()
        print("\n[PCA] explained variance ratio")
        for i, e in enumerate(cal.explained_variance_ratio, 1):
            print(f"  F{i}: {e:.3f}")
        print(f"  cumulative: {float(cal.explained_variance_ratio.sum()):.3f}")
        print("\n[PCA] regime-conditional loadings Φ(R)")
        for r in (1, 2, 3, 4):
            phi = cal.regime_loadings.get(r)
            if phi is None:
                continue
            joined = " ".join(f"{v:+.3f}" for v in phi)
            print(f"  R{r}:  μ0={cal.regime_mu_residual[r]:+.5f}  Φ=[{joined}]")

    # ------------------------------------------------------------------
    def plot_factor_evolution(self, out_path: Path | None = None) -> Path:
        cal = self._require()
        if cal.factors is None:
            raise RuntimeError("Factors not available")
        out_path = out_path or (config.PLOTS_DIR / "pca_factors.png")
        fig, ax = plt.subplots(figsize=(14, 5))
        for col in cal.factors.columns:
            ax.plot(cal.factors.index, cal.factors[col].values, lw=0.7, label=col)
        ax.legend(ncol=3, fontsize=8)
        ax.set_title("PCA macro factors")
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path
