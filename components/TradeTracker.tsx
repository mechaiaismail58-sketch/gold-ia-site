"use client";

import { useEffect, useState } from "react";

type Trade = {
  id: string;
  bias: string | null;
  entry: number | null;
  result: string | null;
  created_at: string;
};

type HistoryData = {
  trades: Trade[];
  winrate: number | null;
  wins: number;
  losses: number;
  total: number;
};

function resultColor(result: string | null) {
  if (result === "tp1_hit" || result === "tp2_hit") return "bg-green-500/70";
  if (result === "sl_hit") return "bg-red-500/60";
  return "bg-white/20";
}

function resultLabel(result: string | null) {
  if (result === "tp1_hit") return "TP1";
  if (result === "tp2_hit") return "TP2";
  if (result === "sl_hit") return "SL";
  if (result === "breakeven") return "BE";
  return "•";
}

export default function TradeTracker() {
  const [data, setData] = useState<HistoryData | null>(null);

  useEffect(() => {
    fetch("/api/trades/history")
      .then(r => r.json())
      .then(d => { if (d.trades) setData(d); })
      .catch(() => {});
  }, []);

  if (!data || data.trades.length === 0) return null;

  const recent = data.trades.slice(0, 10);

  return (
    <section className="mt-4">
      <div className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">Track record</span>
          {data.winrate != null && (
            <span className="text-sm font-medium text-white/80">
              {data.winrate}%
              <span className="text-[10px] text-white/30 ml-1">({data.wins}W/{data.losses}L)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {recent.map(t => (
            <div
              key={t.id}
              title={`${t.bias?.toUpperCase() ?? "—"} · ${t.entry ?? "—"} · ${t.result ?? "pending"}`}
              className={`h-5 w-7 rounded-md flex items-center justify-center text-[9px] font-mono font-bold text-white/90 ${resultColor(t.result)}`}
            >
              {resultLabel(t.result)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
