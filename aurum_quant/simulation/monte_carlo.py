"""ASFM Monte Carlo simulator wrapper — 10,000 paths fan-chart producer.

Thin convenience layer around :class:`engine.asfm.ASFM`.  Computes the P10..
P90 fan and the path statistics needed by the dashboard.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from .. import config
from ..engine.asfm import ASFM, SimulationResult


@dataclass
class FanChart:
    horizon_days: int
    timestamps: np.ndarray
    percentiles: dict[str, np.ndarray]
    statistics: dict[str, float]


class MonteCarloSimulator:
    def __init__(self, asfm: ASFM, n_paths: int = 10_000) -> None:
        self.asfm = asfm
        self.n_paths = n_paths

    def run(
        self,
        S0: float,
        horizon_days: int,
        current_regime: int,
        current_variance: Optional[float] = None,
        current_factors: Optional[np.ndarray] = None,
        guard: float = 1.0,
        seed: Optional[int] = None,
    ) -> SimulationResult:
        return self.asfm.simulate(
            S0=S0,
            T=horizon_days,
            n_paths=self.n_paths,
            current_regime=current_regime,
            current_variance=current_variance,
            current_factors=current_factors,
            guard=guard,
            seed=seed,
        )

    @staticmethod
    def plot_fan(result: SimulationResult, S0: float, out_path: Path | None = None) -> Path:
        out_path = out_path or (config.PLOTS_DIR / "asfm_fan.png")
        pcts = result.percentiles
        x = np.arange(result.paths.shape[1])
        fig, ax = plt.subplots(figsize=(14, 6))
        ax.fill_between(x, pcts["P10"], pcts["P90"], color="#1f77b4", alpha=0.20, label="P10–P90")
        ax.fill_between(x, pcts["P25"], pcts["P75"], color="#1f77b4", alpha=0.35, label="P25–P75")
        ax.plot(x, pcts["P50"], color="#1f77b4", lw=1.5, label="P50")
        ax.axhline(S0, color="black", lw=0.5, ls="--")
        ax.set_xlabel("days")
        ax.set_ylabel("simulated price")
        ax.set_title(f"ASFM Monte Carlo fan ({result.paths.shape[0]:,} paths)")
        ax.legend()
        fig.tight_layout()
        fig.savefig(out_path, dpi=120)
        plt.close(fig)
        return out_path
