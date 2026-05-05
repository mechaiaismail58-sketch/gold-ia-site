"""PropFirmRulesDB — exact rule set for 7 prop firms.

Each firm exposes the numeric thresholds and a structured ``ConsistencyRule``
so :mod:`prop_firms.consistency` can enforce them at signal-time without
re-reading the literature.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class ConsistencyRule:
    """``ratio_type`` ∈ {'pnl_ratio','trade_ratio','days_ratio'} or None."""
    ratio_type: Optional[str]
    threshold: float
    description: str


@dataclass(frozen=True)
class PropFirmPhase:
    name: str
    profit_target_pct: float
    daily_dd_pct: float
    max_dd_pct: float
    min_trading_days: int
    consistency: Optional[ConsistencyRule] = None
    trailing_dd: bool = False
    notes: str = ""
    scaling: Optional[str] = None


@dataclass(frozen=True)
class PropFirmRules:
    name: str
    phases: dict[str, PropFirmPhase]
    notes: str = ""


# ===========================================================================
def _ftmo() -> PropFirmRules:
    cons = ConsistencyRule(
        ratio_type="pnl_ratio",
        threshold=0.40,
        description="No single day P&L > 40% of total monthly profit",
    )
    return PropFirmRules(
        name="FTMO",
        phases={
            "challenge": PropFirmPhase("challenge", 0.10, 0.05, 0.10, 10, cons,
                                       scaling="x1.25 at +10% funded"),
            "verification": PropFirmPhase("verification", 0.05, 0.05, 0.10, 10, cons),
            "funded": PropFirmPhase("funded", 0.0, 0.05, 0.10, 0, cons,
                                    scaling="x1.25 at +10% funded"),
        },
    )


def _apex() -> PropFirmRules:
    return PropFirmRules(
        name="Apex Trader",
        phases={
            "evaluation": PropFirmPhase("evaluation", 0.03, 0.01, 0.03, 0, None,
                                        trailing_dd=True,
                                        notes="Trailing DD on equity peak (locks at +3%)."),
            "funded": PropFirmPhase("funded", 0.0, 0.01, 0.03, 0, None,
                                    trailing_dd=True),
        },
        notes="Trailing drawdown is the critical constraint — peak equity, not balance.",
    )


def _the5ers() -> PropFirmRules:
    cons = ConsistencyRule(
        ratio_type="pnl_ratio",
        threshold=0.50,
        description="No day > 50% of monthly profit",
    )
    return PropFirmRules(
        name="The5ers",
        phases={
            "evaluation": PropFirmPhase("evaluation", 0.08, 0.04, 0.08, 0, cons),
            "funded": PropFirmPhase("funded", 0.0, 0.04, 0.08, 0, cons,
                                    scaling="x2 at +6% funded"),
        },
    )


def _e8() -> PropFirmRules:
    cons = ConsistencyRule(
        ratio_type="trade_ratio",
        threshold=0.30,
        description="No single trade > 30% of total profit",
    )
    return PropFirmRules(
        name="E8 Funding",
        phases={
            "phase1": PropFirmPhase("phase1", 0.08, 0.05, 0.08, 5, cons),
            "phase2": PropFirmPhase("phase2", 0.05, 0.05, 0.08, 5, cons),
            "funded": PropFirmPhase("funded", 0.0, 0.05, 0.08, 0, cons),
        },
    )


def _funded_next() -> PropFirmRules:
    return PropFirmRules(
        name="Funded Next",
        phases={
            "phase1": PropFirmPhase("phase1", 0.10, 0.05, 0.10, 5, None,
                                    notes="News blackout 2 min before/after high-impact only"),
            "phase2": PropFirmPhase("phase2", 0.05, 0.05, 0.10, 5, None),
            "funded": PropFirmPhase("funded", 0.0, 0.05, 0.10, 0, None),
        },
    )


def _blue_guardian() -> PropFirmRules:
    return PropFirmRules(
        name="Blue Guardian",
        phases={
            "phase1": PropFirmPhase("phase1", 0.10, 0.04, 0.08, 5, None),
            "phase2": PropFirmPhase("phase2", 0.05, 0.04, 0.08, 5, None),
            "funded": PropFirmPhase("funded", 0.0, 0.04, 0.08, 0, None),
        },
    )


def _alpha_capital() -> PropFirmRules:
    cons = ConsistencyRule(
        ratio_type="days_ratio",
        threshold=0.50,
        description="At least 50% of trading days must be profitable on payout review",
    )
    return PropFirmRules(
        name="Alpha Capital",
        phases={
            "evaluation": PropFirmPhase("evaluation", 0.10, 0.04, 0.10, 10, cons),
            "funded": PropFirmPhase("funded", 0.0, 0.04, 0.10, 10, cons),
        },
    )


# ===========================================================================
class PropFirmRulesDB:
    def __init__(self) -> None:
        self._firms: dict[str, PropFirmRules] = {
            "FTMO": _ftmo(),
            "Apex": _apex(),
            "The5ers": _the5ers(),
            "E8": _e8(),
            "FundedNext": _funded_next(),
            "BlueGuardian": _blue_guardian(),
            "AlphaCapital": _alpha_capital(),
        }

    def list_firms(self) -> list[str]:
        return list(self._firms.keys())

    def get_firm(self, firm_name: str) -> PropFirmRules:
        if firm_name not in self._firms:
            raise KeyError(f"Unknown firm: {firm_name}. Available: {self.list_firms()}")
        return self._firms[firm_name]

    # ------------------------------------------------------------------
    def get_phase(self, firm_name: str, phase: str) -> PropFirmPhase:
        firm = self.get_firm(firm_name)
        if phase not in firm.phases:
            raise KeyError(f"Phase {phase} not in {firm_name}: {list(firm.phases)}")
        return firm.phases[phase]

    def get_daily_dd_remaining(
        self,
        account_state: dict,
        firm_name: str,
    ) -> float:
        """Dollars remaining before the daily DD limit kicks in."""
        phase = self.get_phase(firm_name, account_state.get("phase", "funded"))
        initial = float(account_state["initial_balance"])
        daily_pnl = float(account_state.get("daily_pnl", 0.0))
        limit = phase.daily_dd_pct * initial
        return max(0.0, limit + daily_pnl)  # daily_pnl is negative on loss days

    def check_signal_compliance(
        self,
        signal: dict,
        account_state: dict,
        firm_name: str,
    ) -> tuple[bool, str]:
        """Cheap pre-trade check.  Heavy logic lives in ConsistencyManager."""
        phase = self.get_phase(firm_name, account_state.get("phase", "funded"))
        risk_dollars = float(signal.get("risk_dollars", 0.0))
        rem = self.get_daily_dd_remaining(account_state, firm_name)
        if risk_dollars > rem:
            return False, f"risk ${risk_dollars:.0f} > daily DD remaining ${rem:.0f}"

        # Apex trailing DD
        if phase.trailing_dd:
            initial = float(account_state["initial_balance"])
            peak = float(account_state.get("equity_peak", initial))
            current = float(account_state.get("current_equity", initial))
            bust = peak - phase.max_dd_pct * initial
            if current - risk_dollars < bust:
                return False, f"trailing DD: equity {current:.0f} − risk would breach bust {bust:.0f}"

        # E8 single-trade ratio
        if phase.consistency and phase.consistency.ratio_type == "trade_ratio":
            monthly = float(account_state.get("monthly_pnl", 0.0))
            if monthly > 0 and risk_dollars > phase.consistency.threshold * monthly:
                return False, f"single-trade limit: ${risk_dollars:.0f} > {phase.consistency.threshold*100:.0f}% of monthly profit"

        return True, "ok"

    # ------------------------------------------------------------------
    def check_consistency(
        self,
        account_state: dict,
        firm_name: str,
    ) -> tuple[bool, float, float]:
        """Return (within_limit, current_ratio, threshold) for the firm's rule."""
        phase = self.get_phase(firm_name, account_state.get("phase", "funded"))
        rule = phase.consistency
        if rule is None:
            return True, 0.0, 1.0
        if rule.ratio_type == "pnl_ratio":
            best = float(account_state.get("best_day_pnl", 0.0))
            monthly = float(account_state.get("monthly_pnl", 0.0))
            if monthly <= 0:
                return True, 0.0, rule.threshold
            ratio = best / monthly
            return ratio < rule.threshold, ratio, rule.threshold
        if rule.ratio_type == "trade_ratio":
            best_trade = float(account_state.get("best_trade_pnl", 0.0))
            monthly = float(account_state.get("monthly_pnl", 0.0))
            if monthly <= 0:
                return True, 0.0, rule.threshold
            ratio = best_trade / monthly
            return ratio < rule.threshold, ratio, rule.threshold
        if rule.ratio_type == "days_ratio":
            green = float(account_state.get("profitable_days", 0))
            total = float(account_state.get("trading_days", 0)) or 1
            ratio = green / total
            # here we want at least threshold green days
            return ratio >= rule.threshold, ratio, rule.threshold
        return True, 0.0, 1.0
