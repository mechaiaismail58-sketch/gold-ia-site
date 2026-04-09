"use client";

import { useEffect, useState } from "react";

interface PulseData {
  price: number;
  change_24h_pct: number;
  session: string;
}

const SESSION_STYLES: Record<string, { bg: string; border: string }> = {
  London: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" },
  "New York": { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" },
  Asia: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
  Closed: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
};

export default function MarketDashboard() {
  const [data, setData] = useState<PulseData | null>(null);

  async function fetchPulse() {
    try {
      const r = await fetch("/api/market/pulse");
      if (r.ok) setData(await r.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchPulse();
    const id = setInterval(fetchPulse, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const sessionStyle = SESSION_STYLES[data.session] ?? SESSION_STYLES.Asia;
  const changePositive = data.change_24h_pct >= 0;

  return (
    <div style={{
      height: "auto",
      minHeight: "48px",
      background: "rgba(255,255,255,0.02)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "12px",
      rowGap: "6px",
      paddingTop: "8px",
      paddingBottom: "8px",
    }}>
      {/* Price */}
      <span style={{
        fontSize: "18px",
        color: "#D4AF37",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        fontVariantNumeric: "tabular-nums",
      }}>
        {data.price > 0 ? data.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
      </span>

      {/* Change */}
      {data.price > 0 && (
        <span style={{
          fontSize: "13px",
          color: changePositive ? "#22c55e" : "#ef4444",
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}>
          {changePositive ? "+" : ""}{data.change_24h_pct.toFixed(2)}%
        </span>
      )}

      {/* Session badge */}
      <span style={{
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        background: sessionStyle.bg,
        border: `1px solid ${sessionStyle.border}`,
        borderRadius: "6px",
        padding: "3px 8px",
        color: "rgba(255,255,255,0.6)",
        whiteSpace: "nowrap",
      }}>
        {data.session}
      </span>
    </div>
  );
}
