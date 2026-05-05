"""VolumeEngine — thin wrapper around the existing RegimeAwareScorer + market-structure pipeline.

This engine reproduces the Class A/B/C logic from Pipeline._build_signal_factory
as a self-contained object so it can be composed by the Allocator alongside
other independent engines.

Risk profile : 1.5% per signal (Class A=2%, B=1.5%, C=1% scaled by class).
Signal target : 6-8 signals / month.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from ... import config


@dataclass
class EngineSignal:
    timestamp: pd.Timestamp
    direction: str          # "LONG" | "SHORT"
    signal_class: str       # "A" | "B" | "C"
    regime: int
    score: float
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_fraction: float
    c_window: str = ""
    engine: str = "VOLUME"


class VolumeEngine:
    """Wraps the Pipeline evaluator logic as a callable engine.

    Parameters
    ----------
    pipeline : Pipeline
        A fully initialised Pipeline instance (steps 1-10 complete).
    bars_1h : pd.DataFrame, optional
        UTC-naive 1h OHLCV for Class C window tagging.
    """

    BASE_RISK: dict[str, float] = {"A": 0.020, "B": 0.015, "C": 0.010}

    def __init__(self, pipeline, bars_1h: Optional[pd.DataFrame] = None) -> None:
        self._p = pipeline
        self._bars_1h = bars_1h

    # ------------------------------------------------------------------
    def generate(self, timestamp: pd.Timestamp) -> Optional[EngineSignal]:
        """Evaluate a single daily bar timestamp and return a signal or None."""
        p = self._p
        if timestamp not in p._wf_features.index:
            return None

        feat_row = p._wf_features.loc[timestamp]
        regime = int(
            p.regimes_train.reindex([timestamp]).ffill().iloc[0]
            if timestamp in p.regimes_train.index else 2
        )
        try:
            p_win = p.scorer.predict_proba_for_regime(feat_row, regime)
        except Exception:
            return None

        score = 100.0 * p_win
        regime_thr = config.REGIME_SCORE_THRESHOLDS.get(regime, config.CLASS_C_THRESHOLD)
        if score < regime_thr:
            return None

        gap = float(feat_row.get("kalman_gap_sigma", 0.0))
        if regime != 2 and abs(gap) < config.KALMAN_GAP_MIN_SIGMA:
            return None

        signal_class = p._classify_signal(score, regime)
        if signal_class is None:
            return None

        # Direction
        if regime == 2:
            mom = float(feat_row.get("momentum_20d", 0.0))
            direction = "LONG" if mom > 0 else "SHORT"
            if signal_class in ("A", "B"):
                ms = float(feat_row.get("market_structure", 0.0))
                if ms != (1.0 if direction == "LONG" else -1.0):
                    return None
        else:
            direction = "LONG" if gap < 0 else "SHORT"

        price = float(p.panel.loc[timestamp, "gold_close"])
        rv = float(
            p.panel.loc[:timestamp, "gold_close"]
            .pct_change().rolling(20).std().iloc[-1] or 0.005
        )
        sl_dist = rv * price
        tp_dist = 2.0 * sl_dist
        sl = price - sl_dist if direction == "LONG" else price + sl_dist
        tp = price + tp_dist if direction == "LONG" else price - tp_dist

        c_window = ""
        if signal_class == "C" and self._bars_1h is not None:
            c_window = p._c_window_from_1h_date(timestamp, self._bars_1h)

        return EngineSignal(
            timestamp=timestamp,
            direction=direction,
            signal_class=signal_class,
            regime=regime,
            score=score,
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            risk_fraction=self.BASE_RISK.get(signal_class, 0.010),
            c_window=c_window,
            engine="VOLUME",
        )

    # ------------------------------------------------------------------
    def generate_range(
        self, timestamps: pd.DatetimeIndex
    ) -> list[EngineSignal]:
        """Generate signals for a sequence of timestamps."""
        return [s for ts in timestamps if (s := self.generate(ts)) is not None]
