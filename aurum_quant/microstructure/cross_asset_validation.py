#!/usr/bin/env python
"""ÉTAPE D: Test VPIN on different assets to detect data mining artifacts."""
from __future__ import annotations

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import logging
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

from aurum_quant.microstructure.vpin import VPINCalculator
from aurum_quant.microstructure.block_bootstrap_test import BlockBootstrapTester

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
log = logging.getLogger(__name__)


class CrossAssetValidator:
    """Test VPIN on multiple assets to detect data-mining artifacts."""

    def __init__(self, bucket_volume: float = 20_000, days: int = 7):
        """
        Args:
            bucket_volume: Volume per bucket
            days: Days of 1-minute data to fetch
        """
        self.bucket_volume = bucket_volume
        self.days = days
        self.vpin_calc = VPINCalculator(bucket_volume=bucket_volume, n_buckets=50)
        self.bb_tester = BlockBootstrapTester(block_size=60)

    def fetch_1min_data(self, ticker: str) -> pd.DataFrame | None:
        """Fetch 1-minute OHLCV data from yfinance."""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.days)

            data = yf.download(
                ticker,
                start=start_date,
                end=end_date,
                interval="1m",
                progress=False,
            )

            if data.empty:
                log.warning(f"  {ticker}: No data returned")
                return None

            # Flatten MultiIndex if present
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = [col[0].lower() for col in data.columns]

            data = data.reset_index()
            cols_lower = {col: col.lower() for col in data.columns}
            data.rename(columns=cols_lower, inplace=True)

            # Find datetime column
            ts_col = None
            for col in data.columns:
                if "date" in col.lower() or "time" in col.lower():
                    ts_col = col
                    break

            if ts_col:
                data.rename(columns={ts_col: "timestamp_utc"}, inplace=True)

            data = data[["timestamp_utc", "open", "high", "low", "close", "volume"]]
            data["timestamp_utc"] = pd.to_datetime(data["timestamp_utc"])

            if data["timestamp_utc"].dt.tz is not None:
                data["timestamp_utc"] = data["timestamp_utc"].dt.tz_localize(None)

            log.info(f"  {ticker}: {len(data)} bars, {data['timestamp_utc'].min()} → {data['timestamp_utc'].max()}")
            return data

        except Exception as e:
            log.warning(f"  {ticker} failed: {e}")
            return None

    def test_asset(self, ticker: str) -> dict:
        """Test VPIN on a single asset."""
        log.info(f"\nTesting {ticker}...")
        data = self.fetch_1min_data(ticker)

        if data is None:
            return {"ticker": ticker, "error": "No data"}

        # Calculate VPIN
        data["vpin"] = self.vpin_calc.calculate_vpin(data)

        # Generate signals (top 10%)
        percentile = 90
        threshold = data["vpin"].quantile(percentile / 100)
        data["signal"] = (data["vpin"] >= threshold).astype(int)

        # Calculate forward returns
        for horizon in [5, 15, 30, 60]:
            fwd_close = data["close"].shift(-horizon)
            data[f"fwd_ret_{horizon}m"] = ((fwd_close - data["close"]) / data["close"] * 100).fillna(np.nan)

        # Block bootstrap test
        results = {}
        for horizon in [5, 15, 30, 60]:
            ret_col = f"fwd_ret_{horizon}m"
            signal = data["signal"].values
            returns = data[ret_col].values

            bb_result = self.bb_tester.run_block_bootstrap_test(signal, returns, n_perms=1000, seed=42)
            results[horizon] = bb_result

        return {
            "ticker": ticker,
            "n_bars": len(data),
            "vpin_stats": {
                "mean": data["vpin"].mean(),
                "std": data["vpin"].std(),
                "min": data["vpin"].min(),
                "max": data["vpin"].max(),
            },
            "signal_count": data["signal"].sum(),
            "results": results,
        }

    def run_validation(self, tickers: list[str]) -> dict:
        """Test VPIN on multiple assets."""
        log.info("=" * 80)
        log.info("CROSS-ASSET VPIN VALIDATION")
        log.info("=" * 80)

        all_results = {}
        for ticker in tickers:
            result = self.test_asset(ticker)
            all_results[ticker] = result

        # Summary
        log.info("\n" + "=" * 80)
        log.info("SUMMARY")
        log.info("=" * 80)
        for ticker, result in all_results.items():
            if "error" in result:
                log.info(f"{ticker}: ERROR - {result['error']}")
            else:
                log.info(f"\n{ticker}:")
                for horizon in [5, 15, 30, 60]:
                    r = result["results"][horizon]
                    hr = r["real_hr"] * 100 if not np.isnan(r["real_hr"]) else np.nan
                    p = r["p_value"]
                    sig = "✓ SIG" if p < 0.05 else "✗ NOT"
                    log.info(f"  {horizon}m: HR={hr:5.1f}% | p={p:.3f} | {sig}")

        return all_results


if __name__ == "__main__":
    validator = CrossAssetValidator(bucket_volume=20_000, days=7)

    # Test on gold (expected to show artifact from bias correction)
    # and other assets (should NOT show edge if artifact-based)
    tickers = ["GC=F", "EURUSD=X", "ES=F"]  # Gold, EURUSD, S&P500 futures

    results = validator.run_validation(tickers)
