#!/usr/bin/env python
"""ÉTAPE 1: Download 2 years of 1-minute XAU/USD via Twelve Data API."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import logging
import time

sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class TwelveDataDownloader:
    """Download 1-minute data from Twelve Data API with rate-limit handling."""

    def __init__(self, api_key: str | None = None):
        """
        Args:
            api_key: Twelve Data API key. If None, uses TWELVE_DATA_API_KEY env var.
                    Free tier: 800 requests/day, 5 req/min
        """
        self.api_key = api_key or os.environ.get("TWELVE_DATA_API_KEY")
        if not self.api_key:
            raise ValueError("TWELVE_DATA_API_KEY not set. Get free key at https://twelvedata.com/")

        self.base_url = "https://api.twelvedata.com/time_series"
        self.request_count = 0
        self.request_time_start = datetime.now()

    def _rate_limit_check(self):
        """Ensure we don't exceed rate limit (5 req/min)."""
        elapsed = (datetime.now() - self.request_time_start).total_seconds()
        if elapsed < 60 and self.request_count >= 5:
            sleep_time = 60 - elapsed + 1
            log.warning(f"  Rate limit: sleeping {sleep_time:.1f}s before next request")
            time.sleep(sleep_time)
            self.request_count = 0
            self.request_time_start = datetime.now()

    def fetch_date_range(self, start_date: datetime, end_date: datetime) -> pd.DataFrame | None:
        """Fetch 1-minute data for a date range (max ~3-4 days per request)."""
        self._rate_limit_check()

        try:
            params = {
                "symbol": "XAU/USD",
                "interval": "1min",
                "start_date": start_date.strftime("%Y-%m-%d %H:%M"),
                "end_date": end_date.strftime("%Y-%m-%d %H:%M"),
                "apikey": self.api_key,
            }

            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()

            self.request_count += 1

            data = response.json()

            if "data" not in data or not data["data"]:
                log.warning(f"  No data for {start_date.date()} → {end_date.date()}")
                return None

            df = pd.DataFrame(data["data"])
            df["datetime"] = pd.to_datetime(df["datetime"])

            if df["datetime"].dt.tz is not None:
                df["datetime"] = df["datetime"].dt.tz_localize(None)

            # Convert string columns to float
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")

            df = df.sort_values("datetime").reset_index(drop=True)

            log.info(f"  Fetched {len(df)} bars: {df['datetime'].min()} → {df['datetime'].max()}")
            return df

        except Exception as e:
            log.error(f"  Failed to fetch {start_date.date()}: {e}")
            return None

    def download_2year_data(self, end_date: datetime | None = None, output_dir: Path = None) -> pd.DataFrame:
        """
        Download 2 years of 1-minute data in monthly chunks.

        Args:
            end_date: End date (default: today)
            output_dir: Directory to save monthly parquet files

        Returns:
            Combined DataFrame for full 2-year period
        """
        if end_date is None:
            end_date = datetime.now()

        if output_dir is None:
            output_dir = Path(__file__).parent / "aurum_quant" / "data" / "cache" / "intraday"

        output_dir.mkdir(parents=True, exist_ok=True)

        start_date = end_date - timedelta(days=365 * 2)

        log.info("=" * 80)
        log.info("DOWNLOADING 2-YEAR 1-MINUTE XAU/USD DATA")
        log.info("=" * 80)
        log.info(f"\nTarget: {start_date.date()} → {end_date.date()}")
        log.info(f"API key: {'***' + self.api_key[-4:] if self.api_key else 'None'}")
        log.info(f"Rate limit: 5 req/min (free tier)")

        all_data = []
        current_date = start_date

        month_count = 0
        total_months = 24

        while current_date < end_date:
            month_count += 1
            # Fetch 3-day chunks to stay under Twelve Data 5000-bar limit
            chunk_end = min(current_date + timedelta(days=3), end_date)

            log.info(f"\n[{month_count:2d}/{total_months}] Fetching {current_date.date()} → {chunk_end.date()}...")

            df_chunk = self.fetch_date_range(current_date, chunk_end)

            if df_chunk is not None and len(df_chunk) > 0:
                all_data.append(df_chunk)

                # Save monthly checkpoint
                month_str = current_date.strftime("%Y-%m")
                month_file = output_dir / f"ohlcv_1min_{month_str}.parquet"
                df_chunk.to_parquet(month_file, index=False)
                log.info(f"  Checkpoint saved: {month_file}")

            current_date = chunk_end + timedelta(seconds=1)

        if not all_data:
            raise ValueError("No data downloaded")

        # Combine all chunks
        df_full = pd.concat(all_data, ignore_index=True)
        df_full = df_full.sort_values("datetime").drop_duplicates(subset=["datetime"]).reset_index(drop=True)

        # Save combined file
        combined_file = output_dir / "ohlcv_1min_2year.parquet"
        df_full.to_parquet(combined_file, index=False)

        log.info("\n" + "=" * 80)
        log.info("DOWNLOAD COMPLETE")
        log.info("=" * 80)
        log.info(f"\nCombined file: {combined_file}")
        log.info(f"Total bars: {len(df_full):,}")
        log.info(f"Date range: {df_full['datetime'].min()} → {df_full['datetime'].max()}")
        log.info(f"Volume: {df_full['volume'].sum():,.0f}")
        log.info(f"Gaps: {df_full['datetime'].diff().dt.total_seconds().max() / 60:.0f} min max gap")

        return df_full


if __name__ == "__main__":
    downloader = TwelveDataDownloader()
    df = downloader.download_2year_data()
