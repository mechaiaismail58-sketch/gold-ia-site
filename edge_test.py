#!/usr/bin/env python
"""Edge Test — measure raw mathematical edge without trading layers.

Tests whether model outputs (HMM regime, Kalman gap, APEN, etc.) predict
future returns better than random.

Usage:
    python edge_test.py

Outputs:
    - LONG signal edge: E[return_5d | LONG] vs random
    - SHORT signal edge: E[return_5d | SHORT] vs random
    - T-tests, hit rates, return distributions
"""
from __future__ import annotations

import pickle
import logging
import warnings
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger("edge_test")


# ===========================================================================
class EdgeTester:
    """Raw mathematical edge tester."""

    def __init__(self, project_root: Path = Path(__file__).parent):
        self.project_root = project_root
        self.data_dir = project_root / "aurum_quant" / "data"
        self.cache_dir = self.data_dir / "cache"
        self.models_dir = self.cache_dir / "models"

        self.panel: Optional[pd.DataFrame] = None
        self.splits: Optional[dict] = None
        self.pipe = None  # Will hold the Pipeline instance
        self.hmm = None
        self.kalman = None
        self.pca = None
        self.hawkes = None
        self.guard = None
        self.apen_dict = {}

    def load_data_and_models(self):
        """Load panel, models from pipeline."""
        log.info("Loading data and models...")

        # Import pipeline
        from aurum_quant.main import Pipeline
        from aurum_quant import config

        # Create pipeline and run steps 1-2
        self.pipe = Pipeline()
        self.panel = self.pipe.step1_data()
        log.info(f"  panel: {len(self.panel)} rows, {self.panel.index[0]} → {self.panel.index[-1]}")

        self.pipe.step2_preprocess()
        self.splits = self.pipe.splits
        log.info(f"  splits: {list(self.splits.keys())}")

        # Load pickled models
        self.pipe.load_pickled_models()
        self.hmm = self.pipe.hmm
        self.kalman = self.pipe.kalman
        self.pca = self.pipe.pca
        self.hawkes = self.pipe.hawkes
        self.guard = self.pipe.guard
        log.info("  models: hmm, kalman, pca, hawkes, guard loaded")

        # Load APEN values from guard
        if hasattr(self.guard, "apen_values"):
            self.apen_dict = self.guard.apen_values.to_dict() if isinstance(self.guard.apen_values, pd.Series) else {}
        log.info(f"  APEN dict: {len(self.apen_dict)} entries")

    def compute_raw_outputs(self, ts: pd.Timestamp, features: pd.DataFrame) -> dict:
        """Extract raw model outputs from propagated features."""
        outputs = {}

        # HMM regime (1, 2, 3, or 4)
        try:
            if "hmm_regime" in features.columns:
                outputs["hmm_regime"] = int(features.loc[ts, "hmm_regime"])
            else:
                outputs["hmm_regime"] = 2
        except:
            outputs["hmm_regime"] = 2

        # HMM posterior probabilities (P_R1, P_R2, P_R3, P_R4)
        for r in range(1, 5):
            col = f"P_R{r}"
            try:
                if col in features.columns:
                    outputs[f"p_r{r}"] = float(features.loc[ts, col])
                else:
                    outputs[f"p_r{r}"] = 0.25
            except:
                outputs[f"p_r{r}"] = 0.25

        # Kalman gap_sigma (signed: < 0 = below FV, > 0 = above FV)
        try:
            if "kalman_gap_sigma" in features.columns:
                outputs["kalman_gap_sigma"] = float(features.loc[ts, "kalman_gap_sigma"])
            else:
                outputs["kalman_gap_sigma"] = 0.0
        except:
            outputs["kalman_gap_sigma"] = 0.0

        # Beta gold-to-real rate
        try:
            if "beta_gold_realrate" in features.columns:
                outputs["beta"] = float(features.loc[ts, "beta_gold_realrate"])
            else:
                outputs["beta"] = 0.0
        except:
            outputs["beta"] = 0.0

        # Market structure (intraday range)
        try:
            if "intraday_range" in features.columns:
                outputs["market_structure"] = float(features.loc[ts, "intraday_range"])
            else:
                outputs["market_structure"] = 0.0
        except:
            outputs["market_structure"] = 0.0

        # Real rate delta 21d
        try:
            if "real_rate_delta_21d" in features.columns:
                outputs["real_rate_delta_21d"] = float(features.loc[ts, "real_rate_delta_21d"])
            else:
                outputs["real_rate_delta_21d"] = 0.0
        except:
            outputs["real_rate_delta_21d"] = 0.0

        return outputs

    def generate_raw_signal(self, outputs: dict) -> Optional[str]:
        """Generate LONG/SHORT/None based on simple gate logic (lenient version)."""
        regime = outputs.get("hmm_regime", 2)
        gap_sigma = outputs.get("kalman_gap_sigma", 0.0)
        beta = outputs.get("beta", 0.0)
        p_r2 = outputs.get("p_r2", 0.25)
        p_r3 = outputs.get("p_r3", 0.25)

        # Filter: regime in [2, 3] with reasonable confidence
        trend_confidence = p_r2 + p_r3
        if trend_confidence < 0.4:
            return None

        # LONG: gap < -1.0 AND reasonable beta exposure
        if gap_sigma < -1.0 and abs(beta) > 0.03:
            return "LONG"

        # SHORT: gap > +1.0 AND reasonable beta exposure
        if gap_sigma > 1.0 and abs(beta) > 0.03:
            return "SHORT"

        return None

    def compute_forward_returns(
        self, ts: pd.Timestamp, lookforward: int = 5
    ) -> dict:
        """Compute raw returns forward from ts."""
        returns = {}
        try:
            curr_price = float(self.panel.loc[ts, "gold_close"])
            for days in [1, 3, 5, 10]:
                future_idx = ts + pd.Timedelta(days=days)
                if future_idx in self.panel.index:
                    future_price = float(self.panel.loc[future_idx, "gold_close"])
                    returns[f"return_{days}d"] = (future_price - curr_price) / curr_price
                else:
                    returns[f"return_{days}d"] = None
        except:
            pass
        return returns

    def run_edge_test(
        self,
        window_name: str,
        start_date: str,
        end_date: str,
    ) -> dict:
        """Run edge test for a window."""
        print(f"\n{'='*80}")
        print(f"  EDGE TEST: {window_name}")
        print(f"  Period: {start_date} → {end_date}")
        print(f"{'='*80}\n")

        oos_start = pd.Timestamp(start_date)
        oos_end = pd.Timestamp(end_date)

        # Get OOS features — concatenate splits and propagate model outputs
        all_features = pd.concat([self.splits["train"], self.splits["validation"]])
        if "test" in self.splits:
            all_features = pd.concat([all_features, self.splits["test"]])

        # Propagate model outputs to features
        all_features = self.pipe._propagate_model_outputs(all_features)

        oos_features = all_features.loc[oos_start:oos_end]

        # Feature diagnostics (first pass to see distributions)
        if len(oos_features) > 0:
            sample_outputs = []
            for ts in oos_features.index[:min(100, len(oos_features))]:
                out = self.compute_raw_outputs(ts, oos_features)
                sample_outputs.append(out)

            if sample_outputs:
                df_diag = pd.DataFrame(sample_outputs)
                print(f"  Feature distributions (sample of {len(sample_outputs)}):")
                for col in ["kalman_gap_sigma", "apen", "pca_alignment", "hmm_regime"]:
                    if col in df_diag.columns:
                        print(f"    {col:20s}  mean={df_diag[col].mean():.3f}  std={df_diag[col].std():.3f}  "
                              f"min={df_diag[col].min():.3f}  max={df_diag[col].max():.3f}")
                print()

        # Collect signals and returns
        signals_long = []
        signals_short = []
        returns_long = []
        returns_short = []
        all_returns = []

        for ts in oos_features.index:
            if ts < oos_start or ts > oos_end:
                continue

            # Raw outputs — use preprocessed features
            outputs = self.compute_raw_outputs(ts, oos_features)

            # Signal
            sig = self.generate_raw_signal(outputs)

            # Forward returns — skip if not enough data left
            if ts + pd.Timedelta(days=5) > self.panel.index.max():
                continue

            fwd_ret = self.compute_forward_returns(ts, lookforward=5)
            ret_5d = fwd_ret.get("return_5d")

            if ret_5d is None:
                continue

            all_returns.append(ret_5d)

            if sig == "LONG":
                signals_long.append({
                    "date": ts,
                    "return_5d": ret_5d,
                    "gap_sigma": outputs.get("kalman_gap_sigma", 0.0),
                    "regime": outputs.get("hmm_regime", 2),
                })
                returns_long.append(ret_5d)
            elif sig == "SHORT":
                signals_short.append({
                    "date": ts,
                    "return_5d": ret_5d,
                    "gap_sigma": outputs.get("kalman_gap_sigma", 0.0),
                    "regime": outputs.get("hmm_regime", 2),
                })
                returns_short.append(ret_5d)

        # Random baseline
        n_random = max(len(returns_long), len(returns_short), 1)
        if len(all_returns) > 0:
            returns_random = np.random.choice(all_returns, size=n_random, replace=True)
        else:
            returns_random = np.zeros(n_random)

        # Stats
        result = self._compute_stats(
            window_name,
            signals_long,
            signals_short,
            returns_long,
            returns_short,
            returns_random,
            all_returns,
        )

        return result

    def _compute_stats(
        self,
        window_name: str,
        signals_long: list,
        signals_short: list,
        returns_long: list,
        returns_short: list,
        returns_random: np.ndarray,
        all_returns: list,
    ) -> dict:
        """Compute edge statistics."""
        returns_long = np.array(returns_long)
        returns_short = np.array(returns_short)

        result = {
            "window": window_name,
            "n_long": len(returns_long),
            "n_short": len(returns_short),
            "n_total": len(returns_long) + len(returns_short),
            "n_random": len(returns_random),
        }

        print(f"  Total signals: {result['n_total']} (LONG={result['n_long']}, SHORT={result['n_short']})")
        print(f"  Random baseline: {result['n_random']} samples")
        print()

        # If no signals, return early
        if result['n_total'] == 0:
            print(f"  [NO SIGNALS GENERATED]")
            print()
            return result

        # LONG analysis
        if len(returns_long) > 0:
            mean_long = returns_long.mean()
            std_long = returns_long.std()
            hit_long = (returns_long > 0).sum() / len(returns_long)

            t_stat_long, p_long = stats.ttest_ind(returns_long, returns_random, equal_var=False)

            result["long_mean"] = mean_long
            result["long_std"] = std_long
            result["long_hit_rate"] = hit_long
            result["long_p_value"] = p_long

            print(f"  [LONG SIGNALS]")
            print(f"    Mean return (5d):  {mean_long:+.4f}  (std={std_long:.4f})")
            print(f"    Hit rate:          {hit_long:.1%}  ({(returns_long > 0).sum()}/{len(returns_long)} wins)")
            print(f"    vs random:         t={t_stat_long:+.2f}  p={p_long:.4f}  "
                  f"{'SIGNIFICANT ✓' if p_long < 0.05 else 'not sig'}")
            print()

        # SHORT analysis
        if len(returns_short) > 0:
            mean_short = returns_short.mean()
            std_short = returns_short.std()
            hit_short = (returns_short < 0).sum() / len(returns_short)

            t_stat_short, p_short = stats.ttest_ind(returns_short, returns_random, equal_var=False)

            result["short_mean"] = mean_short
            result["short_std"] = std_short
            result["short_hit_rate"] = hit_short
            result["short_p_value"] = p_short

            print(f"  [SHORT SIGNALS]")
            print(f"    Mean return (5d):  {mean_short:+.4f}  (std={std_short:.4f})")
            print(f"    Hit rate:          {hit_short:.1%}  ({(returns_short < 0).sum()}/{len(returns_short)} wins)")
            print(f"    vs random:         t={t_stat_short:+.2f}  p={p_short:.4f}  "
                  f"{'SIGNIFICANT ✓' if p_short < 0.05 else 'not sig'}")
            print()

        # Random baseline
        mean_random = returns_random.mean()
        std_random = returns_random.std()

        result["random_mean"] = mean_random
        result["random_std"] = std_random

        print(f"  [RANDOM BASELINE]")
        print(f"    Mean return (5d):  {mean_random:+.4f}  (std={std_random:.4f})")
        print()

        # Overall edge
        if len(returns_long) > 0 and len(returns_short) > 0:
            combined = np.concatenate([returns_long, returns_short])
            mean_combined = combined.mean()
            result["combined_mean"] = mean_combined
            result["edge_vs_random"] = mean_combined - mean_random
            print(f"  [COMBINED EDGE]")
            print(f"    Mean (LONG+SHORT): {mean_combined:+.4f}")
            print(f"    Edge vs random:    {result['edge_vs_random']:+.4f}  "
                  f"({result['edge_vs_random']/mean_random*100:+.1f}% relative)")
            print()

        return result

    def run_all_windows(self):
        """Run edge test across multiple windows."""
        # Use actual data windows from splits
        windows = [
            ("TRAIN_2010_2024", "2010-01-04", "2024-10-31"),
            ("BULL_2024_OOS", "2025-05-01", "2026-05-04"),
        ]

        results = []
        for win_name, start, end in windows:
            try:
                res = self.run_edge_test(win_name, start, end)
                results.append(res)
            except Exception as e:
                log.error(f"Error in {win_name}: {e}", exc_info=True)

        # Summary table
        print(f"\n{'='*80}")
        print("EDGE TEST SUMMARY")
        print(f"{'='*80}\n")
        print(f"{'Window':<20} {'n_sigs':>7} {'LONG_ret%':>10} {'SHORT_ret%':>10} {'Edge/Random':>12}")
        print("─" * 80)
        for res in results:
            long_ret = res.get("long_mean", float("nan")) * 100
            short_ret = res.get("short_mean", float("nan")) * 100
            edge_ratio = res.get("edge_vs_random", 0.0) / max(abs(res.get("random_mean", 1.0)), 0.0001)
            print(
                f"{res['window']:<20} {res['n_total']:>7} {long_ret:>10.2f} {short_ret:>10.2f} {edge_ratio:>12.2f}"
            )


    # ------------------------------------------------------------------
    def run_xgboost_permutation_test(self):
        """Permutation test: does XGBoost scorer have real edge on OOS period?"""
        print(f"\n{'='*80}")
        print("  XGBOOST PERMUTATION TEST — BULL_2024_OOS")
        print(f"{'='*80}\n")

        # Load XGBoost scorer
        self.pipe.step10_xgboost(n_trials=10)
        if self.pipe.scorer is None:
            print("  ERROR: XGBoost scorer not trained")
            return

        # Get OOS features
        all_features = pd.concat([self.pipe.splits["train"], self.pipe.splits["validation"]])
        if "test" in self.pipe.splits:
            all_features = pd.concat([all_features, self.pipe.splits["test"]])
        all_features = self.pipe._propagate_model_outputs(all_features)

        oos_start = pd.Timestamp("2025-05-01")
        oos_end = pd.Timestamp("2026-05-04")
        oos_features = all_features.loc[oos_start:oos_end]

        if len(oos_features) == 0:
            print("  ERROR: No OOS features found")
            return

        print(f"  OOS period: {oos_start.date()} → {oos_end.date()}")
        print(f"  OOS samples: {len(oos_features)}")

        # Generate scores using XGBoost
        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()

        directions = []  # +1 = LONG, -1 = SHORT
        returns_5d = []
        hits = 0
        total = 0

        for ts in oos_features.index:
            if ts + pd.Timedelta(days=5) > self.panel.index.max():
                continue

            try:
                # Get regime
                regime = int(oos_features.loc[ts, "hmm_regime"])
                if regime not in [2, 3, 4]:
                    regime = 2

                # Get XGBoost score for this regime
                scorer = self.pipe.scorer._scorers.get(regime)
                if scorer is None or scorer.model is None:
                    continue

                # Predict probability
                score = scorer.predict_proba(oos_features.loc[ts])
            except Exception as e:
                continue

            # Predict direction (score > 0.5 = LONG/UP)
            direction = 1 if score > 0.5 else -1

            # Measure actual 5d return
            ret_5d = self.compute_forward_returns(ts, lookforward=5).get("return_5d")
            if ret_5d is None:
                continue

            # Only count if both direction and return are available
            directions.append(direction)
            returns_5d.append(ret_5d)
            total += 1

            # Hit: direction matches sign of return
            hit = (direction > 0 and ret_5d > 0) or (direction < 0 and ret_5d < 0)
            if hit:
                hits += 1

        if total == 0:
            print("  ERROR: No valid signals")
            return

        real_hit_rate = hits / total

        # Permutation test: shuffle outcomes 1000 times
        print(f"\n  Running 1000 permutations...")
        perm_hit_rates = []
        returns_array = np.array(returns_5d)
        directions_array = np.array(directions)

        rng = np.random.default_rng(42)
        for _ in range(1000):
            perm_returns = rng.permutation(returns_array)
            perm_hits = sum(
                (directions_array[i] > 0 and perm_returns[i] > 0)
                or (directions_array[i] < 0 and perm_returns[i] < 0)
                for i in range(len(directions_array))
            )
            perm_hit_rates.append(perm_hits / total)

        perm_hit_rates = np.array(perm_hit_rates)
        pct_95 = np.percentile(perm_hit_rates, 95)
        pct_5 = np.percentile(perm_hit_rates, 5)
        p_value = np.mean(perm_hit_rates >= real_hit_rate)

        print(f"\n  REAL HIT RATE:           {real_hit_rate:.1%}  ({hits}/{total})")
        print(f"  Permutation distribution:")
        print(f"    Mean:                  {perm_hit_rates.mean():.1%}")
        print(f"    Std:                   {perm_hit_rates.std():.1%}")
        print(f"    5th percentile:        {pct_5:.1%}")
        print(f"    95th percentile:       {pct_95:.1%}")
        print(f"  P-value (% perms >= real): {p_value:.4f}")

        # Verdict
        print(f"\n  {'='*70}")
        if real_hit_rate > pct_95:
            verdict = "REAL EDGE"
            print(f"  *** {verdict} ***")
            print(f"  XGBoost hit rate ({real_hit_rate:.1%}) exceeds 95th percentile ({pct_95:.1%})")
        else:
            verdict = "CURVE FITTING"
            print(f"  *** {verdict} ***")
            print(f"  XGBoost hit rate ({real_hit_rate:.1%}) within permutation distribution")
        print(f"  {'='*70}")
        return verdict, real_hit_rate, p_value


def main():
    tester = EdgeTester()
    tester.load_data_and_models()
    # Run XGBoost permutation test on OOS
    verdict, hit_rate, p_val = tester.run_xgboost_permutation_test()
    print(f"\n  FINAL RESULT: {verdict}")
    print(f"  Hit rate OOS: {hit_rate:.1%}")
    print(f"  P-value: {p_val:.4f}")


if __name__ == "__main__":
    main()
