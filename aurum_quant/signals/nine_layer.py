"""NineLayerFilter — sequential 9-layer signal generation engine.

Layer chain (rejection at any layer ⇒ no signal):
    1. HMM regime (favour R2/R3, block R1)
    2. ApEn guard (suppress at ApEn ≥ 0.90, scale by Guard ∈ [0,1])
    3. Kalman fair-value gap (|gap_σ| ≥ 1.2, direction set by sign)
    4. PCA macro alignment (≥ 0.65 with signal direction)
    5. Hawkes clustering (block / shrink based on λ*/μ_H)
    6. Wasserstein distance (multiplicative confidence factor)
    7. EV filter (positive expected value after costs)
    8. Prop firm rules (daily DD, consistency, trailing DD…)
    9. Meta-model confidence (rolling WR-ratio, ApEn trend, W2 trend)

Composite score → signal class A / B / C with the corresponding base risk.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd

from .. import config
from ..engine.entropy_guard import DualEntropyGuard
from ..engine.hmm_regime import GoldHMM
from ..engine.kalman_fv import KalmanFairValue
from ..engine.merton_hawkes import MertonHawkesProcess
from ..engine.pca_macro import MacroCouplingPCA
from ..prop_firms.consistency import ConsistencyManager
from .ev_filter import EVFilter
from .scorer import RegimeAwareScorer as XGBoostScorer
from .sizing import GrossmanZhouSizer, SizerInputs

log = logging.getLogger(__name__)


# ===========================================================================
@dataclass
class MarketState:
    timestamp: pd.Timestamp
    price: float
    recent_log_prices: pd.Series        # ≥ 50 obs
    recent_returns: pd.Series           # ≥ 50 obs
    feature_row: pd.Series              # current feature vector for the scorer
    regime: int
    regime_proba: np.ndarray            # (4,) canonical R1..R4
    macro_factors: np.ndarray           # F(t) ∈ R^k
    intraday_minute_utc: int            # 0..1439
    # account state for Layer 8
    account_firm: Optional[str] = None
    account_state: Optional[dict] = None


@dataclass
class LayerResult:
    name: str
    passed: bool
    value: float
    note: str = ""
    optimal: bool = False  # passes strict A-class threshold
    near: bool = False     # passes relaxed B-class threshold (optimal ⊆ near)


@dataclass
class Signal:
    timestamp: pd.Timestamp
    direction: str
    signal_class: str
    score: float
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_fraction: float
    ev_dollars: float
    win_probability: float
    shap_top3: list[tuple[str, float]] = field(default_factory=list)
    layers_passed: list[str] = field(default_factory=list)
    meta_score: float = 1.0
    guard_value: float = 1.0
    regime: int = 0
    regime_probability: float = 0.0
    c_window: str = ""


# ===========================================================================
class NineLayerFilter:
    LAYER_NAMES: tuple[str, ...] = (
        "HMM_REGIME", "ENTROPY_GUARD", "KALMAN_GAP", "MACRO_ALIGNMENT",
        "HAWKES_CLUSTERING", "WASSERSTEIN", "EV_FILTER", "PROP_RULES", "META_MODEL",
    )

    # 1h bar hour (bar start) that contains each C-window's minute range.
    # LONDON_GOLD_FIX 14:52-15:00 → bar 14:00-15:00 (hour=14)
    # NY_OPEN_MOMENTUM 13:30-13:45 → bar 13:00-14:00 (hour=13)
    # LONDON_CLOSE_REVERSION 16:00-16:15 → bar 16:00-17:00 (hour=16)
    _C_WINDOW_HOURS: dict[str, int] = {
        "LONDON_GOLD_FIX": 14,
        "NY_OPEN_MOMENTUM": 13,
        "LONDON_CLOSE_REVERSION": 16,
    }

    def __init__(
        self,
        hmm: GoldHMM,
        kalman: KalmanFairValue,
        pca: MacroCouplingPCA,
        guard: DualEntropyGuard,
        hawkes: MertonHawkesProcess,
        scorer: XGBoostScorer,
        ev_filter: Optional[EVFilter] = None,
        sizer: Optional[GrossmanZhouSizer] = None,
        consistency: Optional[ConsistencyManager] = None,
        atr_window: int = 14,
        sl_mult: float = 1.0,
        rr_default: float = 2.0,
        bars_1h: Optional[pd.DataFrame] = None,
    ) -> None:
        self.hmm = hmm
        self.kalman = kalman
        self.pca = pca
        self.guard = guard
        self.hawkes = hawkes
        self.scorer = scorer
        self.ev_filter = ev_filter or EVFilter()
        self.sizer = sizer or GrossmanZhouSizer()
        self.consistency = consistency
        self.atr_window = atr_window
        self.sl_mult = sl_mult
        self.rr_default = rr_default
        self._bars_1h = bars_1h   # UTC-naive 1h OHLCV; None = live intraday mode
        # rolling state for meta model
        self._recent_outcomes: list[int] = []  # 1=win, 0=loss
        self._meta_window: int = 30

    # ------------------------------------------------------------------
    def update_outcome(self, win: bool) -> None:
        self._recent_outcomes.append(1 if win else 0)
        if len(self._recent_outcomes) > self._meta_window:
            self._recent_outcomes.pop(0)

    # ------------------------------------------------------------------
    def _layer1_regime(self, state: MarketState) -> LayerResult:
        p_tr = float(state.regime_proba[1] + state.regime_proba[2])
        p_r1 = float(state.regime_proba[0])
        if p_r1 > 0.50:
            return LayerResult("HMM_REGIME", False, p_tr, "R1 dominant")
        opt = p_tr >= config.LAYER1_HMM_OPTIMAL
        near = p_tr >= config.LAYER1_HMM_NEAR
        return LayerResult("HMM_REGIME", near, p_tr, f"P(R2+R3)={p_tr:.2f}", optimal=opt, near=near)

    def _layer2_entropy(self, state: MarketState) -> tuple[LayerResult, float]:
        g = self.guard.get_guard(state.recent_returns, state.regime)
        opt = g >= config.LAYER2_GUARD_OPTIMAL
        near = g >= config.LAYER2_GUARD_NEAR
        return LayerResult("ENTROPY_GUARD", near, g, f"Guard={g:.3f}", optimal=opt, near=near), g

    def _layer3_kalman(self, state: MarketState) -> tuple[LayerResult, str]:
        gap = self.kalman.get_current_gap(state.recent_log_prices, state.regime)
        if abs(gap) < config.LAYER3_GAP_NEAR:
            return LayerResult("KALMAN_GAP", False, gap,
                               f"|gap|={abs(gap):.2f} < {config.LAYER3_GAP_NEAR}s"), "FLAT"
        direction = "SHORT" if gap > 0 else "LONG"
        opt = abs(gap) >= config.LAYER3_GAP_OPTIMAL
        near = abs(gap) >= config.KALMAN_GAP_MIN_SIGMA  # 1.2 is the "near" threshold
        return LayerResult("KALMAN_GAP", near, gap, f"gap={gap:+.2f}s", optimal=opt, near=near), direction

    def _layer4_macro(self, state: MarketState, direction: str) -> LayerResult:
        sgn = +1 if direction == "LONG" else -1
        a = self.pca.get_alignment_score(sgn, state.macro_factors, state.regime)
        opt = a >= config.LAYER4_ALIGN_OPTIMAL
        near = a >= config.LAYER4_ALIGN_NEAR
        return LayerResult("MACRO_ALIGNMENT", near, a, f"align={a:+.3f}", optimal=opt, near=near)

    def _layer5_hawkes(self, state: MarketState, signal_class: Optional[str]) -> tuple[LayerResult, float]:
        params = self.hawkes.hawkes_by_regime.get(state.regime)
        if params is None:
            return LayerResult("HAWKES_CLUSTERING", True, 1.0, "no calibration",
                               optimal=True, near=True), 1.0
        lam = self.hawkes.compute_current_intensity(state.recent_returns, state.regime)
        ratio = lam / max(params.mu_H, 1e-9)
        opt = ratio <= config.LAYER5_HAWKES_OPTIMAL
        near = ratio <= config.LAYER5_HAWKES_NEAR
        # Hawkes adjustment factor for risk sizing
        if ratio > config.HAWKES_CLUSTERING_ALERT:
            adj = 0.6 if signal_class in ("A", "B") else 0.0
        elif ratio > config.LAYER5_HAWKES_OPTIMAL:
            adj = 0.8
        else:
            adj = 1.0
        return LayerResult("HAWKES_CLUSTERING", near, ratio,
                           f"λ/μ={ratio:.2f}", optimal=opt, near=near), adj

    def _layer6_wasserstein(self, state: MarketState) -> tuple[LayerResult, float]:
        if self.guard.calibration is None:
            return LayerResult("WASSERSTEIN", True, 1.0, "n/a",
                               optimal=True, near=True), 1.0
        rec = state.recent_returns.dropna().values[-20:]
        w = self.guard.compute_w2(rec, state.regime)
        wt = self.guard.calibration.w2_threshold_per_regime.get(state.regime, 1.0)
        scale = max(0.0, 1.0 - w / max(wt, 1e-9))
        opt = scale >= config.LAYER6_W2_SCALE_OPTIMAL
        near = scale >= config.LAYER6_W2_SCALE_NEAR
        return LayerResult("WASSERSTEIN", near, scale,
                           f"W2={w:.4f}, thresh={wt:.4f}", optimal=opt, near=near), scale

    def _layer7_ev(
        self,
        state: MarketState,
        p_win: float,
        signal_class: str,
        risk_fraction: float,
    ) -> tuple[LayerResult, float, float, float]:
        # Sketch SL/TP using rolling σ as a proxy ATR
        sigma = float(state.recent_returns.tail(20).std() or 0.0)
        sl_dist = self.sl_mult * sigma * state.price
        tp_dist = self.rr_default * sl_dist
        rr = self.rr_default
        account_size = float((state.account_state or {}).get("current_balance", 100_000.0))
        risk_dollars = max(1.0, risk_fraction * account_size)
        ev_res = self.ev_filter.evaluate(p_win, rr, risk_dollars, state.regime, account_size)
        return LayerResult("EV_FILTER", ev_res.passes, ev_res.ev_dollars,
                           f"EV=${ev_res.ev_dollars:.0f}"), sl_dist, tp_dist, ev_res.ev_dollars

    def _layer8_propfirm(self, state: MarketState, candidate: dict) -> tuple[LayerResult, float, bool]:
        if self.consistency is None or state.account_firm is None:
            return LayerResult("PROP_RULES", True, 1.0, "no firm bound"), 1.0, False
        decision = self.consistency.evaluate(state.account_firm, candidate)
        return (
            LayerResult("PROP_RULES", decision.allowed, decision.size_multiplier,
                        decision.reason if not decision.allowed else "ok"),
            decision.size_multiplier,
            decision.maintenance_mode,
        )

    def _layer9_meta(self, guard_val: float, w2_scale: float) -> LayerResult:
        # Meta = blend of recent WR vs target WR, guard trend, W2 trend.
        if len(self._recent_outcomes) < 5:
            wr = 0.55
        else:
            wr = float(np.mean(self._recent_outcomes))
        wr_score = float(np.clip(wr / 0.65, 0.0, 1.2))
        score = 0.5 * wr_score + 0.3 * guard_val + 0.2 * w2_scale
        return LayerResult("META_MODEL", score > config.META_MODEL_MIN, float(score), f"meta={score:.3f}")

    # ------------------------------------------------------------------
    @staticmethod
    def _classify_from_layers(layers: list[LayerResult]) -> Optional[str]:
        """Vote on 6 core layers: 6/6 optimal=A, 5 optimal+1 near=B, else None."""
        n_opt = sum(1 for lr in layers if lr.optimal)
        n_near_only = sum(1 for lr in layers if lr.near and not lr.optimal)
        if n_opt == 6:
            return "A"
        if n_opt == 5 and n_near_only >= 1:
            return "B"
        return None

    # ------------------------------------------------------------------
    def _classify(self, score: float) -> Optional[str]:
        if score >= config.CLASS_A_THRESHOLD:
            return "A"
        if score >= config.CLASS_B_THRESHOLD:
            return "B"
        if score >= config.CLASS_C_THRESHOLD:
            return "C"
        return None

    @staticmethod
    def _is_class_c_window(minute_utc: int) -> bool:
        for start, end in config.CLASS_C_WINDOWS_UTC.values():
            if start <= minute_utc <= end:
                return True
        return False

    @staticmethod
    def _c_window_name(minute_utc: int) -> Optional[str]:
        for name, (start, end) in config.CLASS_C_WINDOWS_UTC.items():
            if start <= minute_utc <= end:
                return name
        return None

    @classmethod
    def _c_window_from_1h(cls, date: pd.Timestamp, bars_1h: pd.DataFrame) -> Optional[str]:
        """Return the first C-window name whose 1h bar exists on *date*.

        Checks whether a 1h bar at the expected UTC hour is present in
        ``bars_1h`` for the given trading date.  If none of the three window
        hours are covered, returns None (→ Class C rejected).
        """
        day = date.normalize()
        mask = (bars_1h.index >= day) & (bars_1h.index < day + pd.Timedelta(days=1))
        day_bars = bars_1h.loc[mask]
        if day_bars.empty:
            return None
        bar_hours = set(day_bars.index.hour)
        for win_name, hour in cls._C_WINDOW_HOURS.items():
            if hour in bar_hours:
                return win_name
        return None

    @staticmethod
    def _base_risk(cls: str) -> float:
        return {"A": config.CLASS_A_BASE_RISK, "B": config.CLASS_B_BASE_RISK, "C": config.CLASS_C_BASE_RISK}[cls]

    # ------------------------------------------------------------------
    def evaluate(self, state: MarketState) -> tuple[Optional[Signal], list[LayerResult]]:
        """Three-path classification:
          Class A — 6/6 core layers at optimal threshold
          Class B — 5/6 optimal + 1 near-threshold
          Class C — composite score >= CLASS_C_THRESHOLD + temporal window + regime R2/R3
        Layers 7-9 (EV, prop-firm, meta-model) apply to all classes.
        """
        results: list[LayerResult] = []

        # ── XGB scoring (needed for composite score in all paths) ─────
        try:
            p_win = float(self.scorer.predict_proba(pd.DataFrame([state.feature_row])).iloc[0])
        except Exception as exc:
            log.warning("Scorer failed: %s", exc)
            p_win = 0.55

        # ── Evaluate all 6 core layers (non-blocking) ─────────────────
        l1 = self._layer1_regime(state)
        l2, guard_val = self._layer2_entropy(state)
        l3, direction = self._layer3_kalman(state)
        l4 = self._layer4_macro(state, direction)
        l5, hawkes_adj = self._layer5_hawkes(state, None)   # class unknown yet
        l6, w2_scale = self._layer6_wasserstein(state)
        core_layers = [l1, l2, l3, l4, l5, l6]

        # Composite score (used for Class C check and ranking)
        gap_norm = float(np.clip(abs(l3.value) / 3.0, 0.0, 1.0))
        composite = 100.0 * (
            0.6 * p_win
            + 0.15 * max(0.0, guard_val)
            + 0.15 * max(0.0, float(l4.value))
            + 0.10 * gap_norm
        )

        # ── Class determination ────────────────────────────────────────
        c_window = ""
        signal_class: Optional[str] = self._classify_from_layers(core_layers)

        if signal_class is None:
            # Class C fast path: composite score ≥ threshold + R2/R3 + C-window presence.
            # With 1h bars: verify a window bar exists on this date (reject if not).
            # Without 1h bars (live intraday): check state.intraday_minute_utc directly.
            if composite >= config.CLASS_C_THRESHOLD and state.regime in (2, 3):
                if self._bars_1h is not None and not self._bars_1h.empty:
                    c_window = self._c_window_from_1h(state.timestamp, self._bars_1h) or ""
                else:
                    c_window = self._c_window_name(state.intraday_minute_utc) or ""
                if c_window:
                    signal_class = "C"

        if signal_class is None:
            results.append(LayerResult("CLASSIFY", False, composite, "below A/B/C threshold"))
            return None, results

        # Attach core layer results (passed reflects the class being issued)
        for lr in core_layers:
            if signal_class == "A":
                passed = lr.optimal
            elif signal_class == "B":
                passed = lr.near
            else:   # Class C — layer check is informational
                passed = lr.near
            results.append(LayerResult(lr.name, passed, lr.value, lr.note,
                                       optimal=lr.optimal, near=lr.near))

        results.append(LayerResult("CLASSIFY", True, composite, f"Class {signal_class}"))

        # Update hawkes_adj with final class knowledge
        l5_final, hawkes_adj = self._layer5_hawkes(state, signal_class)

        # Class C: Kalman gap may be absent — fall back to guard direction
        if signal_class == "C" and direction == "FLAT":
            direction = "LONG" if guard_val > 0 else "SHORT"

        # Provisional risk fraction (used for EV check)
        base_r = self._base_risk(signal_class)
        provisional_risk = base_r * guard_val * w2_scale * hawkes_adj

        l7, sl_dist, tp_dist, ev_dollars = self._layer7_ev(
            state, p_win, signal_class, provisional_risk
        )
        results.append(l7)
        if not l7.passed:
            return None, results

        candidate = {
            "risk_dollars": provisional_risk * float((state.account_state or {}).get("current_balance", 100_000.0)),
            "direction": direction,
        }
        l8, prop_mult, maintenance = self._layer8_propfirm(state, candidate)
        results.append(l8)
        if not l8.passed:
            return None, results

        l9 = self._layer9_meta(guard_val, w2_scale)
        results.append(l9)
        if not l9.passed:
            return None, results
        meta_score = float(l9.value)

        # Final risk sizing
        if maintenance:
            signal_class = "C"
            base_r = 0.005
        acct = state.account_state or {}
        sizer_inputs = SizerInputs(
            base_risk=base_r,
            account_profit_pct=float(acct.get("current_balance", 100_000.0) / max(acct.get("initial_balance", 100_000.0), 1.0) - 1.0),
            consecutive_losses=int(acct.get("consecutive_losses", 0)),
            daily_dd_pct=float(acct.get("daily_dd_pct", 0.0)),
            meta_score=meta_score,
            hawkes_adj=hawkes_adj * w2_scale * prop_mult,
        )
        final_risk = self.sizer.compute_final_size(sizer_inputs)

        # SL/TP in price space
        if direction == "LONG":
            sl = state.price - sl_dist
            tp = state.price + tp_dist
        else:
            sl = state.price + sl_dist
            tp = state.price - tp_dist

        # Top SHAP features
        shap_top: list[tuple[str, float]] = []
        try:
            sv = self.scorer.get_shap_values(pd.DataFrame([state.feature_row]))
            if not sv.empty:
                row = sv.iloc[0].abs().sort_values(ascending=False).head(3)
                shap_top = [(idx, float(sv.iloc[0][idx])) for idx in row.index]
        except Exception:
            pass

        signal = Signal(
            timestamp=state.timestamp,
            direction=direction,
            signal_class=signal_class,
            score=composite,
            entry_price=state.price,
            stop_loss=float(sl),
            take_profit=float(tp),
            risk_fraction=final_risk,
            ev_dollars=ev_dollars,
            win_probability=p_win,
            shap_top3=shap_top,
            layers_passed=[r.name for r in results if r.passed],
            meta_score=meta_score,
            guard_value=guard_val,
            regime=state.regime,
            regime_probability=float(state.regime_proba[state.regime - 1]),
            c_window=c_window,
        )
        return signal, results

    # ------------------------------------------------------------------
    def get_layer_status(self, state: MarketState) -> list[LayerResult]:
        """Compute each layer non-blockingly for dashboard display."""
        out: list[LayerResult] = []
        out.append(self._layer1_regime(state))
        try:
            l2, _ = self._layer2_entropy(state)
            out.append(l2)
        except Exception:
            pass
        try:
            l3, _ = self._layer3_kalman(state)
            out.append(l3)
        except Exception:
            pass
        return out
