"""Backtest report generator — pretty-prints + saves CSV/HTML artefacts."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .. import config
from .walk_forward import BacktestReport


def write_report(report: BacktestReport, out_dir: Path | None = None) -> dict[str, Path]:
    out_dir = out_dir or (config.CACHE_DIR / "backtest")
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for it in report.iterations:
        rows.append(
            {
                "iteration": it.iteration,
                "test_start": it.test_start,
                "test_end": it.test_end,
                "n_signals": it.n_signals,
                "n_trades": it.n_trades,
                "win_rate": it.win_rate,
                "sharpe": it.sharpe,
                "pnl_dollars": it.pnl_dollars,
            }
        )
    iter_df = pd.DataFrame(rows)
    iter_path = out_dir / "iterations.csv"
    iter_df.to_csv(iter_path, index=False)

    trades_rows = []
    for it in report.iterations:
        for k, t in enumerate(it.trades):
            trades_rows.append(
                {
                    "iteration": it.iteration,
                    "trade_idx": k,
                    "pnl_dollars": t.pnl_dollars,
                    "rr_realized": t.rr_realized,
                    "win": int(t.win),
                }
            )
    trades_df = pd.DataFrame(trades_rows)
    trades_path = out_dir / "trades.csv"
    trades_df.to_csv(trades_path, index=False)

    summary_path = out_dir / "summary.txt"
    with summary_path.open("w", encoding="utf-8") as fh:
        fh.write(f"Verdict: {report.go_no_go}\n\n")
        for k, v in report.overall_metrics.items():
            fh.write(f"{k:<20s}{v}\n")
    return {"iterations": iter_path, "trades": trades_path, "summary": summary_path}
