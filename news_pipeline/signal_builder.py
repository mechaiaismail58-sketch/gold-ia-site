#!/usr/bin/env python
"""ÉTAPE 3: Build daily news signal from LLM-analyzed headlines."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import logging
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class NewsSignalBuilder:
    """Aggregate daily news signals from LLM analysis."""

    MAGNITUDE_FACTOR = {"SMALL": 1, "MEDIUM": 2, "LARGE": 4}
    DIRECTION_SIGN = {"LONG": 1, "SHORT": -1, "NEUTRAL": 0}

    def build_daily_signals(self, df_analyzed: pd.DataFrame, output_path: Path | None = None) -> pd.DataFrame:
        """
        Build daily aggregated news signals.

        For each trading day:
        - daily_score = sum(sign * magnitude * confidence) / sum(magnitude * confidence)
        - news_count, intensity, polarization, etc.

        Args:
            df_analyzed: DataFrame from llm_analyzer (with llm_direction, llm_magnitude, etc.)
            output_path: Where to save daily signals

        Returns:
            DataFrame with one row per trading day
        """
        if output_path is None:
            output_path = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news"

        output_path.mkdir(parents=True, exist_ok=True)

        log.info("=" * 80)
        log.info("DAILY NEWS SIGNAL AGGREGATION")
        log.info("=" * 80)

        # Prepare data
        df = df_analyzed.copy()
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"])

        # Extract date (UTC midnight)
        df["date"] = df["timestamp_utc"].dt.normalize()

        # Compute weights for each article
        df["magnitude_factor"] = df["llm_magnitude"].map(self.MAGNITUDE_FACTOR).fillna(1)
        df["direction_sign"] = df["llm_direction"].map(self.DIRECTION_SIGN).fillna(0)
        df["weight"] = df["llm_confidence"] * df["magnitude_factor"]

        log.info(f"\nProcessing {len(df):,} articles from {df['date'].min()} to {df['date'].max()}")

        # Aggregate by date
        daily_signals = []

        for date, group in df.groupby("date"):
            if len(group) == 0:
                continue

            # Weighted directional score
            numerator = (group["direction_sign"] * group["weight"]).sum()
            denominator = group["weight"].sum()

            if denominator > 0:
                daily_score = numerator / denominator
            else:
                daily_score = 0.0

            # Signal features
            features = {
                "date": date,
                "daily_score": np.clip(daily_score, -1, 1),  # Clip to [-1, 1]
                "news_count_24h": len(group),
                "news_intensity": group["weight"].sum(),
                "news_polarization": group["direction_sign"].std(),
                "large_news_count": (group["llm_magnitude"] == "LARGE").sum(),
                "fed_news_count": group["source"].str.contains("Federal Reserve", case=False, na=False).sum(),
                "mean_confidence": group["llm_confidence"].mean(),
                "long_news": (group["direction_sign"] == 1).sum(),
                "short_news": (group["direction_sign"] == -1).sum(),
                "neutral_news": (group["direction_sign"] == 0).sum(),
            }

            daily_signals.append(features)

        df_daily = pd.DataFrame(daily_signals)

        # Save
        output_file = output_path / "daily_news_signal.csv"
        df_daily.to_csv(output_file, index=False)

        log.info(f"\n✓ Built {len(df_daily)} trading days of signals")
        log.info(f"File: {output_file}")
        log.info(f"\ndaily_score statistics:")
        log.info(f"  Mean: {df_daily['daily_score'].mean():.3f}")
        log.info(f"  Std:  {df_daily['daily_score'].std():.3f}")
        log.info(f"  Min:  {df_daily['daily_score'].min():.3f}")
        log.info(f"  Max:  {df_daily['daily_score'].max():.3f}")

        log.info(f"\nnews_count_24h statistics:")
        log.info(f"  Mean: {df_daily['news_count_24h'].mean():.1f} articles/day")
        log.info(f"  Max:  {df_daily['news_count_24h'].max()}")

        log.info(f"\nREADY FOR ÉTAPE 4: Train/OOS split and edge testing")

        return df_daily


if __name__ == "__main__":
    # Load analyzed news
    analyzed_file = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news" / "gdelt_gold_analyzed.csv"

    if not analyzed_file.exists():
        log.error(f"Analyzed news file not found: {analyzed_file}")
        log.info("Run llm_analyzer.py first")
        sys.exit(1)

    log.info(f"Loading analyzed news from {analyzed_file}")
    df = pd.read_csv(analyzed_file)

    builder = NewsSignalBuilder()
    df_daily = builder.build_daily_signals(df)
