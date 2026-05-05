"""MeanReversionSniper — Kalman fair-value gap + RSI reversal engine.

Entry conditions (all must be true):
  1. |kalman_gap_sigma| > 2.5  (price far from Kalman fair value)
  2. RSI_14 > 75 (overbought) OR RSI_14 < 25 (oversold)
  3. Regime != R4  (R4 is natively mean-reverting; filter to avoid regime noise)
  4. Direction = return toward fair value
     - gap > 0 (price above FV) + RSI > 75 → SHORT
     - gap < 0 (price below FV) + RSI < 25 → LONG

Exit:
  - TP : Kalman fair-value price (not 2×SL — reverts to fair value)
  - SL : entry ± 1×ATR_14

Risk profile : 2.5% per signal.
Signal target : 2-3 signals / month.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from .volume_engine import EngineSignal
from ... import config


def _rsi(prices: pd.Series, period: int = 14) -> float:
    """Compute RSI at the last bar of *prices*."""
    delta = prices.diff().dropna()
    if len(delta) < period:
        return 50.0
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100.0 - 100.0 / (1.0 + rs)
    return float(rsi.iloc[-1]) if not rsi.empty else 50.0


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    """Average True Range over *period* bars."""
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()
    return float(atr.iloc[-1]) if not atr.empty else float((high - low).mean())


# ---------------------------------------------------------------------------
GAP_MIN_SIGMA: float = 2.5    # minimum |kalman_gap_sigma| to trigger
RSI_OB: float = 75.0           # overbought threshold
RSI_OS: float = 25.0           # oversold threshold
BASE_RISK: float = 0.025


class MeanReversionSniper:
    """Kalman gap + RSI mean-reversion engine.

    Parameters
    ----------
    pipeline : Pipeline
        Fully initialised pipeline (steps 1-10 complete).
    rsi_period : int
        RSI lookback period (default 14).
    atr_period : int
        ATR lookback period for SL sizing (default 14).
    """

    def __init__(self, pipeline, rsi_period: int = 14, atr_period: int = 14) -> None:
        self._p = pipeline
        self._rsi_period = rsi_period
        self._atr_period = atr_period

    # ------------------------------------------------------------------
    def generate(self, timestamp: pd.Timestamp) -> Optional[EngineSignal]:
        p = self._p
        if timestamp not in p._wf_features.index:
            return None

        feat_row = p._wf_features.loc[timestamp]
        regime = int(
            p.regimes_train.reindex([timestamp]).ffill().iloc[0]
            if timestamp in p.regimes_train.index else 2
        )

        # Condition 3: block R4 (natively mean-reverting, signal noise)
        if regime == 4:
            return None

        gap = float(feat_row.get("kalman_gap_sigma", 0.0))

        # Condition 1: strong Kalman deviation
        if abs(gap) < GAP_MIN_SIGMA:
            return None

        # Compute RSI on recent close prices
        price_series = p.panel.loc[:timestamp, "gold_close"].astype(float)
        if len(price_series) < self._rsi_period + 5:
            return None
        rsi_val = _rsi(price_series.tail(self._rsi_period * 3), self._rsi_period)

        # Condition 2 + direction
        # gap > 0 → price above fair value → look for SHORT (RSI overbought)
        # gap < 0 → price below fair value → look for LONG (RSI oversold)
        if gap > 0 and rsi_val > RSI_OB:
            direction = "SHORT"
        elif gap < 0 and rsi_val < RSI_OS:
            direction = "LONG"
        else:
            return None

        price = float(price_series.iloc[-1])

        # TP: Kalman fair-value price
        # gap_sigma = (log_price - fair_value) / sigma → fair_value = log_price - gap * sigma
        # We use 20d rolling σ as the σ proxy
        log_prices = np.log(price_series.tail(100))
        sigma_proxy = float(log_prices.diff().std() or 0.005)
        log_fv = float(log_prices.iloc[-1]) - gap * sigma_proxy
        fair_value_price = float(np.exp(log_fv))

        # SL: 1×ATR_14 from entry
        ohlc = p.panel.loc[:timestamp, ["gold_high", "gold_low", "gold_close"]].tail(self._atr_period + 5)
        atr_val = _atr(ohlc["gold_high"], ohlc["gold_low"], ohlc["gold_close"], self._atr_period)
        if atr_val < 1e-6:
            return None

        if direction == "LONG":
            sl = price - atr_val
            tp = min(fair_value_price, price + 2.0 * atr_val)   # cap TP at 2×ATR if FV is far
        else:
            sl = price + atr_val
            tp = max(fair_value_price, price - 2.0 * atr_val)

        # Sanity check: TP must be in the right direction
        if direction == "LONG" and tp <= price:
            return None
        if direction == "SHORT" and tp >= price:
            return None

        return EngineSignal(
            timestamp=timestamp,
            direction=direction,
            signal_class="B",   # all MRS signals treated as Class B risk
            regime=regime,
            score=float(abs(gap) * 10 + (rsi_val - 50) * 0.5),
            entry_price=price,
            stop_loss=sl,
            take_profit=tp,
            risk_fraction=BASE_RISK,
            c_window="",
            engine="MRS",
        )

    # ------------------------------------------------------------------
    def generate_range(self, timestamps: pd.DatetimeIndex) -> list[EngineSignal]:
        return [s for ts in timestamps if (s := self.generate(ts)) is not None]
