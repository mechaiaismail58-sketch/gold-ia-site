"""ConsistencyManager — proactive enforcement of prop-firm rules.

For each active firm we maintain an ``AccountState`` and provide a series of
guards consumed by :mod:`signals.nine_layer` (Layer 8).

Implemented guards
------------------
1. **FTMO 40% rule** — suspend signals when best_day / monthly ≥ 33% (7%
   safety margin).
2. **Apex trailing DD** — reduce all sizes 50% when buffer < 2% of initial.
3. **E8 single-trade 30%** — auto-shrink a candidate if it would breach.
4. **FTMO min-days** — switch to maintenance mode (Class C only, 0.5%) once
   target reached before day 10.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .. import config
from .rules_db import PropFirmRulesDB


@dataclass
class AccountState:
    firm: str
    phase: str
    initial_balance: float
    current_balance: float
    current_equity: float
    equity_peak: float
    daily_pnl: float = 0.0
    monthly_pnl: float = 0.0
    best_day_pnl: float = 0.0
    best_trade_pnl: float = 0.0
    profitable_days: int = 0
    trading_days: int = 0
    consecutive_losses: int = 0
    all_trades: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "firm": self.firm,
            "phase": self.phase,
            "initial_balance": self.initial_balance,
            "current_balance": self.current_balance,
            "current_equity": self.current_equity,
            "equity_peak": self.equity_peak,
            "daily_pnl": self.daily_pnl,
            "monthly_pnl": self.monthly_pnl,
            "best_day_pnl": self.best_day_pnl,
            "best_trade_pnl": self.best_trade_pnl,
            "profitable_days": self.profitable_days,
            "trading_days": self.trading_days,
            "consecutive_losses": self.consecutive_losses,
        }


@dataclass
class ConsistencyDecision:
    allowed: bool
    size_multiplier: float
    maintenance_mode: bool
    reason: str
    alerts: list[str] = field(default_factory=list)


class ConsistencyManager:
    def __init__(self, rules_db: Optional[PropFirmRulesDB] = None) -> None:
        self.rules_db = rules_db or PropFirmRulesDB()
        self.states: dict[str, AccountState] = {}

    # ------------------------------------------------------------------
    def register_account(self, firm: str, phase: str, initial_balance: float) -> AccountState:
        state = AccountState(
            firm=firm,
            phase=phase,
            initial_balance=initial_balance,
            current_balance=initial_balance,
            current_equity=initial_balance,
            equity_peak=initial_balance,
        )
        self.states[firm] = state
        return state

    # ------------------------------------------------------------------
    def update_after_trade(self, firm: str, pnl: float) -> None:
        s = self.states[firm]
        s.current_balance += pnl
        s.current_equity = s.current_balance
        s.daily_pnl += pnl
        s.monthly_pnl += pnl
        s.equity_peak = max(s.equity_peak, s.current_equity)
        s.best_trade_pnl = max(s.best_trade_pnl, pnl)
        if pnl > 0:
            s.consecutive_losses = 0
        else:
            s.consecutive_losses += 1
        s.all_trades.append(pnl)

    def end_of_day(self, firm: str) -> None:
        s = self.states[firm]
        s.trading_days += 1
        if s.daily_pnl > 0:
            s.profitable_days += 1
        s.best_day_pnl = max(s.best_day_pnl, s.daily_pnl)
        s.daily_pnl = 0.0

    # ------------------------------------------------------------------
    def evaluate(self, firm: str, candidate_signal: dict) -> ConsistencyDecision:
        s = self.states.get(firm)
        if s is None:
            return ConsistencyDecision(False, 0.0, False, f"account {firm} not registered")
        rules = self.rules_db.get_firm(firm)
        phase = rules.phases[s.phase]
        alerts: list[str] = []
        size_mult = 1.0
        maintenance = False

        # 1. Daily DD pre-check
        ok, reason = self.rules_db.check_signal_compliance(candidate_signal, s.to_dict(), firm)
        if not ok:
            return ConsistencyDecision(False, 0.0, False, reason)

        # 2. FTMO 40% pnl-ratio: suspend at 33% (7% margin)
        if phase.consistency and phase.consistency.ratio_type == "pnl_ratio":
            if s.monthly_pnl > 0:
                ratio = s.best_day_pnl / s.monthly_pnl
                if ratio >= 0.33:
                    alerts.append(f"{firm}: pnl-day ratio {ratio:.0%} ≥ 33% — suspending signals today")
                    return ConsistencyDecision(False, 0.0, False, "pnl-day ratio safety margin", alerts)

        # 3. Apex trailing DD safety buffer (< 2% of initial)
        if phase.trailing_dd:
            buffer = s.current_equity - (s.equity_peak - phase.max_dd_pct * s.initial_balance)
            if buffer < 0.02 * s.initial_balance:
                size_mult = min(size_mult, 0.5)
                alerts.append(f"{firm}: trailing DD buffer {buffer:.0f} < 2% initial — sizes ×0.5")

        # 4. E8 single-trade 30% — auto-shrink rather than reject
        if phase.consistency and phase.consistency.ratio_type == "trade_ratio":
            if s.monthly_pnl > 0:
                limit = phase.consistency.threshold * s.monthly_pnl
                rsk = float(candidate_signal.get("risk_dollars", 0.0))
                if rsk > limit and rsk > 0:
                    shrink = limit / rsk
                    size_mult = min(size_mult, shrink)
                    alerts.append(f"{firm}: trade-ratio limit forced ×{shrink:.2f}")

        # 5. FTMO min-days maintenance
        if (
            phase.min_trading_days > 0
            and s.trading_days < phase.min_trading_days
            and (s.current_balance / s.initial_balance - 1.0) >= phase.profit_target_pct
        ):
            maintenance = True
            alerts.append(
                f"{firm}: target reached at day {s.trading_days}/{phase.min_trading_days} → maintenance mode"
            )

        return ConsistencyDecision(True, size_mult, maintenance, "ok", alerts)

    # ------------------------------------------------------------------
    def trailing_dd_buffer_pct(self, firm: str) -> float:
        s = self.states[firm]
        rules = self.rules_db.get_firm(firm)
        phase = rules.phases[s.phase]
        if not phase.trailing_dd:
            return 1.0
        bust = s.equity_peak - phase.max_dd_pct * s.initial_balance
        return float((s.current_equity - bust) / max(s.initial_balance, 1.0))
