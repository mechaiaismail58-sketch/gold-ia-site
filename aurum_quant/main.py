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
    # 1h bar hour (bar-start label) that contains each C-window's minute range.
    _C_WINDOW_HOURS: dict[str, int] = {
        "LONDON_GOLD_FIX": 14,       # 14:52-15:00 → 14:00-15:00 bar
        "NY_OPEN_MOMENTUM": 13,      # 13:30-13:45 → 13:00-14:00 bar
        "LONDON_CLOSE_REVERSION": 16, # 16:00-16:15 → 16:00-17:00 bar
    }

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
        self._bars_1h: Optional[pd.DataFrame] = None   # UTC-naive 1h OHLCV

    # ---------- step 1 ------------------------------------------------
    def step1_data(self) -> pd.DataFrame:
        _banner(1, "DATA COLLECTION")
        collector = DataCollector(fred_api_key=self.fred_api_key)
        self.panel = collector.fetch_all()
        DataCollector.summary(self.panel)
        return self.panel

    # ---------- step 2 ------------------------------------------------
    def step2_preprocess(self, train_end: Optional[str] = None) -> dict[str, pd.DataFrame]:
        _banner(2, "PREPROCESSING")
        prep = Preprocessor()
        result = prep.fit_transform(self.panel)
        prep.print_report(result)
        self.preproc_result = result
        self.splits = prep.split(result.features,
                                  train_end=train_end or config.TRAIN_END)
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
                    "cot_z_260d", "gold_vs_trend", "trend_strength",
                    "market_structure", "market_structure_str"):
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
    def _propagate_model_outputs(self, features: pd.DataFrame) -> pd.DataFrame:
        """Add model outputs as columns to features: HMM regime, Kalman gap, etc."""
        features = features.copy()

        # HMM: regime + posterior probabilities
        if self.hmm is not None:
            try:
                regimes = self.hmm.predict_regime(features)
                features["hmm_regime"] = regimes
                probas = self.hmm.predict_proba(features)
                for col in probas.columns:
                    features[col] = probas[col]
                log.info(f"  [propagate] HMM outputs added: regime + P_R1..P_R4")
            except Exception as e:
                log.warning(f"  [propagate] HMM failed: {e}")

        # Kalman: gap_sigma + beta
        if self.kalman is not None and self.kalman.result is not None:
            try:
                gap_series = self.kalman.result.gap_sigma.reindex(features.index)
                features["kalman_gap_sigma"] = gap_series
                log.info(f"  [propagate] Kalman gap_sigma added")
            except Exception as e:
                log.warning(f"  [propagate] Kalman gap failed: {e}")

        if self.beta_tracker is not None and self.beta_tracker.beta_series is not None:
            try:
                beta_series = self.beta_tracker.beta_series.reindex(features.index)
                features["beta_gold_realrate"] = beta_series
                log.info(f"  [propagate] Beta tracker series added")
            except Exception as e:
                log.warning(f"  [propagate] Beta tracker failed: {e}")

        return features

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
    @classmethod
    def _c_window_from_1h_date(cls, ts: pd.Timestamp, bars_1h: pd.DataFrame) -> str:
        """Return C-window name if a matching 1h bar exists on *ts* date, else ''."""
        day = ts.normalize()
        mask = (bars_1h.index >= day) & (bars_1h.index < day + pd.Timedelta(days=1))
        day_bars = bars_1h.loc[mask]
        if day_bars.empty:
            return ""
        bar_hours = set(day_bars.index.hour)
        for win_name, hour in cls._C_WINDOW_HOURS.items():
            if hour in bar_hours:
                return win_name
        return ""

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
                    # Class A/B require confirmed market structure alignment.
                    # Class C (lower bar) passes without structure filter.
                    if signal_class in ("A", "B"):
                        ms = float(feat_row.get("market_structure", 0.0))
                        required_ms = 1.0 if direction == "LONG" else -1.0
                        if ms != required_ms:
                            diag["n_gap"] += 1   # reuse gap-reject counter
                            return None
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
                # For Class C: look up which C-window 1h bar exists on this date.
                # Signals with no matching bar are tagged hors_fenetre (c_window="")
                # but still simulated so in-window vs out-of-window WR can be compared.
                c_window = ""
                if signal_class == "C" and self._bars_1h is not None:
                    c_window = self._c_window_from_1h_date(timestamp, self._bars_1h)

                return {
                    "direction": direction,
                    "stop_loss": sl,
                    "take_profit": tp,
                    "score": score,
                    "signal_class": signal_class,
                    "regime": regime,
                    "c_window": c_window,
                    "timestamp": timestamp,
                }

            return evaluator

        return signal_factory

    # ------------------------------------------------------------------
    @staticmethod
    def _print_rr_stats(bt, label: str = "") -> None:
        """Print realized RR breakdown: wins (TP), losses (SL), timeouts."""
        from .backtest.metrics import Trade
        all_trades: list[Trade] = []
        for it in bt.report.iterations:
            all_trades.extend(it.trades)
        if not all_trades:
            return
        wins    = [t for t in all_trades if t.win]
        losses  = [t for t in all_trades if not t.win and t.rr_realized == -1.0]
        timeout = [t for t in all_trades if not t.win and t.rr_realized != -1.0]
        import numpy as np
        rrs_all = [t.rr_realized for t in all_trades]
        print(f"\n[RR Stats] {label}  n={len(all_trades)}")
        print(f"  TP hits   : {len(wins):>3d}  median RR = {np.median([t.rr_realized for t in wins]):+.3f}" if wins else "  TP hits   :   0")
        print(f"  SL hits   : {len(losses):>3d}  median RR = {np.median([t.rr_realized for t in losses]):+.3f}" if losses else "  SL hits   :   0")
        print(f"  Timeouts  : {len(timeout):>3d}  median RR = {np.median([t.rr_realized for t in timeout]):+.3f}" if timeout else "  Timeouts  :   0")
        print(f"  ALL trades: {len(all_trades):>3d}  median RR = {np.median(rrs_all):+.3f}"
              f"  mean RR = {np.mean(rrs_all):+.3f}")

    # ------------------------------------------------------------------
    @staticmethod
    def _export_class_c_csv(bt, label: str, out_path: Optional[str] = None) -> str:
        """Export Class C trades to CSV with in-window vs out-of-window breakdown."""
        import csv
        from .backtest.metrics import Trade
        all_trades: list[Trade] = []
        for it in bt.report.iterations:
            all_trades.extend(it.trades)
        class_c = [t for t in all_trades if t.signal_class == "C"]
        path = out_path or f"class_c_{label}.csv"
        with open(path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(["date", "heure_utc", "c_window", "dans_fenetre",
                             "regime", "outcome", "pnl", "rr"])
            for t in class_c:
                date_s = t.timestamp.strftime("%Y-%m-%d") if t.timestamp else ""
                utc_s  = t.timestamp.strftime("%H:%M")    if t.timestamp else "00:00"
                cwin   = t.c_window if t.c_window else ""
                in_win = "oui" if cwin else "non"
                writer.writerow([
                    date_s, utc_s, cwin, in_win,
                    f"R{t.regime}", "W" if t.win else "L",
                    f"{t.pnl_dollars:.2f}", f"{t.rr_realized:.3f}",
                ])

        def _group_stats(trades: list) -> str:
            if not trades:
                return "n=0"
            wr = sum(t.win for t in trades) / len(trades)
            rrs = np.array([t.rr_realized for t in trades])
            sharpe = float(rrs.mean() / (rrs.std() + 1e-9) * np.sqrt(252)) if len(trades) > 1 else float("nan")
            pnl = sum(t.pnl_dollars for t in trades)
            return (f"n={len(trades):>3d}  WR={wr:.1%}  "
                    f"Sharpe={sharpe:+.2f}  PnL=${pnl:>+,.0f}")

        in_w  = [t for t in class_c if t.c_window]
        out_w = [t for t in class_c if not t.c_window]
        has_1h = bool(in_w or out_w)
        print(f"\n[Class C CSV] {label} → {path}  ({len(class_c)} trades)")
        if has_1h and (in_w or out_w):
            print(f"  Dans fenêtre : {_group_stats(in_w)}")
            print(f"  Hors fenêtre : {_group_stats(out_w)}")
        else:
            print(f"  (quotidien — pas de données 1h chargées, tous hors fenêtre)")
            print(f"  Hors fenêtre : {_group_stats(out_w)}")
        return path

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
    def run_multi_validation(
        self,
        n_trials: int = 10,
        window_filter: Optional[str] = None,
        train_end_override: Optional[str] = None,
        export_csv: bool = False,
    ) -> None:
        """Stress-test the fitted models across three distinct market regimes.

        Uses pickled models (trained on 2010-2021).  Engines are extended
        to the full data range once, then the backtester is re-run for each
        window.  Results are printed in a compact comparison table.
        """
        from .backtest.walk_forward import WalkForwardBacktester

        _banner(0, "MULTI-PERIOD VALIDATION")
        if train_end_override:
            print(f"  [strict-cutoff] training cutoff overridden to {train_end_override}")
        t0 = datetime.now()

        self.step1_data()

        # Fetch 1h bars for Class C window tagging (cached, fast on repeat runs).
        collector = DataCollector(fred_api_key=self.fred_api_key)
        bars_1h = collector.fetch_intraday_1h()
        self._bars_1h = bars_1h if not bars_1h.empty else None
        if self._bars_1h is not None:
            print(f"  1h bars: {len(self._bars_1h):,}  "
                  f"{self._bars_1h.index[0].date()} → {self._bars_1h.index[-1].date()}")

        self.step2_preprocess(train_end=train_end_override)
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
        # Propagate model outputs to features
        full_features = self._propagate_model_outputs(full_features)
        self._wf_features = self._build_scorer_features(full_features)

        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()
        table_rows: list[dict] = []

        for label, start, end in config.VALIDATION_WINDOWS:
            if window_filter and label != window_filter:
                continue
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
            # CLASS_C_1H: clip start to actual 1h data availability.
            if label == "CLASS_C_1H" and self._bars_1h is not None:
                h1_start = pd.Timestamp(self._bars_1h.index[0].date())
                if oos_start < h1_start:
                    oos_start = h1_start
                    print(f"  [1h clip] start adjusted to {oos_start.date()} "
                          f"(first 1h bar available)")

            diag: dict = {"n_miss": 0, "n_exc": 0, "n_score": 0,
                          "n_gap": 0, "n_pass": 0, "scores": []}
            bt = WalkForwardBacktester(signal_factory=self._build_signal_factory(diag))
            bt.run(ohlc, oos_start=oos_start, oos_end=oos_end)
            bt.print_report()
            self._print_rr_stats(bt, label)

            if label == "BULL_2024_2025":
                self._print_trade_detail(bt)
            if export_csv:
                self._export_class_c_csv(bt, label)

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
    def run_volume_only(
        self,
        n_trials: int = 50,
        window: str = "BULL_2024_ALL",
        train_end_override: Optional[str] = None,
    ) -> None:
        """Test VolumeEngine ONLY with WalkForwardBacktester (original system).

        No allocator, no MRS, no EVENT. Uses the exact same backtester as
        run_multi_validation to isolate what changed between the working run
        and the broken multi-engine run.
        """
        from .backtest.walk_forward import WalkForwardBacktester

        _banner(0, f"VOLUME ONLY (WFB) — {window}")
        t0 = datetime.now()

        self.step1_data()
        collector = DataCollector(fred_api_key=self.fred_api_key)
        bars_1h = collector.fetch_intraday_1h()
        self._bars_1h = bars_1h if not bars_1h.empty else None

        self.step2_preprocess(train_end=train_end_override)
        self.load_pickled_models()
        self.step10_xgboost(n_trials=n_trials)

        # Extend engines to full data range
        full_features = self.preproc_result.features.copy() if self.preproc_result else pd.concat(list(self.splits.values()))
        self._extend_engines(full_features)
        # Propagate model outputs to features
        full_features = self._propagate_model_outputs(full_features)
        self._wf_features = self._build_scorer_features(full_features)

        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()

        # Find OOS window
        win_cfg = next((w for w in config.VALIDATION_WINDOWS if w[0] == window), None)
        if win_cfg is None:
            print(f"  Window '{window}' not found in config.VALIDATION_WINDOWS")
            return
        _, win_start, win_end = win_cfg
        oos_start = pd.Timestamp(win_start)
        oos_end = min(pd.Timestamp(win_end), self.panel.index.max())

        print(f"  Period: {oos_start.date()} -> {oos_end.date()}")
        print(f"  Using WalkForwardBacktester (original system)")
        print()

        diag: dict = {"n_miss": 0, "n_exc": 0, "n_score": 0, "n_gap": 0, "n_pass": 0, "scores": []}
        bt = WalkForwardBacktester(signal_factory=self._build_signal_factory(diag))
        bt.run(ohlc, oos_start=oos_start, oos_end=oos_end)
        bt.print_report()
        self._print_rr_stats(bt, window)

        elapsed = (datetime.now() - t0).total_seconds()
        print(f"\nVolume-only run finished in {elapsed:.0f}s")

    # ------------------------------------------------------------------
    def run_multi_engine(
        self,
        n_trials: int = 50,
        window: str = "BULL_2024_ALL",
        train_end_override: Optional[str] = None,
    ) -> None:
        """Backtest VolumeEngine + MeanReversionSniper separately and combined.

        Runs on the specified validation window, then estimates P(challenge pass)
        via Monte Carlo bootstrap on the combined trade stream.
        """
        from .signals.engines.volume_engine import VolumeEngine
        from .signals.engines.mean_reversion_sniper import MeanReversionSniper
        from .signals.allocator import (
            MultiEngineAllocator, AllocatorConfig,
            run_multi_engine_backtest, monte_carlo_challenge_pass,
        )

        _banner(0, f"MULTI-ENGINE BACKTEST — {window}")
        t0 = datetime.now()

        self.step1_data()
        collector = DataCollector(fred_api_key=self.fred_api_key)
        bars_1h = collector.fetch_intraday_1h()
        self._bars_1h = bars_1h if not bars_1h.empty else None

        self.step2_preprocess(train_end=train_end_override)
        self.load_pickled_models()
        self.step10_xgboost(n_trials=n_trials)

        # Extend engines + build feature matrix
        full_features = self.preproc_result.features.copy() if self.preproc_result else pd.concat(list(self.splits.values()))
        self._extend_engines(full_features)
        # Propagate model outputs to features
        full_features = self._propagate_model_outputs(full_features)
        self._wf_features = self._build_scorer_features(full_features)

        # Find OOS window
        win_cfg = next((w for w in config.VALIDATION_WINDOWS if w[0] == window), None)
        if win_cfg is None:
            print(f"  Window '{window}' not found in config.VALIDATION_WINDOWS")
            return
        _, win_start, win_end = win_cfg
        oos_start = pd.Timestamp(win_start)
        oos_end = min(pd.Timestamp(win_end), self.panel.index.max())

        ohlc = self.panel[["gold_open", "gold_high", "gold_low", "gold_close"]].copy()

        # ── Per-engine standalone backtest ─────────────────────────────
        from .signals.engines.event_edge import EventEdge

        vol_engine = VolumeEngine(self, bars_1h=self._bars_1h)
        mrs_engine = MeanReversionSniper(self)
        gvz_series = self.panel["gvz"] if "gvz" in self.panel.columns else None
        ee_engine = EventEdge(
            bars_1h=self._bars_1h if self._bars_1h is not None else pd.DataFrame(),
            daily_panel=self.panel,
            regimes_train=self.regimes_train,
            gvz_series=gvz_series,
        ) if self._bars_1h is not None and not self._bars_1h.empty else None

        print(f"\n{'='*70}")
        print("  STANDALONE ENGINE RESULTS")
        print(f"{'='*70}")
        print(f"  Period: {oos_start.date()} -> {oos_end.date()}")
        months = max(1, (oos_end - oos_start).days / 30.44)

        engines_to_test = [(vol_engine, "VOLUME"), (mrs_engine, "MRS")]
        if ee_engine is not None:
            engines_to_test.append((ee_engine, "EVENT"))

        for eng_obj, eng_name in engines_to_test:
            from .signals.allocator import AllocationState, AllocatorConfig
            alloc = MultiEngineAllocator([eng_obj], initial_balance=100_000.0)
            metrics = run_multi_engine_backtest(alloc, ohlc, oos_start, oos_end)
            em = metrics["by_engine"].get(eng_name, {})
            if not em:
                print(f"  {eng_name:<10}: no signals generated")
                continue
            print(f"\n  [{eng_name}]")
            print(f"    n={em['n']:>3d}  WR={em['wr']:.1%}  Sharpe={em['sharpe']:+.2f}  "
                  f"PnL=${em['pnl']:>+,.0f}  MaxDD=${em['max_dd']:>,.0f}  "
                  f"Sigs/mo={em['sigs_mo']:.1f}")

        # ── Combined backtest ───────────────────────────────────────────
        print(f"\n{'='*70}")
        engines_desc = "VOLUME + MRS" + (" + EVENT" if ee_engine else "")
        print(f"  COMBINED ({engines_desc} + ALLOCATOR)")
        print(f"{'='*70}")
        alloc_engines = [vol_engine, mrs_engine]
        if ee_engine is not None:
            alloc_engines.append(ee_engine)
        alloc_combined = MultiEngineAllocator(
            alloc_engines,
            cfg=AllocatorConfig(daily_stop=0.02, weekly_stop=0.04),
            initial_balance=100_000.0,
        )
        metrics_c = run_multi_engine_backtest(alloc_combined, ohlc, oos_start, oos_end)

        for eng_name, em in metrics_c["by_engine"].items():
            print(f"\n  [{eng_name}]")
            print(f"    n={em['n']:>3d}  WR={em['wr']:.1%}  Sharpe={em['sharpe']:+.2f}  "
                  f"PnL=${em['pnl']:>+,.0f}  MaxDD=${em['max_dd']:>,.0f}  Sigs/mo={em['sigs_mo']:.1f}")

        cm = metrics_c.get("combined", {})
        if cm:
            print(f"\n  [COMBINED PORTFOLIO]")
            print(f"    n={cm['n']:>3d}  PnL=${cm['pnl']:>+,.0f}  "
                  f"Sharpe={cm['sharpe']:+.2f}  MaxDD=${cm['max_dd']:>,.0f}")

        # ── Monte Carlo P(challenge pass) ───────────────────────────────
        print(f"\n{'─'*70}")
        print("  MONTE CARLO — P(challenge pass) [10k simulations]")
        print(f"{'─'*70}")
        raw_trades: list[dict] = []
        for eng_trades in metrics_c.get("_raw_trades", {}).values():
            raw_trades.extend(eng_trades)

        if raw_trades:
            p_pass = monte_carlo_challenge_pass(
                raw_trades,
                n_sims=10_000,
                initial_balance=100_000.0,
                profit_target_pct=0.10,
                max_dd_pct=0.05,
                challenge_days=30,
            )
            print(f"  P(challenge pass in 30d) = {p_pass:.1%}  "
                  f"[target +10%, DD cap -5%]")
        else:
            print("  (insufficient trades for Monte Carlo)")

        elapsed = (datetime.now() - t0).total_seconds()
        print(f"\nMulti-engine run finished in {elapsed:.0f}s")

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
    strict = "--strict-cutoff" in args    # train only to 2023-12-31
    export_csv = "--export-csv" in args
    class_c_bt = "--class-c-backtest" in args  # shortcut: CLASS_C_1H + export-csv
    _class_split = "--class-split" in args
    window_filter: Optional[str] = None
    if "--window" in args:
        idx = args.index("--window")
        if idx + 1 < len(args):
            window_filter = args[idx + 1]
    if class_c_bt:
        window_filter = "CLASS_C_1H"
        export_csv = True
    multi_engine = "--multi-engine" in args
    volume_only = "--volume-only" in args
    n_trials = 50
    train_end_override = "2023-12-31" if strict else None
    p = Pipeline()
    try:
        if volume_only:
            vo_window = "BULL_2024_ALL"
            if "--window" in args:
                idx = args.index("--window")
                if idx + 1 < len(args):
                    vo_window = args[idx + 1]
            p.run_volume_only(n_trials=n_trials, window=vo_window,
                              train_end_override=train_end_override)
        elif multi_engine:
            me_window = "BULL_2024_ALL"
            if "--window" in args:
                idx = args.index("--window")
                if idx + 1 < len(args):
                    me_window = args[idx + 1]
            p.run_multi_engine(n_trials=n_trials, window=me_window,
                               train_end_override=train_end_override)
        elif multi or window_filter:
            p.run_multi_validation(n_trials=n_trials, window_filter=window_filter,
                                   train_end_override=train_end_override,
                                   export_csv=export_csv)
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
