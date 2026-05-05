"""AdaptiveEngine (AAE) — Phase 0/1 logging + read-only recommendations.

This is the analysis-only skeleton: every signal and outcome is appended to
a JSON-lines file at ``data/cache/aae_trades.json``.  The threshold
recommendation engine segments the trade history (regime × ApEn-bin × Hawkes
ratio bin × signal class × time-of-day) and flags segments with realised
WR more than 10pp below their target.

It does **not** auto-apply any recalibration in this phase — it only logs
and reports.  Live recalibration is reserved for Phase 2.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
import pandas as pd

from .. import config

log = logging.getLogger(__name__)

TRADES_PATH = config.CACHE_DIR / "aae_trades.json"


# ===========================================================================
@dataclass
class TradeRecord:
    signal_id: str
    timestamp: str
    direction: str
    signal_class: str
    score: float
    layer_values: dict
    shap_values: dict
    regime: int
    regime_probability: float
    apen: float
    w2: float
    hawkes_ratio: float
    ev: float
    meta_score: float
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_fraction: float
    outcome: Optional[dict] = None

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class SegmentReport:
    segment: str
    n_trades: int
    realized_wr: float
    target_wr: float
    underperforming: bool


# ===========================================================================
class AdaptiveEngine:
    TARGET_WR_BY_CLASS: dict[str, float] = {"A": 0.815, "B": 0.760, "C": 0.840}

    def __init__(self, trades_path: Path = TRADES_PATH) -> None:
        self.trades_path = Path(trades_path)
        self.trades_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.trades_path.exists():
            self.trades_path.write_text("", encoding="utf-8")

    # ------------------------------------------------------------------
    def log_signal(self, signal: dict, layer_values: dict, shap_values: dict | None = None) -> str:
        sig_id = str(uuid.uuid4())
        rec = TradeRecord(
            signal_id=sig_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            direction=signal.get("direction", ""),
            signal_class=signal.get("signal_class", ""),
            score=float(signal.get("score", 0.0)),
            layer_values=layer_values,
            shap_values=shap_values or {},
            regime=int(signal.get("regime", 0)),
            regime_probability=float(signal.get("regime_probability", 0.0)),
            apen=float(layer_values.get("apen", 0.0)),
            w2=float(layer_values.get("w2", 0.0)),
            hawkes_ratio=float(layer_values.get("hawkes_ratio", 0.0)),
            ev=float(signal.get("ev_dollars", 0.0)),
            meta_score=float(signal.get("meta_score", 0.0)),
            entry_price=float(signal.get("entry_price", 0.0)),
            stop_loss=float(signal.get("stop_loss", 0.0)),
            take_profit=float(signal.get("take_profit", 0.0)),
            risk_fraction=float(signal.get("risk_fraction", 0.0)),
            outcome=None,
        )
        with self.trades_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec.to_dict()) + "\n")
        return sig_id

    # ------------------------------------------------------------------
    def record_outcome(self, signal_id: str, result: str, exit_price: float,
                       pnl_dollars: float, duration_days: int) -> None:
        outcome = {
            "result": result,             # 'win' | 'loss' | 'timeout'
            "exit_price": float(exit_price),
            "pnl_dollars": float(pnl_dollars),
            "duration_days": int(duration_days),
        }
        rows = self._load_records()
        for r in rows:
            if r["signal_id"] == signal_id:
                r["outcome"] = outcome
                break
        with self.trades_path.open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r) + "\n")

    # ------------------------------------------------------------------
    def _load_records(self) -> list[dict]:
        rows = []
        if not self.trades_path.exists():
            return rows
        for line in self.trades_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return rows

    # ------------------------------------------------------------------
    @staticmethod
    def _segment_key(rec: dict) -> str:
        ap = rec.get("apen", 0.0) or 0.0
        ap_bin = (
            "ap<.65" if ap < 0.65 else "ap.65-.80" if ap < 0.80 else "ap.80-.90" if ap < 0.90 else "ap≥.90"
        )
        hr = rec.get("hawkes_ratio", 0.0) or 0.0
        hr_bin = "hr<1" if hr < 1.0 else "hr1-2" if hr < 2.0 else "hr≥2"
        cls = rec.get("signal_class", "?")
        regime = int(rec.get("regime", 0) or 0)
        return f"R{regime}|{cls}|{ap_bin}|{hr_bin}"

    def segment_report(self, min_trades: int = 30) -> list[SegmentReport]:
        rows = [r for r in self._load_records() if r.get("outcome")]
        if not rows:
            return []
        df = pd.DataFrame(rows)
        df["seg"] = df.apply(self._segment_key, axis=1)
        df["win"] = df["outcome"].apply(lambda o: 1 if o["result"] == "win" else 0)
        out: list[SegmentReport] = []
        for seg, sub in df.groupby("seg"):
            if len(sub) < min_trades:
                continue
            cls = sub["signal_class"].iloc[0]
            target = self.TARGET_WR_BY_CLASS.get(cls, 0.7)
            wr = float(sub["win"].mean())
            out.append(SegmentReport(
                segment=seg,
                n_trades=int(len(sub)),
                realized_wr=wr,
                target_wr=target,
                underperforming=(wr < target - 0.10),
            ))
        return out

    # ------------------------------------------------------------------
    def print_recommendations(self) -> None:
        segs = self.segment_report()
        if not segs:
            print("[AAE] no completed trades yet")
            return
        print("\n[AAE] segment performance")
        for s in segs:
            tag = "⚠" if s.underperforming else " "
            print(f"  {tag} {s.segment:<28s} n={s.n_trades:3d} WR={s.realized_wr:.1%} (target {s.target_wr:.1%})")
        for s in segs:
            if s.underperforming:
                print(
                    f"AAE RECOMMENDATION: segment {s.segment} shows WR {s.realized_wr:.1%} "
                    f"vs {s.target_wr:.1%} target on {s.n_trades} trades — "
                    "consider tightening the corresponding layer threshold."
                )
