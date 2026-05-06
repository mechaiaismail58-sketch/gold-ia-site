#!/usr/bin/env python
"""Fetch 60+ days of 1-minute OHLCV data for rigorous train/test validation."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import logging
import pandas as pd
from datetime import datetime, timedelta
from aurum_quant.microstructure.data_loader import IntraDayDataLoader

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

log.info("=" * 80)
log.info("FETCHING EXTENDED 1-MINUTE DATA")
log.info("=" * 80)

loader = IntraDayDataLoader()

# Try Twelve Data API (requires TWELVE_DATA_API_KEY env var)
log.info("\nAttempting Twelve Data API (60-day window)...")
data_12d = loader.load_from_twelve_data(api_key=None, days=60)

if data_12d is not None:
    log.info(f"✓ Twelve Data SUCCESS: {len(data_12d)} bars")
    log.info(f"  Time range: {data_12d['timestamp_utc'].min()} → {data_12d['timestamp_utc'].max()}")
    log.info(f"  Volume: {data_12d['volume'].sum():,.0f}")

    # Save for next phase
    cache_path = Path(__file__).parent / "aurum_quant" / "data" / "cache" / "intraday" / "ohlcv_1min_extended.csv"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    data_12d.to_csv(cache_path, index=False)
    log.info(f"  Saved to: {cache_path}")
else:
    log.warning("✗ Twelve Data failed (no API key or error)")
    log.info("\nFallback: using yfinance 7-day data (cached)")
    data_yf = loader.load_cached()
    if data_yf is not None:
        log.info(f"✓ Cached yfinance data: {len(data_yf)} bars")
        log.info(f"  Consider setting TWELVE_DATA_API_KEY to extend to 60+ days")

log.info("\n" + "=" * 80)
log.info("NEXT STEP: ÉTAPE C (Block Bootstrap Permutation Test)")
log.info("=" * 80)
