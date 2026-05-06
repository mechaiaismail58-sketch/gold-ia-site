#!/usr/bin/env python
"""ÉTAPE 2-5: Complete 2-year VPIN validation with train/OOS split and robustness metrics."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from aurum_quant.microstructure.vpin import VPINCalculator
from aurum_quant.microstructure.block_bootstrap_test import BlockBootstrapTester

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger(__name__)


class VPINFinalValidator:
    """ÉTAPE 2-5: Rigorous 2-year validation with train/test split and robustness metrics."""

    def __init__(self):
        self.vpin_calc = None
        self.bb_tester = BlockBootstrapTester(block_size=60)

    def split_train_oos(self, df: pd.DataFrame, train_fraction: float = 0.75) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        ÉTAPE 2: Split data into train (75%) and OOS (25%).

        Strictly no information leakage: OOS parameters are independent.
        """
        df = df.sort_values("timestamp_utc").reset_index(drop=True)
        split_idx = int(len(df) * train_fraction)

        train = df.iloc[:split_idx].copy()
        oos = df.iloc[split_idx:].copy()

        log.info(f"Train: {len(train)} bars ({train['timestamp_utc'].min()} → {train['timestamp_utc'].max()})")
        log.info(f"OOS:   {len(oos)} bars ({oos['timestamp_utc'].min()} → {oos['timestamp_utc'].max()})")

        return train, oos

    def calibrate_vpin_on_train(self, train_df: pd.DataFrame) -> dict:
        """
        Calibrate VPIN parameters using ONLY training data.

        Returns:
            dict with calibrated parameters
        """
        log.info("\n[ÉTAPE 2] Calibrating VPIN on training data...")

        # Calibration 1: Bucket volume = total_volume / 50
        total_volume = train_df["volume"].sum()
        bucket_volume = total_volume / 50
        log.info(f"  Bucket volume: {bucket_volume:,.0f} (total {total_volume:,.0f} / 50)")

        # Calibration 2: VPIN threshold = 90th percentile on train
        # (We'll compute this after calculating VPIN)
        self.vpin_calc = VPINCalculator(bucket_volume=bucket_volume, n_buckets=50)

        train_df["vpin"] = self.vpin_calc.calculate_vpin(train_df)
        vpin_threshold = train_df["vpin"].quantile(0.90)

        log.info(f"  VPIN threshold (90th percentile on train): {vpin_threshold:.4f}")
        log.info(f"  VPIN stats on train: mean={train_df['vpin'].mean():.4f}, "
                 f"std={train_df['vpin'].std():.4f}, max={train_df['vpin'].max():.4f}")

        return {
            "bucket_volume": bucket_volume,
            "vpin_threshold": vpin_threshold,
        }

    def test_on_oos(self, oos_df: pd.DataFrame, calibration: dict) -> dict:
        """
        ÉTAPE 3: Apply calibrated VPIN to OOS data (NO re-optimization).

        Apply parameters from train exactly as-is.
        """
        log.info("\n[ÉTAPE 3] Applying trained VPIN to OOS data...")

        oos_df = oos_df.copy()

        # Recalculate VPIN with same bucket volume
        oos_df["vpin"] = self.vpin_calc.calculate_vpin(oos_df)

        # Apply threshold from train
        threshold = calibration["vpin_threshold"]
        oos_df["signal"] = (oos_df["vpin"] >= threshold).astype(int)

        n_signals = oos_df["signal"].sum()
        log.info(f"  Signals generated: {n_signals} ({100*n_signals/len(oos_df):.2f}% of bars)")

        # Forward returns
        for horizon in [5, 15, 30, 60]:
            fwd_close = oos_df["close"].shift(-horizon)
            oos_df[f"fwd_ret_{horizon}m"] = ((fwd_close - oos_df["close"]) / oos_df["close"] * 100).fillna(np.nan)

        # Block bootstrap test with 10,000 iterations
        log.info("\n[ÉTAPE 3.1] Block bootstrap testing (10,000 iterations)...")
        oos_results = {}
        for horizon in [5, 15, 30, 60]:
            ret_col = f"fwd_ret_{horizon}m"
            bb_result = self.bb_tester.run_block_bootstrap_test(
                oos_df["signal"].values, oos_df[ret_col].values, n_perms=10000, seed=42
            )
            oos_results[horizon] = bb_result

            hr = bb_result["real_hr"] * 100
            p = bb_result["p_value"]
            log.info(f"  {horizon}m: HR={hr:5.1f}%, p={p:.4f}")

        return oos_df, oos_results

    def compute_robustness_metrics(self, oos_df: pd.DataFrame) -> dict:
        """
        ÉTAPE 4: Compute robustness metrics for OOS period.

        Metrics:
        - Sharpe ratio of conditional returns
        - Maximum drawdown
        - Return distribution (skew, kurtosis)
        - Temporal stability: split OOS into 3 periods, check consistency
        """
        log.info("\n[ÉTAPE 4] Computing robustness metrics...")

        signal = oos_df["signal"].values
        signal_idx = np.where(signal == 1)[0]

        metrics = {}

        # Metric 1: Sharpe ratio (60m horizon)
        ret_60m = oos_df[oos_df["signal"] == 1]["fwd_ret_60m"].dropna()
        if len(ret_60m) > 0:
            sharpe_60m = (ret_60m.mean() / ret_60m.std()) * np.sqrt(252 * 24 * 60 / 60)  # Annualized (1-min bars)
            metrics["sharpe_60m"] = sharpe_60m
            log.info(f"  Sharpe (60m conditional): {sharpe_60m:.2f}")

        # Metric 2: Max drawdown (if we traded each signal with fixed 1% position)
        cumret = (1 + ret_60m / 100).cumprod() - 1
        running_max = cumret.expanding().max()
        drawdown = (cumret - running_max) / (1 + running_max)
        max_dd = drawdown.min() * 100
        metrics["max_drawdown_60m"] = max_dd
        log.info(f"  Max drawdown (60m, 1% risk): {max_dd:.2f}%")

        # Metric 3: Return distribution
        skew = ret_60m.skew()
        kurt = ret_60m.kurtosis()
        metrics["skew"] = skew
        metrics["kurtosis"] = kurt
        log.info(f"  Return distribution: skew={skew:.2f}, kurtosis={kurt:.2f}")

        # Metric 4: Temporal stability (split OOS into 3 subperiods)
        log.info("\n  Temporal stability (3 sub-periods of OOS):")
        oos_sorted = oos_df.sort_values("timestamp_utc").reset_index(drop=True)
        n_oos = len(oos_sorted)
        period_len = n_oos // 3

        sub_results = {}
        for i in range(3):
            start = i * period_len
            end = (i + 1) * period_len if i < 2 else n_oos
            sub_df = oos_sorted.iloc[start:end]

            # Hit rate for this subperiod
            sub_signal = sub_df["signal"].values
            sub_returns = sub_df["fwd_ret_60m"].values

            valid = ~np.isnan(sub_returns) & (sub_signal == 1)
            if valid.sum() > 0:
                sub_hr = (sub_returns[valid] > 0).mean() * 100
                n_sigs = valid.sum()
                sub_results[f"period_{i+1}"] = {"hr": sub_hr, "n_signals": n_sigs}
                log.info(f"    Period {i+1}: HR={sub_hr:5.1f}% (n={n_sigs})")

        metrics["temporal_stability"] = sub_results

        return metrics

    def generate_final_verdict(
        self, oos_results: dict, robustness: dict, output_path: Path = None
    ) -> str:
        """
        ÉTAPE 5: Generate final verdict based on criteria.

        Production ready (PASS):
        - p < 0.01 on OOS
        - Hit rate > 55% and stable
        - Sharpe > 1.5
        - Max DD < 15%

        Marginal edge (MARGINAL):
        - 0.01 < p < 0.05 on OOS
        - Hit rate > 52% but variable
        - Sharpe 0.8-1.5

        No edge (FAIL):
        - p > 0.05 on OOS
        - Unstable or < 52% hit rate
        """
        log.info("\n" + "=" * 80)
        log.info("[ÉTAPE 5] FINAL VERDICT")
        log.info("=" * 80)

        # Check p-value (60m is key horizon)
        p_60m = oos_results[60]["p_value"]
        hr_60m = oos_results[60]["real_hr"] * 100
        sharpe = robustness.get("sharpe_60m", 0)
        max_dd = robustness.get("max_drawdown_60m", 100)

        log.info(f"\nKey metrics (60m horizon):")
        log.info(f"  Hit rate: {hr_60m:.1f}%")
        log.info(f"  p-value: {p_60m:.4f}")
        log.info(f"  Sharpe: {sharpe:.2f}")
        log.info(f"  Max DD: {max_dd:.2f}%")

        # Criteria evaluation
        verdict_points = []

        if p_60m < 0.01:
            verdict_points.append(("p < 0.01", True))
        elif p_60m < 0.05:
            verdict_points.append(("p < 0.05", True))
        else:
            verdict_points.append(("p > 0.05", False))

        if hr_60m > 55:
            verdict_points.append(("HR > 55%", True))
        elif hr_60m > 52:
            verdict_points.append(("HR > 52%", True))
        else:
            verdict_points.append(("HR < 52%", False))

        if sharpe > 1.5:
            verdict_points.append(("Sharpe > 1.5", True))
        elif sharpe > 0.8:
            verdict_points.append(("Sharpe > 0.8", True))
        else:
            verdict_points.append(("Sharpe < 0.8", False))

        if max_dd < 15:
            verdict_points.append(("DD < 15%", True))
        else:
            verdict_points.append(("DD > 15%", False))

        # Temporal stability
        hrs = [v["hr"] for v in robustness.get("temporal_stability", {}).values()]
        if hrs and max(hrs) - min(hrs) < 5:
            verdict_points.append(("Stable across periods", True))
        elif hrs:
            verdict_points.append(("Variable across periods", False))

        log.info(f"\nCriteria:")
        for criterion, passed in verdict_points:
            status = "✓" if passed else "✗"
            log.info(f"  {status} {criterion}")

        # Final classification
        passes = sum(1 for _, p in verdict_points if p)
        total = len(verdict_points)

        if p_60m < 0.01 and hr_60m > 55 and sharpe > 1.5 and max_dd < 15:
            final = "PRODUCTION READY"
            level = "✓ READY"
        elif p_60m < 0.05 and hr_60m > 52 and sharpe > 0.8:
            final = "MARGINAL EDGE"
            level = "⚠️ MARGINAL"
        else:
            final = "NO EDGE"
            level = "✗ FAIL"

        log.info(f"\n{'='*80}")
        log.info(f"{level}: {final}")
        log.info(f"{'='*80}")
        log.info(f"\nPasses {passes}/{total} criteria\n")

        verdict_text = f"{level} — {final} ({passes}/{total} criteria)"

        return verdict_text

    def run_full_validation(self, df: pd.DataFrame) -> dict:
        """Run complete 2-year validation pipeline."""
        log.info("\n" + "=" * 80)
        log.info("VPIN FINAL VALIDATION (2-YEAR FRAMEWORK)")
        log.info("=" * 80)

        # ÉTAPE 2: Train/OOS split
        train_df, oos_df = self.split_train_oos(df, train_fraction=0.75)

        # ÉTAPE 2: Calibrate on train
        calibration = self.calibrate_vpin_on_train(train_df)

        # ÉTAPE 3: Test on OOS
        oos_df, oos_results = self.test_on_oos(oos_df, calibration)

        # ÉTAPE 4: Robustness metrics
        robustness = self.compute_robustness_metrics(oos_df)

        # ÉTAPE 5: Final verdict
        verdict = self.generate_final_verdict(oos_results, robustness)

        return {
            "train": train_df,
            "oos": oos_df,
            "calibration": calibration,
            "oos_results": oos_results,
            "robustness": robustness,
            "verdict": verdict,
        }


if __name__ == "__main__":
    # For now, test with available 7-day data
    from aurum_quant.microstructure.data_loader import IntraDayDataLoader

    log.info("Loading available data for framework test...")
    loader = IntraDayDataLoader()
    df = loader.load_cached()

    if df is None:
        log.error("No cached data available. Run download_2y_data.py first.")
        sys.exit(1)

    validator = VPINFinalValidator()
    results = validator.run_full_validation(df)

    log.info("\n" + "=" * 80)
    log.info("FRAMEWORK TEST COMPLETE")
    log.info("=" * 80)
    log.info(f"\nVERDICT: {results['verdict']}")
    log.info("\nWhen 2-year data is available, re-run this script to get final validation.")
