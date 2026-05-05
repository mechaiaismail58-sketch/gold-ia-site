"""EVFilter — expected value gate with CVaR contribution accounting.

For each candidate signal:

    EV  =  p_win · RR · risk$  −  (1 − p_win) · risk$  −  spread  −  slippage

A signal is accepted if  EV > min_ev_threshold  (default: 0.05% of account).

CVaR contribution
-----------------
Each trade's incremental contribution to the 95% CVaR is approximated as

    CVaR_contrib  =  risk_fraction · (1 + tail_factor(R))

with regime-specific tail factors:
    R1 (HIGH_VOL)        → 0.60   (fat tails)
    R2 (NORMAL_TREND)    → 0.20
    R3 (LOW_VOL_DRIFT)   → 0.10
    R4 (MEAN_REVERTING)  → 0.30
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .. import config

TAIL_FACTOR: dict[int, float] = {1: 0.60, 2: 0.20, 3: 0.10, 4: 0.30}


@dataclass
class EVResult:
    ev_dollars: float
    cvar_contribution: float
    passes: bool
    minimum_rr: float


class EVFilter:
    """Expected-value computation + CVaR contribution + min-RR helper."""

    def __init__(
        self,
        spread_points: float = config.SPREAD_POINTS,
        slippage_points: float = config.SLIPPAGE_POINTS,
        point_value: float = config.GOLD_POINT_VALUE_USD,
        min_ev_pct: float = 0.0005,
    ) -> None:
        self.spread_points = spread_points
        self.slippage_points = slippage_points
        self.point_value = point_value
        self.min_ev_pct = min_ev_pct

    # ------------------------------------------------------------------
    def _cost_dollars(self) -> float:
        return (self.spread_points + self.slippage_points) * self.point_value

    def compute_ev(
        self,
        p_win: float,
        rr: float,
        risk_dollars: float,
        spread_points: Optional[float] = None,
        slippage_points: Optional[float] = None,
    ) -> float:
        spread = spread_points if spread_points is not None else self.spread_points
        slip = slippage_points if slippage_points is not None else self.slippage_points
        cost = (spread + slip) * self.point_value
        win = p_win * rr * risk_dollars
        loss = (1.0 - p_win) * risk_dollars
        return float(win - loss - cost)

    def compute_cvar_contribution(self, risk_fraction: float, regime: int) -> float:
        return float(risk_fraction * (1.0 + TAIL_FACTOR.get(int(regime), 0.30)))

    def get_minimum_rr_for_ev(
        self,
        p_win: float,
        risk_dollars: float,
        target_ev: Optional[float] = None,
    ) -> float:
        if p_win <= 0 or risk_dollars <= 0:
            return float("inf")
        target = target_ev if target_ev is not None else (risk_dollars * self.min_ev_pct)
        cost = self._cost_dollars()
        # solve for RR: p·RR·risk − (1−p)·risk − cost > target
        return float((target + (1 - p_win) * risk_dollars + cost) / (p_win * risk_dollars))

    def evaluate(
        self,
        p_win: float,
        rr: float,
        risk_dollars: float,
        regime: int,
        account_size: float,
    ) -> EVResult:
        ev = self.compute_ev(p_win, rr, risk_dollars)
        cvar = self.compute_cvar_contribution(risk_dollars / max(account_size, 1e-9), regime)
        passes = ev > (account_size * self.min_ev_pct)
        min_rr = self.get_minimum_rr_for_ev(p_win, risk_dollars, target_ev=account_size * self.min_ev_pct)
        return EVResult(ev_dollars=ev, cvar_contribution=cvar, passes=passes, minimum_rr=min_rr)

    def passes_ev_filter(
        self,
        p_win: float,
        rr: float,
        risk_dollars: float,
        regime: int,
        account_size: float,
    ) -> bool:
        return self.evaluate(p_win, rr, risk_dollars, regime, account_size).passes
