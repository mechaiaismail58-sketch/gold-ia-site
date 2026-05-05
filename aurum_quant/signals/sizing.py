"""GrossmanZhouSizer — dynamic position sizing across the prop-firm equity curve.

Gross-Zhou inspired schedule
----------------------------
    profit% bracket    → multiplier
    [0, 3%)            → 1.00   (construction phase)
    [3%, 7%)           → 1.25   (acceleration)
    [7%, 9%)           → 0.75   (protect)
    [9%, ∞)            → 0.60   (very close to target)
    after 2 consecutive losses → 0.5
    daily DD ≥ 2.5%    → 0.0    (stop trading)

Final risk fraction
-------------------
    final = base_risk · GZ_mult · meta_score · hawkes_adj.

Correlation cap
---------------
With multiple simultaneous signals we cap total portfolio risk at 4%, and
deflate per-signal risk by 0.3 · max_pairwise_corr.
"""
from __future__ import annotations

from dataclasses import dataclass

from .. import config


@dataclass
class SizerInputs:
    base_risk: float
    account_profit_pct: float
    consecutive_losses: int
    daily_dd_pct: float
    meta_score: float
    hawkes_adj: float


class GrossmanZhouSizer:
    def __init__(
        self,
        max_portfolio_risk: float = config.MAX_PORTFOLIO_RISK,
        daily_stop_dd: float = config.DAILY_STOP_DD,
    ) -> None:
        self.max_portfolio_risk = max_portfolio_risk
        self.daily_stop_dd = daily_stop_dd

    # ------------------------------------------------------------------
    def get_multiplier(
        self,
        account_profit_pct: float,
        consecutive_losses: int,
        daily_dd_pct: float,
    ) -> float:
        if daily_dd_pct >= self.daily_stop_dd:
            return 0.0
        if consecutive_losses >= 2:
            return 0.5
        if account_profit_pct < 0.03:
            return 1.00
        if account_profit_pct < 0.07:
            return 1.25
        if account_profit_pct < 0.09:
            return 0.75
        return 0.60

    # ------------------------------------------------------------------
    def compute_final_size(self, inp: SizerInputs) -> float:
        gz = self.get_multiplier(inp.account_profit_pct, inp.consecutive_losses, inp.daily_dd_pct)
        size = inp.base_risk * gz * max(0.0, min(inp.meta_score, 1.0)) * max(0.0, min(inp.hawkes_adj, 1.0))
        return float(min(size, self.max_portfolio_risk))

    # ------------------------------------------------------------------
    def check_daily_stop(self, daily_dd_pct: float) -> bool:
        return daily_dd_pct >= self.daily_stop_dd

    # ------------------------------------------------------------------
    @staticmethod
    def correlation_adjust(per_signal_risks: list[float], max_pairwise_corr: float, cap: float) -> list[float]:
        adj = [r * (1.0 - 0.3 * max(0.0, min(max_pairwise_corr, 1.0))) for r in per_signal_risks]
        total = sum(adj)
        if total <= cap or total <= 0:
            return adj
        scale = cap / total
        return [r * scale for r in adj]
