"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  price: number;
  change_pct: number;
  session: string;
  dxy: number | null;
  real_yield: number | null;
  vix: number | null;
  last_confluence: number | null;
  alerts: Array<{ alert_type: string; message: string; severity: string; created_at: string }>;
  last_trade: { bias: string; result: string; entry: number; created_at: string } | null;
  winrate: number | null;
  total_trades: number;
}

const SESSION_COLORS = {
  London:     { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "rgba(34,197,94,0.7)" },
  "New York": { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "rgba(34,197,94,0.7)" },
  Asia:       { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" },
  Closed:     { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" },
};

const GOLD_BADGE = { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.2)", color: "rgba(212,175,55,0.7)" };

function Badge({ label, style }: { label: string; style: { bg: string; border: string; color: string } }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: "4px", fontSize: "10px",
      fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "0.12em",
      background: style.bg, border: `1px solid ${style.border}`, color: style.color,
      whiteSpace: "nowrap", display: "inline-block",
    }}>
      {label}
    </span>
  );
}

function MetricCell({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div style={{
      padding: "10px 20px", flex: 1,
      borderLeft: border ? "1px solid rgba(255,255,255,0.04)" : "none",
    }}>
      <div style={{ fontSize: "9px", fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.8)" }}>
        {value}
      </div>
    </div>
  );
}

function getBiasFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bd_last_bias");
}

export default function MarketDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [bias, setBias] = useState<string | null>(null);

  async function fetchData() {
    try {
      const r = await fetch("/api/dashboard/data");
      if (r.ok) setData(await r.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchData();
    setBias(getBiasFromStorage());
    const id = setInterval(() => {
      fetchData();
      setBias(getBiasFromStorage());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data || data.price === 0) return null;

  const sessionStyle = SESSION_COLORS[data.session as keyof typeof SESSION_COLORS] ?? SESSION_COLORS.Asia;
  const positive = data.change_pct >= 0;
  const biasLabel = bias ?? null;

  const DIVIDER = "1px solid rgba(255,255,255,0.04)";

  return (
    <div style={{
      background: "rgba(15,12,25,0.95)",
      borderRadius: "12px",
      border: "0.5px solid rgba(212,175,55,0.15)",
      marginBottom: "12px",
      overflow: "hidden",
    }}>

      {/* BAND 1 — Price + Session + Bias */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px", borderBottom: DIVIDER, flexWrap: "wrap", gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{
            fontSize: "22px", color: "#D4AF37", fontWeight: 600,
            fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.01em",
          }}>
            {data.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{
            fontSize: "13px", fontWeight: 500,
            color: positive ? "#22c55e" : "#ef4444",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {positive ? "+" : ""}{data.change_pct.toFixed(2)}%
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <Badge label={data.session} style={sessionStyle} />
          {biasLabel && <Badge label={biasLabel} style={GOLD_BADGE} />}
        </div>
      </div>

      {/* BAND 2 — Metrics */}
      <div style={{ display: "flex", borderBottom: DIVIDER }}>
        <MetricCell label="DXY" value={data.dxy != null ? data.dxy.toFixed(2) : "—"} />
        <MetricCell label="Real Yield" value={data.real_yield != null ? `${data.real_yield.toFixed(2)}%` : "—"} border />
        <MetricCell label="VIX" value={data.vix != null ? data.vix.toFixed(1) : "—"} border />
        <MetricCell label="ADX (scan)" value={data.last_confluence != null ? data.last_confluence.toFixed(0) : "—"} border />
      </div>

      {/* BAND 3 — Scanner alerts */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px 20px",
        borderBottom: DIVIDER, alignItems: "center",
      }}>
        {data.alerts.length === 0 ? (
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.2)" }}>
            No active alerts
          </span>
        ) : (
          data.alerts.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0,
                background: a.severity === "critical" ? "#ef4444" : "#f59e0b",
              }} />
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.35)" }}>
                {a.message.length > 60 ? a.message.slice(0, 60) + "…" : a.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* BAND 4 — Last trade + Winrate */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 20px", flexWrap: "wrap", gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {data.last_trade ? (
            <>
              <span style={{
                width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0,
                background: data.last_trade.result === "tp1_hit" || data.last_trade.result === "tp2_hit" ? "#22c55e"
                  : data.last_trade.result === "sl_hit" ? "#ef4444" : "#6b7280",
              }} />
              <span style={{ fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.35)" }}>
                Last: {data.last_trade.bias ?? "—"} @ {data.last_trade.entry ?? "—"} — {data.last_trade.result ?? "pending"}
              </span>
            </>
          ) : (
            <span style={{ fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.2)" }}>No trades yet</span>
          )}
        </div>
        {data.winrate != null && data.total_trades > 0 && (
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono, monospace)", color: "rgba(255,255,255,0.35)" }}>
            Winrate: {data.winrate}% ({data.total_trades} trades)
          </span>
        )}
      </div>
    </div>
  );
}
