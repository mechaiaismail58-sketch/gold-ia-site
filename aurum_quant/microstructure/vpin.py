"""VPIN (Volume-Synchronized Probability of Informed Trading) — Easley-López-O'Hara 2012."""
from __future__ import annotations

import logging
from typing import Optional

import pandas as pd
import numpy as np

log = logging.getLogger(__name__)


class VPINCalculator:
    """
    Compute VPIN using volume bucketing and bulk volume classification.

    Reference: Easley, López de Prado & O'Hara (2012)
    "The Volume Clock: Insights into the High-Frequency Paradigm"

    Key idea:
    - Divide time into volume buckets (fixed cumulative volume)
    - Classify each bar as BUY/SELL using bulk volume classification
    - Estimate P(informed) from directional imbalance in recent windows
    """

    def __init__(self, bucket_volume: float = 1_000_000, n_buckets: int = 50):
        """
        Args:
            bucket_volume: Volume per bucket (in contracts or units)
            n_buckets: Number of recent buckets to use for VPIN window
        """
        self.bucket_volume = bucket_volume
        self.n_buckets = n_buckets

    def classify_bar(self, close: float, prev_close: float) -> int:
        """
        Bulk volume classification (Lee-Ready rule for 1-minute bars).

        Simple heuristic: if close > prev_close, bar is BUY-initiated; else SELL.
        More sophisticated: if close == prev_close, use midpoint comparison or tick rule.

        Args:
            close: Current bar close price
            prev_close: Previous bar close price

        Returns:
            1 for BUY, -1 for SELL, 0 for undefined
        """
        if close > prev_close:
            return 1  # BUY
        elif close < prev_close:
            return -1  # SELL
        else:
            return 0  # Undefined (use tick rule in practice)

    def calculate_vpin(self, df: pd.DataFrame, lookback: Optional[int] = None) -> pd.Series:
        """
        Calculate VPIN for each minute in the dataset.

        Algorithm:
        1. Bucket data into volume buckets (fixed total volume per bucket)
        2. Classify each bar's volume as BUY/SELL based on price direction
        3. Sum BUY/SELL volume per bucket
        4. For each bucket, compute VPIN = abs(buy_vol - sell_vol) / total_vol
           using rolling window of recent buckets

        Args:
            df: DataFrame with columns [timestamp_utc, open, high, low, close, volume]
            lookback: Optional override for window size; if None, use 1/3 of bucket count

        Returns:
            Series indexed by bar (same length as df) with VPIN values [0, 1]
        """
        df = df.copy()
        df.reset_index(drop=True, inplace=True)

        # Step 1: Classify each bar as BUY or SELL
        df["prev_close"] = df["close"].shift(1)
        df.loc[0, "prev_close"] = df.loc[0, "close"]
        df["direction"] = df.apply(
            lambda row: self.classify_bar(row["close"], row["prev_close"]),
            axis=1
        )

        # Assign volumes: BUY vol if direction=1, SELL vol if direction=-1, 0 if neutral
        df["buy_vol"] = df["volume"].where(df["direction"] == 1, 0)
        df["sell_vol"] = df["volume"].where(df["direction"] == -1, 0)

        # Step 2: Bucket assignment based on cumulative volume
        df["cum_volume"] = df["volume"].cumsum()
        df["bucket_id"] = (df["cum_volume"] // self.bucket_volume).astype(int)

        # Step 3: Aggregate volumes by bucket
        bucket_stats = []
        for bid, group in df.groupby("bucket_id", observed=True):
            bucket_stats.append({
                "bucket_id": bid,
                "bucket_buy_vol": group["buy_vol"].sum(),
                "bucket_sell_vol": group["sell_vol"].sum(),
            })
        bucket_stats = pd.DataFrame(bucket_stats)

        n_total_buckets = len(bucket_stats)
        log.info(f"    Bucketing: {len(df)} bars → {n_total_buckets} buckets")

        # Determine sensible lookback if not specified
        if lookback is None:
            lookback = max(1, n_total_buckets // 3)  # 1/3 of total buckets
            log.info(f"    Lookback window: {lookback} buckets (1/3 of {n_total_buckets})")

        # Step 4: Rolling VPIN calculation
        bucket_stats["rolling_buy"] = bucket_stats["bucket_buy_vol"].rolling(
            window=lookback, min_periods=1
        ).sum()
        bucket_stats["rolling_sell"] = bucket_stats["bucket_sell_vol"].rolling(
            window=lookback, min_periods=1
        ).sum()
        bucket_stats["rolling_total"] = bucket_stats["rolling_buy"] + bucket_stats["rolling_sell"]

        # VPIN = |buy - sell| / total_vol
        bucket_stats["vpin"] = (
            (bucket_stats["rolling_buy"] - bucket_stats["rolling_sell"]).abs()
            / bucket_stats["rolling_total"].replace(0, np.nan)
        ).fillna(0.0)

        # Step 5: Map bucket VPIN back to each bar
        bucket_map = dict(zip(bucket_stats["bucket_id"], bucket_stats["vpin"]))
        df["vpin"] = df["bucket_id"].map(bucket_map).fillna(0.0)

        return df["vpin"]

    def calculate_vpin_timeline(
        self, df: pd.DataFrame, lookback: Optional[int] = None
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Calculate VPIN and return both bar-level and bucket-level results.

        Returns:
            (df_with_vpin, bucket_stats)
            - df_with_vpin: Original df + vpin column
            - bucket_stats: Bucket-level summary for diagnostics
        """
        if lookback is None:
            lookback = self.n_buckets

        df = df.copy()
        df.reset_index(drop=True, inplace=True)

        # Classify bars
        df["prev_close"] = df["close"].shift(1)
        df.loc[0, "prev_close"] = df.loc[0, "close"]
        df["direction"] = df.apply(
            lambda row: self.classify_bar(row["close"], row["prev_close"]),
            axis=1
        )

        # Bucket assignment
        df["cum_volume"] = df["volume"].cumsum()
        df["bucket_id"] = (df["cum_volume"] // self.bucket_volume).astype(int)

        # Assign volumes
        df["buy_vol"] = df["volume"].where(df["direction"] == 1, 0)
        df["sell_vol"] = df["volume"].where(df["direction"] == -1, 0)

        # Bucket statistics
        bucket_stats = df.groupby("bucket_id", observed=True).agg({
            "buy_vol": "sum",
            "sell_vol": "sum",
            "timestamp_utc": ["min", "max"],
            "volume": "sum"
        }).reset_index()
        bucket_stats.columns = ["bucket_id", "buy_vol", "sell_vol", "timestamp_first", "timestamp_last", "bucket_volume"]

        bucket_stats = bucket_stats.rename(columns={"buy_vol": "bucket_buy_vol", "sell_vol": "bucket_sell_vol"})

        # Rolling VPIN
        bucket_stats["rolling_buy"] = bucket_stats["bucket_buy_vol"].rolling(
            window=lookback, min_periods=1
        ).sum()
        bucket_stats["rolling_sell"] = bucket_stats["bucket_sell_vol"].rolling(
            window=lookback, min_periods=1
        ).sum()
        bucket_stats["rolling_total"] = bucket_stats["rolling_buy"] + bucket_stats["rolling_sell"]
        bucket_stats["vpin"] = (
            (bucket_stats["rolling_buy"] - bucket_stats["rolling_sell"]).abs()
            / bucket_stats["rolling_total"].replace(0, np.nan)
        ).fillna(0.0)

        # Map to bars
        bucket_vpin_map = bucket_stats[["bucket_id", "vpin"]].set_index("bucket_id")
        df["vpin"] = df["bucket_id"].map(bucket_vpin_map["vpin"]).fillna(0.0)

        return df, bucket_stats
