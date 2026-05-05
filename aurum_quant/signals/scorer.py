"""RegimeAwareScorer — per-regime XGBoost classifiers with walk-forward CV.

Three independent models are trained on regime-specific days only:
  - scorer_R2: trend days  (momentum, DXY momentum, COT)
  - scorer_R3: drift days  (Kalman gap, real rates, macro alignment)
  - scorer_R4: reverting days (entropy, Hawkes intensity, vol)

Each model has its own walk-forward CV window tuned to regime frequency:
  R2 (252/21/63) — most frequent, standard 1-year train window
  R3 (200/15/50) — moderate frequency, tighter window
  R4 ( 80/ 5/25) — sparse, very tight window to get ≥4 folds
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import optuna
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from xgboost import XGBClassifier

from .. import config

log = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)


# ---------------------------------------------------------------------------
# Calibrator (unchanged from original)
# ---------------------------------------------------------------------------
class _PrefitCalibrator:
    """Isotonic calibration on a prefit XGBClassifier (sklearn 1.8-compatible).

    Replicates sklearn's former ``cv='prefit'`` behaviour that was removed in
    sklearn 1.8.  The base estimator must already be fitted.  ``fit()`` runs
    the base on ``X`` and trains an isotonic regression on raw probs vs ``y``.
    """

    def __init__(self, base: XGBClassifier, holdout_fraction: float = 0.2) -> None:
        self.base = base
        self.holdout_fraction = holdout_fraction
        self._iso: Optional[IsotonicRegression] = None

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "_PrefitCalibrator":
        raw = self.base.predict_proba(X)[:, 1]
        iso = IsotonicRegression(out_of_bounds="clip")
        iso.fit(raw, y.values if hasattr(y, "values") else y)
        self._iso = iso
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        raw = self.base.predict_proba(X)[:, 1]
        cal = self._iso.transform(raw) if self._iso is not None else raw
        return np.column_stack([1.0 - cal, cal])


# ---------------------------------------------------------------------------
# Metrics dataclasses
# ---------------------------------------------------------------------------
@dataclass
class FoldMetrics:
    fold_id: int
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    auc: float
    brier: float
    log_loss: float
    n_train: int
    n_test: int


@dataclass
class XGBArtifacts:
    feature_names: list[str]
    folds: list[FoldMetrics] = field(default_factory=list)
    best_params: dict = field(default_factory=dict)
    feature_importances: Optional[pd.Series] = None


# ---------------------------------------------------------------------------
# Per-regime feature sets and walk-forward windows
# ---------------------------------------------------------------------------
REGIME_FEATURES: dict[int, tuple[str, ...]] = {
    2: ("momentum_5d", "momentum_10d", "momentum_20d",
        "dxy_momentum_ratio", "real_rate_delta_21d", "cot_z_260d",
        "gold_vs_trend", "trend_strength"),
    3: ("kalman_gap_sigma", "real_rate_abs", "beta_dev",
        "macro_alignment", "P_R3", "w2"),
    4: ("kalman_gap_sigma", "P_R4", "apen",
        "hawkes_ratio", "vol_ratio", "ofi_proxy_20d"),
}

REGIME_WF: dict[int, dict] = {
    2: {"train_window": 252, "gap": 21, "test_window": 63},
    3: {"train_window": 200, "gap": 15, "test_window": 50},
    4: {"train_window": 80,  "gap": 5,  "test_window": 25},
}


# ---------------------------------------------------------------------------
# Target helpers
# ---------------------------------------------------------------------------
def _build_target(prices: pd.Series, horizon: int = 5, cost_bps: float = 5.0) -> pd.Series:
    """y_t = 1 iff forward ``horizon``-day log return exceeds cost threshold."""
    fwd = np.log(prices.shift(-horizon) / prices)
    return (fwd > cost_bps / 1e4).astype(int)


def _build_target_r2(features: pd.DataFrame, returns: pd.Series) -> pd.Series:
    """R2-specific target: pullback within an existing trend.

    y = 1 if the current bar is a counter-trend retracement worth fading:
      - uptrend (momentum_20d > 0) AND today's return < -0.3%  (buy the dip)
      - downtrend (momentum_20d < 0) AND today's return > +0.3%  (sell the rally)

    Direction at signal time = sign(momentum_20d) — always follow the trend,
    fading the short-term counter-move.
    """
    mom = features["momentum_20d"].reindex(features.index)
    ret1d = returns.reindex(features.index)
    bull_pullback = (mom > 0) & (ret1d < -0.003)
    bear_rally = (mom < 0) & (ret1d > 0.003)
    return (bull_pullback | bear_rally).astype(int)


# ---------------------------------------------------------------------------
# Single-regime scorer
# ---------------------------------------------------------------------------
class _SingleRegimeScorer:
    """Walk-forward XGBoost + isotonic calibration for one HMM regime."""

    def __init__(self, regime: int, n_trials: int = 50, seed: int = config.SEED) -> None:
        self.regime = regime
        self.n_trials = n_trials
        self.seed = seed
        wf = REGIME_WF[regime]
        self.train_window = wf["train_window"]
        self.gap = wf["gap"]
        self.test_window = wf["test_window"]
        self.features: tuple[str, ...] = REGIME_FEATURES[regime]
        self.model: Optional[_PrefitCalibrator] = None
        self.artifacts = XGBArtifacts(feature_names=list(self.features))

    # ------------------------------------------------------------------
    def _filter(self, df: pd.DataFrame) -> pd.DataFrame:
        usable = [f for f in self.features if f in df.columns]
        if len(usable) < 3:
            raise ValueError(f"R{self.regime}: need ≥3 features; got {usable}")
        if len(usable) < len(self.features):
            log.warning("R%d missing features: %s", self.regime,
                        set(self.features) - set(usable))
        self.features = tuple(usable)
        self.artifacts.feature_names = list(usable)
        return df[list(usable)].copy()

    # ------------------------------------------------------------------
    def _objective(self, X: pd.DataFrame, y: pd.Series):
        def fn(trial: optuna.Trial) -> float:
            params = dict(
                max_depth=trial.suggest_int("max_depth", 3, 7),
                learning_rate=trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
                n_estimators=trial.suggest_int("n_estimators", 100, 500),
                subsample=trial.suggest_float("subsample", 0.6, 1.0),
                colsample_bytree=trial.suggest_float("colsample_bytree", 0.5, 1.0),
                reg_alpha=trial.suggest_float("reg_alpha", 1e-4, 1.0, log=True),
                reg_lambda=trial.suggest_float("reg_lambda", 1e-4, 5.0, log=True),
                gamma=trial.suggest_float("gamma", 0.0, 5.0),
                random_state=self.seed, eval_metric="logloss",
                tree_method="hist", n_jobs=-1,
            )
            split = int(0.8 * len(X))
            m = XGBClassifier(**params)
            m.fit(X.iloc[:split], y.iloc[:split],
                  eval_set=[(X.iloc[split:], y.iloc[split:])], verbose=False)
            pred = m.predict_proba(X.iloc[split:])[:, 1]
            return float(log_loss(y.iloc[split:], pred, labels=[0, 1]))
        return fn

    # ------------------------------------------------------------------
    def fit(self, X: pd.DataFrame, y: pd.Series) -> "_SingleRegimeScorer":
        n = len(X)
        i = 0
        fold_id = 0
        while i + self.train_window + self.gap + self.test_window <= n:
            tr_end = i + self.train_window
            te_start = tr_end + self.gap
            te_end = te_start + self.test_window
            Xtr, ytr = X.iloc[i:tr_end], y.iloc[i:tr_end]
            Xte, yte = X.iloc[te_start:te_end], y.iloc[te_start:te_end]
            if ytr.nunique() < 2:
                i += self.test_window
                continue
            try:
                study = optuna.create_study(
                    direction="minimize",
                    sampler=optuna.samplers.TPESampler(seed=self.seed + fold_id),
                )
                study.optimize(self._objective(Xtr, ytr), n_trials=self.n_trials,
                               show_progress_bar=False)
                best = dict(study.best_params)
                best.update(dict(random_state=self.seed, eval_metric="logloss",
                                 tree_method="hist", n_jobs=-1))
                cut = int(0.8 * len(Xtr))
                base = XGBClassifier(**best).fit(Xtr.iloc[:cut], ytr.iloc[:cut], verbose=False)
                cal = _PrefitCalibrator(base)
                cal.fit(Xtr.iloc[cut:], ytr.iloc[cut:])
                pred = cal.predict_proba(Xte)[:, 1]
                self.artifacts.folds.append(FoldMetrics(
                    fold_id=fold_id,
                    train_start=Xtr.index[0], train_end=Xtr.index[-1],
                    test_start=Xte.index[0], test_end=Xte.index[-1],
                    auc=float(roc_auc_score(yte, pred)) if yte.nunique() == 2 else float("nan"),
                    brier=float(brier_score_loss(yte, pred)),
                    log_loss=float(log_loss(yte, pred, labels=[0, 1])),
                    n_train=len(Xtr), n_test=len(Xte),
                ))
                self.artifacts.best_params = best
            except Exception as exc:
                log.error("R%d fold %d: %s", self.regime, fold_id, exc)
            fold_id += 1
            i += self.test_window

        # Final model on all regime-days
        if not self.artifacts.best_params:
            self.artifacts.best_params = dict(
                max_depth=4, learning_rate=0.05, n_estimators=300,
                subsample=0.8, colsample_bytree=0.8, reg_alpha=0.01, reg_lambda=1.0,
                gamma=0.0, random_state=self.seed, eval_metric="logloss",
                tree_method="hist", n_jobs=-1,
            )
        cut = int(0.8 * len(X))
        base = XGBClassifier(**self.artifacts.best_params).fit(
            X.iloc[:cut], y.iloc[:cut], verbose=False)
        self.model = _PrefitCalibrator(base)
        self.model.fit(X.iloc[cut:], y.iloc[cut:])
        try:
            imp = pd.Series(base.feature_importances_, index=X.columns).sort_values(ascending=False)
            self.artifacts.feature_importances = imp
        except Exception:
            pass
        return self

    # ------------------------------------------------------------------
    def predict_proba(self, feat_row) -> float:
        """Return calibrated p_win for one row (dict or pd.Series)."""
        if self.model is None:
            return 0.5
        X = pd.DataFrame([{f: feat_row.get(f, np.nan) for f in self.features}])
        return float(self.model.predict_proba(X)[:, 1][0])

    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        a = self.artifacts
        folds = a.folds
        print(f"\n  [R{self.regime}] {len(folds)} folds  "
              f"features={list(a.feature_names)}")
        if folds:
            aucs = [f.auc for f in folds if not np.isnan(f.auc)]
            briers = [f.brier for f in folds]
            if aucs:
                print(f"    mean AUC   : {np.mean(aucs):.3f}  (n={len(aucs)})")
            print(f"    mean Brier : {np.mean(briers):.3f}")
        if a.feature_importances is not None:
            top = a.feature_importances.head(4)
            top_str = "  ".join(f"{k}={v:.3f}" for k, v in top.items())
            print(f"    top4  : {top_str}")


# ---------------------------------------------------------------------------
# Facade: RegimeAwareScorer
# ---------------------------------------------------------------------------
class RegimeAwareScorer:
    """Three independent XGBoost scorers, one per HMM regime (R2 / R3 / R4).

    Usage
    -----
    scorer.fit(features, prices, regimes)          # train
    p = scorer.predict_proba_for_regime(row, r)    # inference (0–1)
    """

    def __init__(self, n_trials: int = 50, seed: int = config.SEED) -> None:
        self.n_trials = n_trials
        self.seed = seed
        self._scorers: dict[int, _SingleRegimeScorer] = {}

    # ------------------------------------------------------------------
    def fit(self, features: pd.DataFrame, prices: pd.Series,
            regimes: pd.Series,
            returns: Optional[pd.Series] = None) -> "RegimeAwareScorer":
        y_all = _build_target(prices)
        for regime in (2, 3, 4):
            mask = regimes.reindex(features.index).fillna(2) == regime
            X_r = features.loc[mask].copy()
            # R2 uses pullback-in-trend target; R3/R4 use 5-day forward return target.
            if regime == 2 and returns is not None and "momentum_20d" in features.columns:
                y_regime = _build_target_r2(X_r, returns)
            else:
                y_regime = y_all
            y_r = y_regime.reindex(X_r.index).dropna().astype(int)
            X_r = X_r.reindex(y_r.index)

            scorer_r = _SingleRegimeScorer(
                regime=regime, n_trials=self.n_trials, seed=self.seed)
            try:
                X_r = scorer_r._filter(X_r)
            except ValueError as exc:
                log.warning("R%d: %s — skipping", regime, exc)
                continue

            X_r = X_r.dropna(how="all")
            y_r = y_r.reindex(X_r.index).dropna()
            X_r = X_r.reindex(y_r.index)

            min_req = scorer_r.train_window + scorer_r.gap + scorer_r.test_window
            if len(X_r) < min_req:
                log.warning("R%d: %d days < min %d — fitting on full set (no WF CV)",
                            regime, len(X_r), min_req)

            log.info("Training R%d scorer on %d regime-days …", regime, len(X_r))
            scorer_r.fit(X_r, y_r)
            self._scorers[regime] = scorer_r

        return self

    # ------------------------------------------------------------------
    def predict_proba_for_regime(self, feat_row, regime: int) -> float:
        """Dispatch to the scorer for *regime*; fall back to R2 if unknown."""
        scorer = self._scorers.get(regime) or self._scorers.get(2)
        if scorer is None:
            return 0.5
        return scorer.predict_proba(feat_row)

    # ------------------------------------------------------------------
    def print_summary(self) -> None:
        print(f"\n[RegimeAwareScorer] {len(self._scorers)} regime models")
        for r in sorted(self._scorers):
            self._scorers[r].print_summary()
