"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  price: number;
  change_pct: number;
  session: string;
}

const SESSION_COLORS = {
  London:     { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "rgba(34,197,94,0.7)" },
  "New York": { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "rgba(34,197,94,0.7)" },
  Asia:       { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" },
  Closed:     { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" },
};

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

export default function MarketDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  async function fetchData() {
    try {
      const r = await fetch("/api/market/pulse");
      if (r.ok) {
        const raw = await r.json();
        setData({
          price:      raw.price ?? 0,
          change_pct: raw.change_24h_pct ?? raw.change_pct ?? 0,
          session:    raw.session ?? "Asia",
        });
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data || typeof data.price !== "number" || data.price === 0) return null;

  const sessionStyle = SESSION_COLORS[data.session as keyof typeof SESSION_COLORS] ?? SESSION_COLORS.Asia;
  const positive = data.change_pct >= 0;

  return (
    <div style={{
      background: "rgba(15,12,25,0.95)",
      borderRadius: "12px",
      border: "0.5px solid rgba(212,175,55,0.15)",
      marginBottom: "12px",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px", flexWrap: "wrap", gap: "8px",
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
        <Badge label={data.session} style={sessionStyle} />
      </div>
    </div>
  );
}
