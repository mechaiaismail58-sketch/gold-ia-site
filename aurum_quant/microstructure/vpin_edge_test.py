#!/usr/bin/env python
"""ÉTAPE 3: VPIN edge test — signal generation, return measurement, permutation test."""
from __future__ import annotations

import sys
from pathlib import Path

# Add parent project directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from aurum_quant.microstructure.data_loader import IntraDayDataLoader
from aurum_quant.microstructure.vpin import VPINCalculator
from aurum_quant.microstructure.block_bootstrap_test import BlockBootstrapTester, compare_permutation_tests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
)
log = logging.getLogger(__name__)


class VPINEdgeTester:
    """Test VPIN as a standalone edge on 1-minute gold data."""

    def __init__(
        self,
        bucket_volume: float = 20_000,
        vpin_threshold: float = 0.5,
        return_horizons: list[int] = None,
    ):
        """
        Args:
            bucket_volume: Volume per bucket for VPIN (default 20k for 1-min bars)
            vpin_threshold: VPIN signal threshold (0.0-1.0)
            return_horizons: Lookforward periods in minutes [5, 15, 30, 60]
        """
        self.bucket_volume = bucket_volume
        self.vpin_threshold = vpin_threshold
        self.return_horizons = return_horizons or [5, 15, 30, 60]
        self.vpin_calc = VPINCalculator(bucket_volume=bucket_volume, n_buckets=50)

    def load_intraday_data(self) -> pd.DataFrame:
        """Load 1-minute data from cache or fetch from yfinance."""
        loader = IntraDayDataLoader()
        data = loader.load_cached()
        if data is None:
            log.info("Cache not found; fetching fresh 1-minute data from yfinance...")
            data = loader.fetch_and_cache(source="auto", days=7)
        log.info(f"  Loaded {len(data)} bars")
        return data

    def calculate_returns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate forward returns at each horizon.

        Returns:
            df with columns: fwd_ret_5m, fwd_ret_15m, fwd_ret_30m, fwd_ret_60m (%)
        """
        df = df.copy()
        for horizon in self.return_horizons:
            fwd_close = df["close"].shift(-horizon)
            fwd_ret = ((fwd_close - df["close"]) / df["close"] * 100).fillna(np.nan)
            df[f"fwd_ret_{horizon}m"] = fwd_ret
        return df

    def generate_signals(self, df: pd.DataFrame, percentile_mode: bool = True) -> pd.DataFrame:
        """
        Generate VPIN signals: 1 when VPIN in top X%, 0 otherwise.

        Args:
            df: DataFrame with VPIN column
            percentile_mode: If True, use percentile threshold; else absolute threshold

        Returns:
            df with 'signal' column (0/1)
        """
        df = df.copy()
        if percentile_mode:
            # Use percentile threshold (top 10% by default)
            percentile_level = 90  # Top 10%
            threshold = df["vpin"].quantile(percentile_level / 100)
            df["signal"] = (df["vpin"] >= threshold).astype(int)
            df["threshold"] = threshold
        else:
            df["signal"] = (df["vpin"] > self.vpin_threshold).astype(int)
            df["threshold"] = self.vpin_threshold
        return df

    def run_edge_test(self) -> dict:
        """
        Full edge test pipeline:
        1. Load data
        2. Calculate VPIN
        3. Generate signals
        4. Measure returns
        5. Compute hit rates
        6. Run permutation test
        """
        log.info("=" * 80)
        log.info("VPIN EDGE TEST")
        log.info("=" * 80)

        # 1. Load data
        log.info("\n[1] Loading 1-minute intraday data...")
        df = self.load_intraday_data()

        # 2. Calculate VPIN
        log.info("\n[2] Calculating VPIN...")
        log.info(f"  Input df shape: {df.shape}, columns: {list(df.columns)}")
        log.info(f"  Volume stats: mean={df['volume'].mean():.0f}, total={df['volume'].sum():.0f}")
        vpin_series = self.vpin_calc.calculate_vpin(df)
        log.info(f"  VPIN Series unique values: {vpin_series.nunique()}")
        df["vpin"] = vpin_series
        log.info(f"  VPIN stats: mean={df['vpin'].mean():.4f}, std={df['vpin'].std():.4f}, "
                 f"min={df['vpin'].min():.4f}, max={df['vpin'].max():.4f}")

        # 3. Generate signals (percentile-based)
        log.info("\n[3] Generating VPIN signals (top 10% by percentile)...")
        df = self.generate_signals(df, percentile_mode=True)
        n_signals = df["signal"].sum()
        threshold = df["threshold"].iloc[0]
        log.info(f"  Threshold: {threshold:.4f}")
        log.info(f"  Total signals: {n_signals} ({100*n_signals/len(df):.2f}% of bars)")

        if n_signals == 0:
            log.warning("  [NO SIGNALS GENERATED] — VPIN never exceeds threshold")
            return self._empty_result()

        # 4. Calculate forward returns
        log.info("\n[4] Measuring forward returns...")
        df = self.calculate_returns(df)

        # 5. Compute hit rates
        log.info("\n[5] Computing hit rates...")
        results = {}
        for horizon in self.return_horizons:
            ret_col = f"fwd_ret_{horizon}m"
            signal_mask = df["signal"] == 1
            returns_on_signal = df.loc[signal_mask, ret_col]

            # Hit rate = % of signal bars where return > 0
            valid_returns = returns_on_signal[returns_on_signal.notna()]
            if len(valid_returns) == 0:
                hit_rate = np.nan
                mean_ret = np.nan
            else:
                hit_rate = (valid_returns > 0).sum() / len(valid_returns)
                mean_ret = valid_returns.mean()

            results[horizon] = {
                "n_signals": signal_mask.sum(),
                "n_valid_returns": len(valid_returns),
                "hit_rate": hit_rate,
                "mean_return": mean_ret,
            }
            log.info(f"  {horizon}m horizon: {signal_mask.sum()} signals, "
                     f"hit_rate={hit_rate:.1%}, mean_ret={mean_ret:+.3f}%")

        # 6. Permutation test (naive + block bootstrap)
        log.info("\n[6] Running permutation tests (naive + block bootstrap, 1000 iterations)...")
        perm_results = self._permutation_test(df, n_perms=1000)
        bb_results = self._block_bootstrap_test(df, n_perms=1000)

        log.info("\n" + "=" * 80)
        log.info("SUMMARY — Naive vs Block Bootstrap")
        log.info("=" * 80)
        for horizon in self.return_horizons:
            hit = results[horizon]["hit_rate"]
            pval_naive = perm_results[horizon]["p_value"]
            pval_bb = bb_results[horizon]["p_value"]
            log.info(f"  {horizon}m: HR={hit:.1%} | Naive p={pval_naive:.3f} | BB p={pval_bb:.3f}")

        return {
            "data": df,
            "results": results,
            "perm_results": perm_results,
            "bb_results": bb_results,
        }

    def _empty_result(self) -> dict:
        """Return empty result structure when no signals."""
        return {
            "data": None,
            "results": {h: {"n_signals": 0} for h in self.return_horizons},
            "perm_results": {h: {"p_value": np.nan} for h in self.return_horizons},
        }

    def _permutation_test(self, df: pd.DataFrame, n_perms: int = 1000) -> dict:
        """
        Permutation test: compare real hit rate vs. distribution under random shuffle.

        Args:
            df: DataFrame with signal and forward returns
            n_perms: Number of permutations

        Returns:
            dict with p-value and distribution for each horizon
        """
        perm_results = {}

        for horizon in self.return_horizons:
            ret_col = f"fwd_ret_{horizon}m"
            real_signal = df["signal"].values
            real_returns = df[ret_col].values

            # Real hit rate (on non-NaN returns only)
            valid_idx = ~np.isnan(real_returns) & (real_signal == 1)
            if valid_idx.sum() == 0:
                perm_results[horizon] = {"p_value": np.nan, "real_hr": np.nan, "dist": []}
                continue

            real_hr = (real_returns[valid_idx] > 0).mean()

            # Permutation: shuffle signal labels and recompute hit rate
            perm_hrs = []
            np.random.seed(42)  # Reproducible
            for _ in range(n_perms):
                perm_signal = np.random.permutation(real_signal)
                perm_valid = ~np.isnan(real_returns) & (perm_signal == 1)
                if perm_valid.sum() > 0:
                    perm_hr = (real_returns[perm_valid] > 0).mean()
                    perm_hrs.append(perm_hr)

            perm_hrs = np.array(perm_hrs)

            # P-value: % of permutations with hr >= real_hr
            p_value = (perm_hrs >= real_hr).mean()

            perm_results[horizon] = {
                "p_value": p_value,
                "real_hr": real_hr,
                "dist": perm_hrs.tolist(),
                "mean_perm_hr": perm_hrs.mean(),
                "std_perm_hr": perm_hrs.std(),
            }

            log.info(f"  {horizon}m: real_HR={real_hr:.1%}, perm_mean={perm_hrs.mean():.1%}, "
                     f"perm_std={perm_hrs.std():.1%}, p-value={p_value:.3f}")

        return perm_results

    def _block_bootstrap_test(self, df: pd.DataFrame, n_perms: int = 1000) -> dict:
        """
        Block bootstrap permutation test preserving autocorrelation.

        Returns:
            dict with p-values and distributions for each horizon
        """
        bb_results = {}
        bb_tester = BlockBootstrapTester(block_size=60)

        for horizon in self.return_horizons:
            ret_col = f"fwd_ret_{horizon}m"
            signal = df["signal"].values
            returns = df[ret_col].values

            bb_result = bb_tester.run_block_bootstrap_test(signal, returns, n_perms=n_perms, seed=42)
            bb_results[horizon] = bb_result

            log.info(f"  {horizon}m BB: real_HR={bb_result['real_hr']:.1%}, "
                     f"perm_mean={bb_result['perm_mean']:.1%}, p-value={bb_result['p_value']:.3f}")

        return bb_results


if __name__ == "__main__":
    # Use bucket_volume calibrated for 1-minute bars (20k = ~50 buckets for a week of data)
    tester = VPINEdgeTester(bucket_volume=20_000, vpin_threshold=0.5)
    result = tester.run_edge_test()
