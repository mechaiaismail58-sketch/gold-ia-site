"""EventEdge — intraday 1h C-window strategy with directional logic per window.

Three independent intraday engines, one per C-window:
  - LONDON_FIX (14:00 UTC): momentum confirmation from 13:00 bar
  - NY_OPEN (13:00 UTC): trend momentum from 11:00-12:00 bars
  - LONDON_CLOSE (16:00 UTC): mean reversion vs London session

Each entry is filled at window bar open, exit at close (same bar).
Risk: 1.5% per trade, max 1 event_edge trade/day.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from .volume_engine import EngineSignal


def _atr_1h(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    """ATR over 1h bars, last N periods."""
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(period).mean()
    return float(atr.iloc[-1]) if not atr.empty else float((high - low).mean())


# ---------------------------------------------------------------------------
class EventEdge:
    """Intraday 1h event-driven strategy on C-windows.

    Parameters
    ----------
    bars_1h : pd.DataFrame
        UTC-naive 1h OHLCV indexed by datetime.
    daily_panel : pd.DataFrame
        Daily OHLCV for regime lookup (regimes_train indexed by date).
    regimes_train : pd.Series
        HMM regimes by date (for R4 filter on NY_OPEN).
    gvz_series : pd.Series, optional
        Gold VIX for vol filter (< 25 threshold).
    """

    BASE_RISK: float = 0.015

    WINDOWS = {
        "LONDON_FIX": 14,       # barre 14:00-15:00 UTC
        "NY_OPEN": 13,          # barre 13:00-14:00 UTC
        "LONDON_CLOSE": 16,     # barre 16:00-17:00 UTC
    }

    def __init__(
        self,
        bars_1h: pd.DataFrame,
        daily_panel: pd.DataFrame,
        regimes_train: pd.Series,
        gvz_series: Optional[pd.Series] = None,
    ) -> None:
        self.bars_1h = bars_1h
        self.daily_panel = daily_panel
        self.regimes_train = regimes_train
        self.gvz = gvz_series
        self._last_trade_date: Optional[pd.Timestamp] = None

    # ------------------------------------------------------------------
    def _get_bars_for_date(self, ts: pd.Timestamp) -> pd.DataFrame:
        """Return all 1h bars for a given trading date."""
        day = ts.normalize()
        mask = (self.bars_1h.index >= day) & (self.bars_1h.index < day + pd.Timedelta(days=1))
        return self.bars_1h.loc[mask]

    def _london_fix(self, ts: pd.Timestamp) -> Optional[EngineSignal]:
        """LONDON_FIX (14:00 UTC): momentum from 13:00 bar."""
        bars = self._get_bars_for_date(ts)
        if len(bars) < 14:
            return None
        # Find 13:00 and 14:00 bars
        bar_13 = bars[bars.index.hour == 13]
        bar_14 = bars[bars.index.hour == 14]
        if bar_13.empty or bar_14.empty:
            return None
        o13, c13 = float(bar_13.iloc[0]["open"]), float(bar_13.iloc[0]["close"])
        o14, c14, h14, l14 = (float(bar_14.iloc[0]["open"]), float(bar_14.iloc[0]["close"]),
                              float(bar_14.iloc[0]["high"]), float(bar_14.iloc[0]["low"]))
        atr = _atr_1h(bars["high"], bars["low"], bars["close"])
        # Filter: |c13 - o13| > 0.3 × ATR
        if abs(c13 - o13) < 0.3 * atr:
            return None
        direction = "LONG" if c13 > o13 else "SHORT"
        sl_dist = 0.8 * atr
        tp_dist = 0.8 * atr
        sl = o14 - sl_dist if direction == "LONG" else o14 + sl_dist
        tp = o14 + tp_dist if direction == "LONG" else o14 - tp_dist
        # Simulate: entry at o14, exit at c14 (same bar)
        rr_realized = 1.0   # placeholder; will be updated after bar close
        return EngineSignal(
            timestamp=ts,
            direction=direction,
            signal_class="B",
            regime=self.regimes_train.get(ts.normalize(), 2) if ts.normalize() in self.regimes_train.index else 2,
            score=float(abs(c13 - o13) / atr * 100),
            entry_price=o14,
            stop_loss=sl,
            take_profit=tp,
            risk_fraction=self.BASE_RISK,
            c_window="LONDON_FIX",
            engine="EVENT",
        )

    def _ny_open(self, ts: pd.Timestamp) -> Optional[EngineSignal]:
        """NY_OPEN (13:00 UTC): momentum from 11:00-12:00 bars, R4 filter."""
        bars = self._get_bars_for_date(ts)
        if len(bars) < 14:
            return None
        regime = self.regimes_train.get(ts.normalize(), 2) if ts.normalize() in self.regimes_train.index else 2
        if regime == 4:
            return None
        bar_11 = bars[bars.index.hour == 11]
        bar_12 = bars[bars.index.hour == 12]
        bar_13 = bars[bars.index.hour == 13]
        if bar_11.empty or bar_13.empty:
            return None
        o11, c12 = float(bar_11.iloc[0]["open"]), float(bar_12.iloc[-1]["close"] if not bar_12.empty else bar_11.iloc[0]["close"])
        o13 = float(bar_13.iloc[0]["open"])
        atr = _atr_1h(bars["high"], bars["low"], bars["close"])
        direction = "LONG" if c12 > o11 else "SHORT"
        sl_dist = 1.0 * atr
        tp_dist = 1.0 * atr
        sl = o13 - sl_dist if direction == "LONG" else o13 + sl_dist
        tp = o13 + tp_dist if direction == "LONG" else o13 - tp_dist
        return EngineSignal(
            timestamp=ts,
            direction=direction,
            signal_class="B",
            regime=regime,
            score=float(abs(c12 - o11) / atr * 100),
            entry_price=o13,
            stop_loss=sl,
            take_profit=tp,
            risk_fraction=self.BASE_RISK,
            c_window="NY_OPEN",
            engine="EVENT",
        )

    def _london_close(self, ts: pd.Timestamp) -> Optional[EngineSignal]:
        """LONDON_CLOSE (16:00 UTC): mean reversion vs London session open (08:00)."""
        bars = self._get_bars_for_date(ts)
        if len(bars) < 14:
            return None
        bar_08 = bars[bars.index.hour == 8]
        bar_15 = bars[bars.index.hour == 15]
        bar_16 = bars[bars.index.hour == 16]
        if bar_08.empty or bar_15.empty or bar_16.empty:
            return None
        o08, c15 = float(bar_08.iloc[0]["open"]), float(bar_15.iloc[0]["close"])
        o16 = float(bar_16.iloc[0]["open"])
        atr = _atr_1h(bars["high"], bars["low"], bars["close"])
        # Mean reversion: if London session went up (c15 > o08) → SHORT, vice versa
        session_move = c15 - o08
        direction = "SHORT" if session_move > 0 else "LONG"
        sl_dist = 0.6 * atr
        tp_dist = 0.6 * atr
        sl = o16 + sl_dist if direction == "LONG" else o16 - sl_dist
        tp = o16 - tp_dist if direction == "LONG" else o16 + tp_dist
        return EngineSignal(
            timestamp=ts,
            direction=direction,
            signal_class="B",
            regime=self.regimes_train.get(ts.normalize(), 2) if ts.normalize() in self.regimes_train.index else 2,
            score=float(abs(session_move) / atr * 100),
            entry_price=o16,
            stop_loss=sl,
            take_profit=tp,
            risk_fraction=self.BASE_RISK,
            c_window="LONDON_CLOSE",
            engine="EVENT",
        )

    # ------------------------------------------------------------------
    def generate(self, timestamp: pd.Timestamp) -> Optional[EngineSignal]:
        """Generate a signal for this timestamp (daily level).

        At most one event_edge trade per day.
        Check GVZ < 25.
        """
        if self._last_trade_date == timestamp.normalize():
            return None   # Already fired for this day

        # GVZ filter
        if self.gvz is not None:
            gvz_val = self.gvz.get(timestamp.normalize(), 25.0) if timestamp.normalize() in self.gvz.index else 25.0
            if gvz_val >= 25.0:
                return None

        # Try each window in order
        for signal_gen in [self._london_fix, self._ny_open, self._london_close]:
            sig = signal_gen(timestamp)
            if sig is not None:
                self._last_trade_date = timestamp.normalize()
                return sig
        return None

    def generate_range(self, timestamps: pd.DatetimeIndex) -> list[EngineSignal]:
        """Generate signals across a date range."""
        return [s for ts in timestamps if (s := self.generate(ts)) is not None]
