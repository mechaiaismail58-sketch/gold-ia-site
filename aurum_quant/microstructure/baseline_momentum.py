#!/usr/bin/env python
"""ÉTAPE E: Baseline naive momentum vs VPIN edge."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import logging
import numpy as np
import pandas as pd

from aurum_quant.microstructure.data_loader import IntraDayDataLoader
from aurum_quant.microstructure.vpin import VPINCalculator
from aurum_quant.microstructure.block_bootstrap_test import BlockBootstrapTester

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class BaselineComparison:
    """Compare VPIN vs. naive momentum baseline."""

    def __init__(self):
        self.loader = IntraDayDataLoader()
        self.vpin_calc = VPINCalculator(bucket_volume=20_000)
        self.bb_tester = BlockBootstrapTester(block_size=60)

    def create_momentum_signals(self, df: pd.DataFrame, lookback: int = 5) -> np.ndarray:
        """
        Naive baseline: signal = 1 if return over last N minutes was positive.

        This captures mean-reversion: if recent bars were up, revert down.
        """
        df = df.copy()
        df["past_ret"] = df["close"].pct_change(lookback)
        signal = (df["past_ret"] > 0).astype(int).values
        return signal

    def run_comparison(self) -> dict:
        """Compare VPIN vs momentum on same data."""
        log.info("=" * 80)
        log.info("BASELINE COMPARISON: VPIN vs Naive Momentum")
        log.info("=" * 80)

        # Load data
        log.info("\n[1] Loading gold 1-minute data...")
        df = self.loader.load_cached()
        if df is None:
            log.error("No data available")
            return {}

        log.info(f"    {len(df)} bars loaded")

        # Add VPIN
        log.info("\n[2] Computing VPIN...")
        df["vpin"] = self.vpin_calc.calculate_vpin(df)

        # Add momentum signals
        log.info("\n[3] Computing momentum signals...")
        df["momentum_signal"] = self.create_momentum_signals(df, lookback=5)

        # VPIN signals (top 10%)
        percentile = 90
        vpin_threshold = df["vpin"].quantile(percentile / 100)
        df["vpin_signal"] = (df["vpin"] >= vpin_threshold).astype(int)

        # Forward returns
        log.info("\n[4] Computing forward returns...")
        for horizon in [5, 15, 30, 60]:
            fwd_close = df["close"].shift(-horizon)
            df[f"fwd_ret_{horizon}m"] = ((fwd_close - df["close"]) / df["close"] * 100).fillna(np.nan)

        # Test both signals with block bootstrap
        log.info("\n[5] Block bootstrap testing (1000 iterations)...")
        log.info("\nVPIN Strategy:")
        vpin_results = {}
        for horizon in [5, 15, 30, 60]:
            ret_col = f"fwd_ret_{horizon}m"
            vpin_bb = self.bb_tester.run_block_bootstrap_test(
                df["vpin_signal"].values, df[ret_col].values, n_perms=1000, seed=42
            )
            vpin_results[horizon] = vpin_bb
            log.info(f"  {horizon}m: HR={vpin_bb['real_hr']:.1%}, p={vpin_bb['p_value']:.3f}")

        log.info("\nMomentum Baseline:")
        momentum_results = {}
        for horizon in [5, 15, 30, 60]:
            ret_col = f"fwd_ret_{horizon}m"
            mom_bb = self.bb_tester.run_block_bootstrap_test(
                df["momentum_signal"].values, df[ret_col].values, n_perms=1000, seed=42
            )
            momentum_results[horizon] = mom_bb
            log.info(f"  {horizon}m: HR={mom_bb['real_hr']:.1%}, p={mom_bb['p_value']:.3f}")

        # Summary
        log.info("\n" + "=" * 80)
        log.info("SUMMARY")
        log.info("=" * 80)
        for horizon in [5, 15, 30, 60]:
            vpin_hr = vpin_results[horizon]["real_hr"] * 100
            mom_hr = momentum_results[horizon]["real_hr"] * 100
            vpin_p = vpin_results[horizon]["p_value"]
            mom_p = momentum_results[horizon]["p_value"]
            diff = vpin_hr - mom_hr

            log.info(f"\n{horizon}m horizon:")
            log.info(f"  VPIN:     HR={vpin_hr:5.1f}%, p={vpin_p:.3f}")
            log.info(f"  Momentum: HR={mom_hr:5.1f}%, p={mom_p:.3f}")
            log.info(f"  Difference: {diff:+.1f}pp (VPIN advantage)")

            if abs(diff) < 5:
                log.info(f"  ➜ VPIN not significantly better than naive momentum")
            elif diff > 5:
                log.info(f"  ➜ VPIN outperforms momentum by {diff:.1f}pp")
            else:
                log.info(f"  ➜ Momentum outperforms VPIN by {-diff:.1f}pp")

        return {
            "vpin": vpin_results,
            "momentum": momentum_results,
        }


if __name__ == "__main__":
    tester = BaselineComparison()
    results = tester.run_comparison()
