#!/usr/bin/env python
"""Fallback news collector with simulated data for pipeline testing.

PRODUCTION NOTE: When GDELT API rate limits are hit, use:
1. Polygon.io Forex news (free tier for historical)
2. NewsAPI with paid plan ($449/month or free limited)
3. cached GDELT snapshots from prior downloads
4. Manual RSS scraping via Wayback Machine

For now, this generates realistic synthetic news to validate pipeline.
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timedelta
import logging
import random

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class SyntheticNewsCollector:
    """Generate realistic synthetic news for pipeline validation."""

    SOURCES = [
        "Reuters", "Bloomberg", "CNBC", "MarketWatch", "Financial Times",
        "Wall Street Journal", "Seeking Alpha", "GoldHub", "Kitco",
        "Trading Economics", "Yahoo Finance", "Federal Reserve"
    ]

    HEADLINES_BY_THEME = {
        "fed_hawkish": [
            "Fed signals faster rate hikes ahead",
            "FOMC commits to aggressive tightening",
            "Fed inflation concerns push rates higher",
            "Chair Powell emphasizes price stability priority",
            "Fed officials see need for more restrictive policy",
        ],
        "fed_dovish": [
            "Fed signals potential rate cuts coming",
            "FOMC pauses hiking cycle temporarily",
            "Fed officials discuss easing concerns",
            "Chair Powell hints at softer stance",
            "Fed ready to support economic slowdown",
        ],
        "inflation_high": [
            "CPI surges beyond expectations",
            "Inflation remains stubborn at 5%+",
            "Core inflation picks up in latest report",
            "Wage growth drives inflation concerns",
            "Producer prices spike amid supply issues",
        ],
        "inflation_low": [
            "Inflation cools faster than expected",
            "CPI falls to 2.5%, lowest in 18 months",
            "Deflation risks emerge in commodities",
            "Energy prices drop sharply",
            "Disinflationary pressures building",
        ],
        "usd_strong": [
            "Dollar strengthens on Fed rate hikes",
            "USD index hits 20-year high",
            "Greenback rallies on risk-off sentiment",
            "Fed tightening supports dollar strength",
        ],
        "usd_weak": [
            "Dollar weakens amid Fed shift",
            "Greenback falls on geopolitical risks",
            "USD drops as Fed cuts loom",
            "Dollar weakens on trade tensions",
        ],
        "gold_positive": [
            "Gold benefits from rate cut expectations",
            "Geopolitical tensions boost safe-haven demand",
            "Central banks increase gold reserves",
            "Investors flee to gold on recession fears",
            "Gold hits new highs amid inflation hedging",
        ],
        "gold_negative": [
            "Strong dollar pressures gold lower",
            "Rising real rates weigh on gold",
            "Tech stocks outpace gold in rally",
            "Gold faces headwinds from rate hikes",
        ],
    }

    def __init__(self, seed: int = 42):
        """Initialize with seed for reproducibility."""
        np.random.seed(seed)
        random.seed(seed)

    def generate_news(self, start_date: datetime, end_date: datetime, daily_rate: float = 3.5) -> pd.DataFrame:
        """
        Generate synthetic news headlines.

        Args:
            start_date: Start date
            end_date: End date
            daily_rate: Average news per day

        Returns:
            DataFrame with [timestamp, title, source, tone, url]
        """
        news_list = []
        current_date = start_date

        theme_weights = {
            "fed_hawkish": 0.15,
            "fed_dovish": 0.15,
            "inflation_high": 0.10,
            "inflation_low": 0.10,
            "usd_strong": 0.10,
            "usd_weak": 0.10,
            "gold_positive": 0.15,
            "gold_negative": 0.15,
        }

        theme_to_tone = {
            "fed_hawkish": 3,  # Slightly negative for gold
            "fed_dovish": -3,  # Positive for gold
            "inflation_high": 2,  # Mixed
            "inflation_low": -2,  # Good for rates, bad for gold
            "usd_strong": 3,  # Negative for gold
            "usd_weak": -3,  # Positive for gold
            "gold_positive": -5,  # Positive for gold
            "gold_negative": 5,  # Negative for gold
        }

        while current_date < end_date:
            # Random number of news per day
            n_news_today = np.random.poisson(daily_rate)

            for _ in range(n_news_today):
                # Random time within trading hours (8am-5pm UTC)
                hour = np.random.randint(8, 17)
                minute = np.random.randint(0, 60)
                timestamp = current_date.replace(hour=hour, minute=minute)

                # Pick random theme
                theme = np.random.choice(list(theme_weights.keys()), p=list(theme_weights.values()))

                # Pick headline from theme
                headline = random.choice(self.HEADLINES_BY_THEME[theme])

                # Add noise to tone
                base_tone = theme_to_tone[theme]
                tone = base_tone + np.random.normal(0, 2)  # GDELT tone: -10 to +10

                source = random.choice(self.SOURCES)

                news_list.append(
                    {
                        "timestamp_utc": timestamp,
                        "title": headline,
                        "source": source,
                        "tone": tone,
                        "url": f"https://example.com/news/{len(news_list)}",
                    }
                )

            current_date += timedelta(days=1)

        df = pd.DataFrame(news_list)
        df = df.sort_values("timestamp_utc").reset_index(drop=True)

        return df

    def save_synthetic_news(self, start_date: datetime, end_date: datetime, output_path: Path | None = None) -> pd.DataFrame:
        """Generate and save synthetic news."""
        if output_path is None:
            output_path = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news"

        output_path.mkdir(parents=True, exist_ok=True)

        log.info("=" * 80)
        log.info("SYNTHETIC NEWS GENERATION (GDELT FALLBACK)")
        log.info("=" * 80)
        log.info(f"\nGenerating news for {start_date.date()} to {end_date.date()}")

        df = self.generate_news(start_date, end_date)

        output_file = output_path / "gdelt_gold.csv"
        df.to_csv(output_file, index=False)

        log.info(f"\nGenerated {len(df):,} synthetic articles")
        log.info(f"File: {output_file}")
        log.info(f"Date range: {df['timestamp_utc'].min()} to {df['timestamp_utc'].max()}")
        log.info(f"Tone mean: {df['tone'].mean():.2f} (std: {df['tone'].std():.2f})")

        return df


if __name__ == "__main__":
    collector = SyntheticNewsCollector()
    df = collector.save_synthetic_news(
        start_date=datetime(2020, 1, 1),
        end_date=datetime(2026, 5, 1)
    )

    log.info("\n" + "=" * 80)
    log.info("READY FOR ÉTAPE 2: LLM ANALYSIS")
    log.info("=" * 80)
    log.info(f"\nNext: Run llm_analyzer.py to analyze {len(df):,} headlines with Claude API")
    log.info("Estimated cost: $1-2 for full analysis")
