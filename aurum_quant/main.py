"""Aurum Quant — full pipeline orchestrator.

Run:
    python -m aurum_quant.main          # from the project root
    python aurum_quant/main.py          # direct invocation also works

The pipeline is 12 sequential steps; each step prints a clear banner and
saves intermediate artefacts to ``aurum_quant/data/cache/``.

Steps
-----
 1. Data collection
 2. Preprocessing (features, frac diff, splits)
 3. HMM regime training
 4. Kalman fair-value pass + adaptive β
 5. Macro PCA + regime-conditional loadings
 6. Heston regime calibration (Feller-projected)
 7. Merton-Hawkes calibration
 8. Dual-Entropy Guard fitting
 9. Bai-Perron structural-break detection
10. XGBoost scorer training (walk-forward CV + SHAP + isotonic)
11. Walk-forward out-of-sample backtest (2022 → 2023-06)
12. Phase 0 verdict
"""
from __future__ import annotations

import logging
import pickle
import sys
import warnings
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from . import config
from .data.collector import DataCollector
from .data.preprocessor import Preprocessor, assert_no_test_leakage
from .engine.bai_perron import StructuralBreakDetector
from .engine.entropy_guard import DualEntropyGuard
from .engine.heston import HestonCalibrator
from .engine.hmm_regime import GoldHMM
from .engine.kalman_fv import AdaptiveBetaTracker, KalmanFairValue
from .engine.merton_hawkes import MertonHawkesProcess
from .engine.pca_macro import MacroCouplingPCA
from .signals.scorer import RegimeAwareScorer

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aurum_quant")


def _banner(step: int, title: str) -> None:
    print()
    print("=" * 80)
    print(f"STEP {step:02d} — {title}")
    print("=" * 80)


# ===========================================================================
class Pipeline:
    def __init__(self, fred_api_key: Optional[str] = None) -> None:
        self.fred_api_key = fred_api_key or config.FRED_API_KEY
        self.panel: Optional[pd.DataFrame] = None
        self.preproc_result = None
        self.splits: Optional[dict[str, pd.DataFrame]] = None
        self.hmm: Optional[GoldHMM] = None
        self.regimes_train: Optional[pd.Series] = None
        self.kalman: Optional[KalmanFairValue] = None
        self.beta_tracker: Optional[AdaptiveBetaTracker] = None
        self.pca: Optional[MacroCouplingPCA] = None
        self.heston: Optional[HestonCalibrator] = None
        self.hawkes: Optional[MertonHawkesProcess] = None
        self.guard: Optional[DualEntropyGuard] = None
        self.break_detector: Optional[StructuralBreakDetector] = None
        self.scorer: Optional[RegimeAwareScorer] = None

    # ---------- step 1 ------------------------------------------------
    def step1_data(self) -> pd.DataFrame:
        _banner(1, "DATA COLLECTION")
        collector = DataCollector(fred_api_key=self.fred_api_key)
        self.panel = collector.fetch_all()
        DataCollector.summary(self.panel)
        return self.panel

    # ---------- step 2 ------------------------------------------------
    def step2_preprocess(self) -> dict[str, pd.DataFrame]:
        _banner(2, "PREPROCESSING")
        prep = Preprocessor()
        result = prep.fit_transform(self.panel)
        prep.print_report(result)
        self.preproc_result = result
        # train ends 2021-12-31 (≤ TRAIN_END), validation ends VALIDATION_END.
        # Test (post-VALIDATION_END) is held back for step 11 only.
        self.splits = prep.split(result.features)
        for name, df in self.splits.items():
            print(f"  {name:<12s} {len(df):>6d} rows  {df.index.min().date()} → {df.index.max().date()}")
        return self.splits

    # ---------- step 3 ------------------------------------------------
    def step3_hmm(self) -> GoldHMM:
        _banner(3, "HMM REGIME TRAINING")
        # safety: HMM must not see test-period data
        train_features = self.splits["train"]
        assert_no_test_leakage(train_features)
        # build the price/feature view used by the HMM
        prices_train = self.panel.loc[train_features.index, "gold_close"]
        hmm = GoldHMM().fit(train_features)
        hmm.print_summary()
        seq = hmm.predict_regime(train_features)
        self.regimes_train = seq
        try:
            hmm.plot_regimes(prices_train, seq)
        except Exception as exc:
            log.warning("regime plot failed: %s", exc)
        hmm.save(config.MODELS_DIR / "hmm.pkl")
        self.hmm = hmm
        return hmm

    # ---------- step 4 ------------------------------------------------
    def step4_kalman(self) -> KalmanFairValue:
        _banner(4, "KALMAN FAIR VALUE")
        train_features = self.splits["train"]
        prices = self.panel.loc[train_features.index, "gold_close"].astype(float)
        log_prices = np.log(prices)
        kf = KalmanFairValue()
        kf.fit(log_prices, self.regimes_train)
        gap = kf.result.gap_sigma.dropna()
        wide = float((gap.abs() > 1.2).mean())
        print(f"  mean gap (σ)         : {gap.mean():+.3f}")
        print(f"  std  gap (σ)         : {gap.std():.3f}")
        print(f"  pct |gap| > 1.2σ     : {wide:.1%}")
        try:
            kf.plot_fair_value(prices)
        except Exception as exc:
            log.warning("Kalman plot failed: %s", exc)
        # adaptive β tracker (gold vs real-rate changes)
        if "real_rate_10y" in self.panel.columns:
            rr = self.panel.loc[train_features.index, "real_rate_10y"].astype(float)
            r_gold = train_features["log_return"]
            self.beta_tracker = AdaptiveBetaTracker()
            self.beta_tracker.fit(r_gold, rr.diff())
            print(f"  β-tracker last value : {self.beta_tracker.beta_series.iloc[-1]:+.4f}")
        self.kalman = kf
        return kf

    # ---------- step 5 ------------------------------------------------
    def step5_pca(self) -> MacroCouplingPCA:
        _banner(5, "PCA MACRO COUPLING")
        train_features = self.splits["train"]
        # macro panel uses raw (level) macro columns from the data panel.
        macro_panel = self.panel.loc[train_features.index].copy()
        gold_returns = train_features["log_return"]
        pca = MacroCouplingPCA()
        pca.fit(macro_panel, gold_returns, self.regimes_train)
        pca.print_summary()
        try:
            pca.plot_factor_evolution()
        except Exception as exc:
            log.warning("PCA plot failed: %s", exc)
        self.pca = pca
        return pca

    # ---------- step 6 ------------------------------------------------
    def step6_heston(self) -> HestonCalibrator:
        _banner(6, "HESTON CALIBRATION")
        train_features = self.splits["train"]
        rets = train_features["log_return"].dropna()
        h = HestonCalibrator()
        h.calibrate(rets, self.regimes_train)
        h.print_calibration_summary()
        self.heston = h
        return h

    # ---------- step 7 ------------------------------------------------
    def step7_hawkes(self) -> MertonHawkesProcess:
        _banner(7, "MERTON-HAWKES CALIBRATION")
        train_features = self.splits["train"]
        rets = train_features["log_return"].dropna()
        mh = MertonHawkesProcess()
        mh.calibrate_jumps(rets)
        mh.calibrate_hawkes(rets, self.regimes_train)
        mh.print_summary()
        self.hawkes = mh
        return mh

    # ---------- step 8 ------------------------------------------------
    def step8_entropy(self) -> DualEntropyGuard:
        _banner(8, "DUAL ENTROPY GUARD")
        train_features = self.splits["train"]
        rets = train_features["log_return"].dropna()
        g = DualEntropyGuard()
        g.fit(rets, self.regimes_train)
        g.print_summary()
        try:
            g.plot_entropy_history()
        except Exception as exc:
            log.warning("entropy plot failed: %s", exc)
        self.guard = g
        return g

    # ---------- step 9 ------------------------------------------------
    def step9_breaks(self) -> StructuralBreakDetector:
        _banner(9, "STRUCTURAL BREAK DETECTION")
        if self.beta_tracker is None or self.beta_tracker.beta_series is None:
            print("  (no β series available — skipping)")
            return StructuralBreakDetector()
        d = StructuralBreakDetector()
        d.fit(self.beta_tracker.beta_series)
        d.print_break_summary()
        self.break_detector = d
        return d

    # ---------- step 10 -----------------------------------------------
    def step10_xgboost(self, n_trials: int = 50) -> RegimeAwareScorer:
        _banner(10, "REGIME-AWARE SCORER TRAINING")
        train_features = self.splits["train"]
        prices = self.panel.loc[train_features.index, "gold_close"].astype(float)

        # Extend engines to the full training window so that Kalman gap, PCA
        # factors, and entropy history are available for post-2021 training days.
        self._extend_engines(train_features)

        X = self._build_scorer_features(train_features)
        regimes = self.regimes_train.reindex(train_features.index) if self.regimes_train is not None else pd.Series(2, index=train_features.index)
        returns = train_features["log_return"] if "log_return" in train_features.columns else None
        scorer = RegimeAwareScorer(n_trials=n_trials)
        scorer.fit(X, prices, regimes, returns=returns)
        scorer.print_summary()
        self.scorer = scorer
        return scorer

    # ------------------------------------------------------------------
    def _build_scorer_features(self, base_features: pd.DataFrame) -> pd.DataFrame:
        """Compose the full XGBoost feature matrix from the engine outputs."""
        idx = base_features.index
        frame = pd.DataFrame(index=idx)
        # HMM probabilities
        try:
            proba = self.hmm.predict_proba(base_features)
            frame["P_R2"] = proba["P_R2"].reindex(idx)
            frame["P_R3"] = proba["P_R3"].reindex(idx)
            frame["P_R4"] = proba["P_R4"].reindex(idx) if "P_R4" in proba.columns else np.nan
        except Exception:
            frame["P_R2"] = np.nan
            frame["P_R3"] = np.nan
            frame["P_R4"] = np.nan
        # Kalman gap σ
        if self.kalman and self.kalman.result is not None:
            frame["kalman_gap_sigma"] = self.kalman.result.gap_sigma.reindex(idx)
        # OFI
        if "ofi_proxy_20d" in base_features.columns:
            frame["ofi_proxy_20d"] = base_features["ofi_proxy_20d"]
        # Macro alignment (LONG-direction probe; sign handled by gap inside the layer)
        try:
            factors = self.pca.calibration.factors.reindex(idx)
            macro_align = []
            for ts, row in factors.iterrows():
                regime = int(self.regimes_train.reindex([ts]).ffill().iloc[0]) if ts in self.regimes_train.index else 2
                macro_align.append(self.pca.get_alignment_score(+1, row.values, regime))
            frame["macro_alignment"] = pd.Series(macro_align, index=factors.index).reindex(idx)
        except Exception:
            frame["macro_alignment"] = np.nan
        # ApEn / W2 (from guard fit)
        if self.guard and self.guard.calibration is not None:
            frame["apen"] = self.guard.calibration.apen_history.reindex(idx)
            frame["w2"] = self.guard.calibration.w2_history.reindex(idx)
        # Hawkes ratio
        try:
            hr = []
            rets = base_features["log_return"]
            for i in range(len(idx)):
                if i < 30:
                    hr.append(np.nan)
                    continue
                window = rets.iloc[max(0, i - 60) : i + 1]
                regime = int(self.regimes_train.iloc[i]) if i < len(self.regimes_train) else 2
                params = self.hawkes.hawkes_by_regime.get(regime)
                if params is None:
                    hr.append(np.nan)
                    continue
                lam = self.hawkes.compute_current_intensity(window, regime)
                hr.append(lam / max(params.mu_H, 1e-9))
            frame["hawkes_ratio"] = pd.Series(hr, index=idx)
        except Exception:
            frame["hawkes_ratio"] = np.nan
        # COT z-score (52w on managed-money net)
        if "cot_net_long" in self.panel.columns:
            cot = self.panel["cot_net_long"].reindex(idx).astype(float)
            mu = cot.rolling(252).mean()
            sd = cot.rolling(252).std()
            frame["cot_z52"] = ((cot - mu) / sd.replace(0, np.nan))
        # Seasonality proxy (day-of-week × current regime average return)
        rets = base_features["log_return"]
        dow = pd.Series(idx, index=idx).dt.dayofweek
        season = pd.Series(np.nan, index=idx)
        for d in range(7):
            mask = dow == d
            season[mask] = rets[mask].rolling(60).mean()[mask]
        frame["seasonality"] = season
        # vol ratio
        rv20 = rets.rolling(20).std()
        rv252 = rets.rolling(252).std()
        frame["vol_ratio"] = rv20 / rv252.replace(0, np.nan)
        # β deviation
        if self.beta_tracker is not None and self.beta_tracker.beta_series is not None:
            b = self.beta_tracker.beta_series.reindex(idx)
            frame["beta_dev"] = b - b.rolling(252).mean()
        # momentum (already in features)
        for w in (5, 10, 20):
            col = f"momentum_{w}d"
            if col in base_features.columns:
                frame[col] = base_features[col]
        # Pass-through features from preprocessor (stationary or normalised)
        for col in ("real_rate_abs", "real_rate_delta_21d", "dxy_momentum_ratio",
                    "cot_z_260d", "gold_vs_trend", "trend_strength"):
            if col in base_features.columns:
                frame[col] = base_features[col].reindex(idx)
        return frame.dropna(how="all")

    # ---------- step 11 -----------------------------------------------
    def step11_walk_forward(self):
        val_start = getattr(config, "VALIDATION_START", "2024-11-01")
        _banner(11, f"WALK-FORWARD OUT-OF-SAMPLE BACKTEST ({val_start} -> {config.VALIDATION_END})")
        from .backtest.walk_forward import WalkForwardBacktester
        from .backtest.report import write_report

        oos_start = pd.Timestamp(val_start)
        oos_end = pd.Timestamp(config.VALIDATION_END)
        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()

        full_features = pd.concat([self.splits["train"], self.splits["validation"]])
        self._extend_engines(full_features)
        self._wf_features = self._build_scorer_features(full_features)

        _diag = {"n_miss": 0, "n_exc": 0, "n_score": 0, "n_gap": 0, "n_pass": 0, "scores": []}
        bt = WalkForwardBacktester(signal_factory=self._build_signal_factory(_diag))
        bt.run(ohlc, oos_start=oos_start, oos_end=oos_end)

        sc_pairs = _diag["scores"]   # list of (regime, score) tuples
        print(f"  signal gate  miss={_diag['n_miss']} exc={_diag['n_exc']} "
              f"score_reject={_diag['n_score']} gap_reject={_diag['n_gap']} signals={_diag['n_pass']}")
        if sc_pairs:
            for r in (2, 3, 4):
                rs = [s for rr, s in sc_pairs if rr == r]
                if not rs:
                    continue
                thr_r = config.REGIME_SCORE_THRESHOLDS.get(r, config.CLASS_C_THRESHOLD)
                rs_s = sorted(rs)
                print(f"  R{r} scores   n={len(rs):>4d}  "
                      f"min={rs_s[0]:.1f}  med={rs_s[len(rs)//2]:.1f}  "
                      f"max={rs_s[-1]:.1f}  pct>={thr_r:.0f}: "
                      f"{sum(s>=thr_r for s in rs)/len(rs):.1%}")
        bt.print_report()
        try:
            bt.plot_equity_curve()
        except Exception as exc:
            log.warning("equity plot failed: %s", exc)
        try:
            paths = write_report(bt.report)
            print(f"  artefacts: {paths}")
        except Exception as exc:
            log.warning("report write failed: %s", exc)
        self.bt = bt
        return bt

    # ------------------------------------------------------------------
    def _extend_engines(self, features: pd.DataFrame) -> None:
        """Extend Kalman, Guard, PCA, beta tracker to cover features.index.

        Preserves training-period thresholds (no leakage into calibration).
        Updates self.regimes_train to match the extended index.
        """
        idx = features.index
        full_regimes = self.hmm.predict_regime(features)
        self.regimes_train = full_regimes

        full_prices = self.panel.loc[idx, "gold_close"].astype(float)
        self.kalman.fit(np.log(full_prices), full_regimes)

        if self.guard and self.guard.calibration is not None:
            _w2_thresh = dict(self.guard.calibration.w2_threshold_per_regime)
            _ref_dist = dict(self.guard.calibration.reference_per_regime)
            full_rets = features["log_return"].dropna()
            self.guard.fit(full_rets, full_regimes.reindex(full_rets.index))
            self.guard.calibration.w2_threshold_per_regime = _w2_thresh
            self.guard.calibration.reference_per_regime = _ref_dist

        if self.pca and self.pca.calibration is not None:
            macro_full = self.panel.loc[idx].copy()
            try:
                X_full, _ = self.pca._build_panel(macro_full)
                Xz = self.pca.calibration.scaler.transform(X_full.values)
                F_full = self.pca.calibration.pca.transform(Xz)
                self.pca.calibration.factors = pd.DataFrame(
                    F_full, index=X_full.index,
                    columns=[f"F{i+1}" for i in range(self.pca.k)],
                )
            except Exception as exc:
                log.warning("PCA factor extension failed: %s", exc)

        if self.beta_tracker is not None and "real_rate_10y" in self.panel.columns:
            rr_full = self.panel.loc[idx, "real_rate_10y"].astype(float)
            self.beta_tracker.fit(features["log_return"], rr_full.diff())

    # ------------------------------------------------------------------
    def _classify_signal(self, score: float, regime: int) -> Optional[str]:
        """Return signal class (A/B/C) for a raw p_win*100 score and regime.

        Uses regime-specific A/B thresholds from config.  Class C is not
        available for regime R4.
        """
        a_thr = config.REGIME_CLASS_A.get(regime, config.CLASS_A_THRESHOLD)
        b_thr = config.REGIME_CLASS_B.get(regime, config.CLASS_B_THRESHOLD)
        c_thr = config.REGIME_SCORE_THRESHOLDS.get(regime, config.CLASS_C_THRESHOLD)
        if score >= a_thr:
            return "A"
        if score >= b_thr:
            return "B"
        if score >= c_thr and regime != 4:
            return "C"
        return None

    # ------------------------------------------------------------------
    def _build_signal_factory(self, diag: dict):
        """Return a signal_factory closure over current self state.

        ``diag`` is a mutable dict with keys: n_miss, n_exc, n_score,
        n_gap, n_pass, scores — updated in place for diagnostics.
        """

        def signal_factory(train_panel: pd.DataFrame):
            def evaluator(timestamp: pd.Timestamp):
                if timestamp not in self._wf_features.index:
                    diag["n_miss"] += 1
                    return None
                feat_row = self._wf_features.loc[timestamp]

                # Regime lookup first — needed for scorer dispatch and direction.
                regime = int(
                    self.regimes_train.reindex([timestamp]).ffill().iloc[0]
                    if timestamp in self.regimes_train.index else 2
                )

                try:
                    p_win = self.scorer.predict_proba_for_regime(feat_row, regime)
                except Exception as e:
                    diag["n_exc"] += 1
                    if diag["n_exc"] <= 2:
                        log.warning("predict_proba exc: %r", e)
                    return None

                score = 100.0 * p_win
                regime_thr = config.REGIME_SCORE_THRESHOLDS.get(regime, config.CLASS_C_THRESHOLD)
                diag["scores"].append((regime, score))
                if score < regime_thr:
                    diag["n_score"] += 1
                    return None

                gap = float(feat_row.get("kalman_gap_sigma", 0.0))
                # Kalman gap filter only for R3/R4 (R2 uses momentum direction)
                if regime != 2 and abs(gap) < config.KALMAN_GAP_MIN_SIGMA:
                    diag["n_gap"] += 1
                    return None
                signal_class = self._classify_signal(score, regime)
                if signal_class is None:
                    diag["n_score"] += 1
                    return None
                diag["n_pass"] += 1

                # Regime-conditional direction
                if regime == 2:
                    mom = float(feat_row.get("momentum_20d", 0.0))
                    direction = "LONG" if mom > 0 else "SHORT"
                else:
                    direction = "LONG" if gap < 0 else "SHORT"

                price = float(self.panel.loc[timestamp, "gold_close"])
                rv = float(
                    self.panel.loc[:timestamp, "gold_close"]
                    .pct_change().rolling(20).std().iloc[-1] or 0.005
                )
                sl_dist = rv * price
                tp_dist = 2.0 * sl_dist
                sl = price - sl_dist if direction == "LONG" else price + sl_dist
                tp = price + tp_dist if direction == "LONG" else price - tp_dist
                return {
                    "direction": direction,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "score": score,
                    "signal_class": signal_class,
                    "regime": regime,
                    "c_window": "",   # daily bars — no intraday time
                    "timestamp": timestamp,
                }

            return evaluator

        return signal_factory

    # ------------------------------------------------------------------
    def _print_trade_detail(self, bt) -> None:
        """Print trade-by-trade detail for a completed backtester run."""
        from .backtest.metrics import Trade
        all_trades: list[Trade] = []
        for it in bt.report.iterations:
            all_trades.extend(it.trades)
        if not all_trades:
            print("  (no trades to detail)")
            return
        print(f"\n{'='*80}")
        print("TRADE-BY-TRADE DETAIL  (2024-2025 OOS window)")
        print(f"{'='*80}")
        hdr = (f"{'Date':<12} {'UTC':<6} {'Cls':>3} {'C-Window':<22} "
               f"{'Rgm':>3} {'PnL':>9} {'RR':>6} W/L")
        print(hdr)
        print("-" * 80)
        for t in all_trades:
            date_str = t.timestamp.strftime("%Y-%m-%d") if t.timestamp is not None else "N/A"
            utc_str = t.timestamp.strftime("%H:%M") if t.timestamp is not None else "N/A"
            win_str = "W" if t.win else "L"
            cwin = t.c_window[:20] if t.c_window else "—"
            print(f"{date_str:<12} {utc_str:<6} {t.signal_class:>3} {cwin:<22} "
                  f"R{t.regime:>1} ${t.pnl_dollars:>+8,.0f} {t.rr_realized:>+6.2f}  {win_str}")
        print("-" * 80)
        wins = sum(1 for t in all_trades if t.win)
        print(f"  Total: {len(all_trades)} trades  W={wins}  L={len(all_trades)-wins}  "
              f"WR={wins/len(all_trades):.1%}  "
              f"PnL=${sum(t.pnl_dollars for t in all_trades):+,.0f}")

    # ---------- step 12 -----------------------------------------------
    def step12_verdict(self) -> str:
        _banner(12, "PHASE 0 VERDICT")
        verdict = self.bt.report.go_no_go
        print(f"  >>> {verdict}")
        if verdict.startswith("EDGE"):
            print("  PHASE 0 COMPLETE — EDGE VALIDATED")
        else:
            print("  PHASE 0 INCOMPLETE — see diagnostics above")
        return verdict

    # ------------------------------------------------------------------
    def load_pickled_models(self) -> None:
        """Restore steps 3-9 from disk — skips retraining."""
        _banner(0, "LOADING PICKLED MODELS (steps 3-9)")
        self.hmm = GoldHMM.load(config.MODELS_DIR / "hmm.pkl")
        for name in ("kalman", "pca", "heston", "hawkes", "guard"):
            path = config.MODELS_DIR / f"{name}.pkl"
            if not path.exists():
                raise FileNotFoundError(f"Missing pickle: {path} — run full pipeline first")
            with path.open("rb") as fh:
                setattr(self, name, pickle.load(fh))
        print(f"  loaded: hmm kalman pca heston hawkes guard")
        # Reconstruct training-period regime sequence for _build_scorer_features.
        train_features = self.splits["train"]
        self.regimes_train = self.hmm.predict_regime(train_features)
        # Reconstruct beta tracker (fast, ~1s).
        if "real_rate_10y" in self.panel.columns:
            rr = self.panel.loc[train_features.index, "real_rate_10y"].astype(float)
            self.beta_tracker = AdaptiveBetaTracker()
            self.beta_tracker.fit(train_features["log_return"], rr.diff())

    # ------------------------------------------------------------------
    def run_multi_validation(self, n_trials: int = 10) -> None:
        """Stress-test the fitted models across three distinct market regimes.

        Uses pickled models (trained on 2010-2021).  Engines are extended
        to the full data range once, then the backtester is re-run for each
        window.  Results are printed in a compact comparison table.
        """
        from .backtest.walk_forward import WalkForwardBacktester

        _banner(0, "MULTI-PERIOD VALIDATION")
        t0 = datetime.now()

        self.step1_data()
        self.step2_preprocess()
        self.load_pickled_models()
        self.step10_xgboost(n_trials=n_trials)

        # Extend engines to full data range (train + validation + test).
        all_splits = [self.splits["train"], self.splits["validation"]]
        if "test" in self.splits:
            all_splits.append(self.splits["test"])
        full_features = pd.concat(all_splits)
        # Also include any preprocessed data beyond VALIDATION_END.
        if self.preproc_result is not None:
            full_features = self.preproc_result.features.copy()
        self._extend_engines(full_features)
        self._wf_features = self._build_scorer_features(full_features)

        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()
        table_rows: list[dict] = []

        for label, start, end in config.VALIDATION_WINDOWS:
            print(f"\n{'─'*70}")
            print(f"  Window: {label}  ({start} → {end})")
            print(f"{'─'*70}")
            oos_start = pd.Timestamp(start)
            oos_end = pd.Timestamp(end)

            # Clip to available data.
            if oos_end > self.panel.index.max():
                oos_end = self.panel.index.max()
            if oos_start < self.panel.index.min():
                oos_start = self.panel.index.min()

            diag: dict = {"n_miss": 0, "n_exc": 0, "n_score": 0,
                          "n_gap": 0, "n_pass": 0, "scores": []}
            bt = WalkForwardBacktester(signal_factory=self._build_signal_factory(diag))
            bt.run(ohlc, oos_start=oos_start, oos_end=oos_end)
            bt.print_report()

            if label == "BULL_2024_2025":
                self._print_trade_detail(bt)

            m = bt.report.overall_metrics
            table_rows.append({
                "window":    label,
                "period":    f"{start[:7]} -> {str(oos_end.date())[:7]}",
                "signals":   diag["n_pass"],
                "months":    max(1, round((oos_end - oos_start).days / 30.44)),
                "win_rate":  m.get("win_rate", float("nan")),
                "sharpe":    m.get("sharpe", float("nan")),
                "max_dd":    m.get("max_drawdown", float("nan")),
                "go_no_go":  bt.report.go_no_go,
            })

        # ── comparison table ────────────────────────────────────────────
        print(f"\n{'='*80}")
        print("MULTI-PERIOD VALIDATION SUMMARY")
        print(f"{'='*80}")
        hdr = (f"{'Window':<22} {'Period':<17} {'Sigs':>5} {'Sigs/mo':>7} "
               f"{'WR%':>6} {'Sharpe':>7} {'MaxDD%':>7}  Verdict")
        print(hdr)
        print("─" * 80)
        for row in table_rows:
            spm = row["signals"] / row["months"]
            wr = row["win_rate"]
            sh = row["sharpe"]
            dd = row["max_dd"]
            print(
                f"{row['window']:<22} {row['period']:<18} "
                f"{row['signals']:>5} {spm:>7.1f} "
                f"{(wr*100 if not np.isnan(wr) else float('nan')):>6.1f} "
                f"{(sh if not np.isnan(sh) else float('nan')):>7.2f} "
                f"{(abs(dd)*100 if not np.isnan(dd) else float('nan')):>7.1f} "
                f"{row['go_no_go']:<12}"
            )
        print("─" * 80)
        elapsed = (datetime.now() - t0).total_seconds()
        print(f"\nMulti-validation finished in {elapsed:.0f}s")

    # ------------------------------------------------------------------
    def run_fast(self, n_trials: int = 10) -> str:
        """Re-run steps 10-11 only, loading pickled models from disk.

        Skips HMM / Kalman / Heston / Hawkes / Guard retraining.
        With n_trials=10 Optuna per fold, typical runtime < 120s.
        """
        t0 = datetime.now()
        self.step1_data()
        self.step2_preprocess()
        self.load_pickled_models()
        self.step10_xgboost(n_trials=n_trials)
        self.step11_walk_forward()
        verdict = self.step12_verdict()
        elapsed = (datetime.now() - t0).total_seconds()
        print(f"\nFast run finished in {elapsed:.0f}s")
        return verdict

    # ------------------------------------------------------------------
    def run_full_pipeline(self) -> str:
        t0 = datetime.now()
        self.step1_data()
        self.step2_preprocess()
        self.step3_hmm()
        self.step4_kalman()
        self.step5_pca()
        self.step6_heston()
        self.step7_hawkes()
        self.step8_entropy()
        self.step9_breaks()
        self.step10_xgboost()
        self.step11_walk_forward()
        verdict = self.step12_verdict()
        elapsed = (datetime.now() - t0).total_seconds()
        print(f"\nPipeline finished in {elapsed/60:.1f} min")
        return verdict

    # ------------------------------------------------------------------
    def save_all_models(self) -> None:
        out = config.MODELS_DIR
        if self.hmm is not None:
            self.hmm.save(out / "hmm.pkl")
        with (out / "kalman.pkl").open("wb") as f:
            pickle.dump(self.kalman, f)
        with (out / "pca.pkl").open("wb") as f:
            pickle.dump(self.pca, f)
        with (out / "heston.pkl").open("wb") as f:
            pickle.dump(self.heston, f)
        with (out / "hawkes.pkl").open("wb") as f:
            pickle.dump(self.hawkes, f)
        with (out / "guard.pkl").open("wb") as f:
            pickle.dump(self.guard, f)
        with (out / "scorer.pkl").open("wb") as f:
            pickle.dump(self.scorer, f)


# ===========================================================================
def main(argv: list[str] | None = None) -> int:
    args = argv or []
    fast = "--fast" in args
    multi = "--multi-validate" in args or "--validate-all" in args
    _class_split = "--class-split" in args   # reporting flag — always on now, kept for compat
    # n_trials: 50 in fast/validate modes; 50 default for full pipeline too
    n_trials = 50
    p = Pipeline()
    try:
        if multi:
            p.run_multi_validation(n_trials=n_trials)
        elif fast:
            p.run_fast(n_trials=n_trials)
        else:
            p.run_full_pipeline()
            p.save_all_models()
    except Exception as exc:
        log.exception("pipeline failed: %s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
