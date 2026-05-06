#!/usr/bin/env python
"""ÉTAPE 1: Collect historical gold news from GDELT Project (2020-2025)."""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timedelta
import logging
import time

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import requests
from urllib.parse import urlencode

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class GDELTCollector:
    """Collect gold-related news from GDELT Project (free, unlimited, 1979+)."""

    def __init__(self):
        """Initialize GDELT collector."""
        self.base_url = "https://api.gdeltproject.org/api/v2/doc/doc"
        self.request_count = 0
        self.last_request_time = None

    def _rate_limit(self, delay_sec: float = 1.0):
        """Respect rate limiting (GDELT is free, be conservative)."""
        if self.last_request_time:
            elapsed = (datetime.now() - self.last_request_time).total_seconds()
            if elapsed < delay_sec:
                time.sleep(delay_sec - elapsed)
        self.last_request_time = datetime.now()

    def fetch_date_range(
        self, start_date: datetime, end_date: datetime, max_results: int = 250
    ) -> pd.DataFrame | None:
        """
        Fetch news for a date range from GDELT.

        Args:
            start_date: Start date (inclusive)
            end_date: End date (exclusive)
            max_results: Max results per query (GDELT max: 250)

        Returns:
            DataFrame with [timestamp, title, source, tone, url] or None if error
        """
        self._rate_limit(delay_sec=1.0)

        try:
            # GDELT query: gold-related news with financial/commodity focus
            query = (
                "(gold OR XAU OR bullion OR \"precious metal\") AND "
                "(price OR market OR trade OR \"central bank\" OR Fed OR inflation OR \"real rate\")"
            )

            params = {
                "query": query,
                "mode": "artlist",
                "maxrecords": max_results,
                "format": "json",
                "startdatetime": start_date.strftime("%Y%m%d%H%M%S"),
                "enddatetime": end_date.strftime("%Y%m%d%H%M%S"),
            }

            url = f"{self.base_url}?{urlencode(params)}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            self.request_count += 1

            data = response.json()

            if "articles" not in data or not data["articles"]:
                log.debug(f"  No articles for {start_date.date()} → {end_date.date()}")
                return None

            articles = data["articles"]
            log.info(
                f"  {start_date.date()} → {end_date.date()}: {len(articles)} articles "
                f"(total so far: {self.request_count} requests)"
            )

            # Parse articles
            parsed = []
            for article in articles:
                try:
                    parsed.append(
                        {
                            "timestamp_utc": pd.to_datetime(article["publishdate"]),
                            "title": article["title"][:500],  # Truncate long titles
                            "source": article["source"][:100],
                            "tone": float(article["tone"]) if "tone" in article else None,
                            "url": article["url"],
                        }
                    )
                except (KeyError, ValueError) as e:
                    log.debug(f"    Skipped article: {e}")
                    continue

            if not parsed:
                return None

            return pd.DataFrame(parsed)

        except Exception as e:
            log.error(f"  Failed to fetch {start_date.date()}: {e}")
            return None

    def download_historical(
        self, start_date: datetime, end_date: datetime, output_path: Path | None = None
    ) -> pd.DataFrame:
        """
        Download gold news for full date range in monthly chunks.

        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            output_path: Path to save parquet file

        Returns:
            Combined DataFrame
        """
        if output_path is None:
            output_path = Path(__file__).parent.parent / "aurum_quant" / "data" / "cache" / "news"

        output_path.mkdir(parents=True, exist_ok=True)

        log.info("=" * 80)
        log.info("GDELT GOLD NEWS COLLECTION (2020-2025)")
        log.info("=" * 80)
        log.info(f"\nTarget: {start_date.date()} → {end_date.date()}")
        log.info(f"Query: (gold OR XAU OR bullion) AND (price OR market OR Fed OR inflation)")

        all_data = []
        current_date = start_date

        while current_date < end_date:
            # Fetch month by month
            chunk_end = min(current_date + timedelta(days=30), end_date + timedelta(days=1))

            df_chunk = self.fetch_date_range(current_date, chunk_end)

            if df_chunk is not None and len(df_chunk) > 0:
                all_data.append(df_chunk)

            current_date = chunk_end

        if not all_data:
            raise ValueError("No articles downloaded")

        # Combine and deduplicate
        df_full = pd.concat(all_data, ignore_index=True)
        df_full = df_full.sort_values("timestamp_utc").drop_duplicates(subset=["url"]).reset_index(drop=True)

        # Save
        output_file = output_path / "gdelt_gold.parquet"
        df_full.to_parquet(output_file, index=False)

        log.info("\n" + "=" * 80)
        log.info("COLLECTION COMPLETE")
        log.info("=" * 80)
        log.info(f"\nFile: {output_file}")
        log.info(f"Total articles: {len(df_full):,}")
        log.info(f"Date range: {df_full['timestamp_utc'].min()} → {df_full['timestamp_utc'].max()}")
        log.info(f"Sources: {df_full['source'].nunique()} unique")
        log.info(f"\nTop sources:")
        for source, count in df_full["source"].value_counts().head(10).items():
            log.info(f"  {source}: {count}")

        log.info(f"\nTone distribution (GDELT -10 to +10):")
        if df_full["tone"].notna().any():
            log.info(f"  Mean: {df_full['tone'].mean():.2f}")
            log.info(f"  Std:  {df_full['tone'].std():.2f}")
            log.info(f"  Min:  {df_full['tone'].min():.2f}")
            log.info(f"  Max:  {df_full['tone'].max():.2f}")

        return df_full


if __name__ == "__main__":
    collector = GDELTCollector()

    # Download 2020-01-01 to 2026-05-01
    df = collector.download_historical(
        start_date=datetime(2020, 1, 1), end_date=datetime(2026, 5, 1)
    )

    log.info(f"\n✓ Collected {len(df):,} articles successfully.")
