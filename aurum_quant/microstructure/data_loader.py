"""Data loader for 1-minute OHLCV data — yfinance or Twelve Data API."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np

log = logging.getLogger(__name__)


class IntraDayDataLoader:
    """Load 1-minute OHLCV data for gold (XAUUSD) from yfinance or Twelve Data."""

    def __init__(self, cache_dir: Path = Path(__file__).parent.parent / "data" / "cache" / "intraday"):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def load_from_yfinance(self, days: int = 7) -> Optional[pd.DataFrame]:
        """Fetch 1-minute data from yfinance (GC=F).

        Limitation: yfinance only provides last 7 days of 1-minute data.

        Args:
            days: Number of days to fetch (max 7).

        Returns:
            DataFrame with columns: timestamp_utc, open, high, low, close, volume
        """
        import yfinance as yf
        from datetime import datetime, timedelta

        try:
            log.info(f"  Fetching {days} days of 1-minute data from yfinance (GC=F)...")

            # yfinance limitation: 1-minute data only available for last 7 days
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            data = yf.download(
                "GC=F",
                start=start_date,
                end=end_date,
                interval="1m",
                progress=False,
            )

            if data.empty:
                log.warning("  yfinance returned empty data")
                return None

            # yfinance returns a DataFrame with datetime index and MultiIndex columns (Price, Ticker)
            # Flatten: keep only the Price level (first level of MultiIndex)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = [col[0].lower() for col in data.columns]

            # Convert index to column
            data = data.reset_index()
            data.columns.name = None

            # Normalize column names for the reset datetime index
            cols_lower = {col: col.lower() for col in data.columns}
            data.rename(columns=cols_lower, inplace=True)

            # Map datetime column name (varies: 'datetime', 'date', 'Datetime')
            ts_col = None
            for col in data.columns:
                if 'date' in col.lower() or 'time' in col.lower():
                    ts_col = col
                    break

            if ts_col:
                data.rename(columns={ts_col: "timestamp_utc"}, inplace=True)

            # Select and reorder columns
            data = data[["timestamp_utc", "open", "high", "low", "close", "volume"]]

            # Ensure UTC-naive
            if data["timestamp_utc"].dt.tz is not None:
                data["timestamp_utc"] = data["timestamp_utc"].dt.tz_localize(None)

            log.info(f"  yfinance: {len(data)} rows, {data['timestamp_utc'].min()} → {data['timestamp_utc'].max()}")

            return data

        except Exception as e:
            log.error(f"  yfinance failed: {e}")
            return None

    def load_from_twelve_data(self, api_key: Optional[str] = None, days: int = 30) -> Optional[pd.DataFrame]:
        """Fetch 1-minute data from Twelve Data API (free tier: 800 API calls/day).

        Free tier limitations:
        - 1-minute interval available
        - ~2 years of 1-minute data
        - 800 requests/day (each request = 1 symbol for 1 day)

        To get API key: https://twelvedata.com/
        Free tier gives 800 requests/day.

        Args:
            api_key: Twelve Data API key (or set via TWELVE_DATA_API_KEY env var)
            days: Number of days to fetch (recommend 30 for sufficient data)

        Returns:
            DataFrame with columns: timestamp_utc, open, high, low, close, volume
        """
        import os
        from datetime import datetime, timedelta

        if api_key is None:
            api_key = os.environ.get("TWELVE_DATA_API_KEY")

        if not api_key:
            log.warning("  TWELVE_DATA_API_KEY not set. Get free key at https://twelvedata.com/")
            return None

        try:
            import requests

            log.info(f"  Fetching {days} days of 1-minute data from Twelve Data (XAU/USD)...")

            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            all_data = []

            # Twelve Data returns up to 5000 bars per request
            # 1-minute data = 1440 bars per day, so 5000 bars ≈ 3-4 days
            # We need to fetch in chunks

            current_date = start_date
            while current_date < end_date:
                chunk_end = min(current_date + timedelta(days=3), end_date)

                url = "https://api.twelvedata.com/time_series"
                params = {
                    "symbol": "XAU/USD",
                    "interval": "1min",
                    "start_date": current_date.strftime("%Y-%m-%d"),
                    "end_date": chunk_end.strftime("%Y-%m-%d"),
                    "apikey": api_key,
                }

                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                if "data" not in data or not data["data"]:
                    log.warning(f"  Twelve Data returned no data for {current_date.date()}")
                    current_date = chunk_end
                    continue

                df_chunk = pd.DataFrame(data["data"])
                all_data.append(df_chunk)

                current_date = chunk_end
                log.info(f"    fetched {len(df_chunk)} bars for {current_date.date()}")

            if not all_data:
                log.warning("  Twelve Data returned no data at all")
                return None

            df = pd.concat(all_data, ignore_index=True)

            # Parse datetime and convert to UTC-naive
            df["datetime"] = pd.to_datetime(df["datetime"])
            if df["datetime"].dt.tz is not None:
                df["datetime"] = df["datetime"].dt.tz_localize(None)

            # Rename and standardize
            df.rename(columns={
                "datetime": "timestamp_utc",
                "open": "open",
                "high": "high",
                "low": "low",
                "close": "close",
                "volume": "volume",
            }, inplace=True)

            # Twelve Data returns strings; convert to float
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")

            # Sort by timestamp
            df = df.sort_values("timestamp_utc").reset_index(drop=True)

            log.info(f"  Twelve Data: {len(df)} rows, {df['timestamp_utc'].min()} → {df['timestamp_utc'].max()}")

            return df

        except Exception as e:
            log.error(f"  Twelve Data failed: {e}")
            return None

    def fetch_and_cache(self, source: str = "yfinance", days: int = 7) -> Optional[pd.DataFrame]:
        """Fetch 1-minute data and cache to parquet.

        Args:
            source: "yfinance" or "twelve_data"
            days: Number of days to fetch

        Returns:
            DataFrame or None if fetch failed
        """
        # Try yfinance first (fast, no API key needed)
        if source == "yfinance" or source == "auto":
            data = self.load_from_yfinance(days=min(days, 7))
            if data is not None:
                self._save_parquet(data)
                return data

        # Fall back to Twelve Data
        if source == "twelve_data" or (source == "auto" and data is None):
            data = self.load_from_twelve_data(days=days)
            if data is not None:
                self._save_parquet(data)
                return data

        log.error(f"  Failed to fetch 1-minute data from {source}")
        return None

    def _save_parquet(self, df: pd.DataFrame, filename: str = "ohlcv_1min.csv"):
        """Cache dataframe to CSV (parquet requires pyarrow)."""
        path = self.cache_dir / filename
        df.to_csv(path, index=False)
        log.info(f"  Cached to {path}")

    def load_cached(self, filename: str = "ohlcv_1min.csv") -> Optional[pd.DataFrame]:
        """Load cached CSV file."""
        path = self.cache_dir / filename
        if not path.exists():
            return None
        df = pd.read_csv(path)
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"])
        return df
