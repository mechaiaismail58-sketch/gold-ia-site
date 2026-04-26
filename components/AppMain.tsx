"use client";

import { useEffect, useState } from "react";
import LiveTicker from "@/components/LiveTicker";

type DashData = {
  tradability_score:   number;
  tradability_label:   string;
  active_trades:       Array<{
    id: string; bias: string | null; entry: number | null;
    tp1: number | null; tp2: number | null; sl: number | null;
    confluence: number | null; created_at: string;
  }>;
  winrate: number;
  wins: number;
  losses: number;
  total_trades: number;
};

type TickerItem = { symbol: string; price: number; changePercent: number; decimals: number; prefix?: string };

interface Props {
  onChatOpen: () => void;
}

const ROW_LABEL: React.CSSProperties = {
  fontSize: 10, fontFamily: "monospace", textTransform: "uppercase",
  letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)",
};

const ROW_VALUE: React.CSSProperties = {
  fontSize: 12, color: "rgba(255,255,255,0.6)",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 9, fontFamily: "monospace", textTransform: "uppercase",
  letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", marginBottom: 4,
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 20, fontFamily: "monospace", color: "rgba(255,255,255,0.85)", fontWeight: 500,
};

export default function AppMain({ onChatOpen }: Props) {
  const [dash,    setDash]    = useState<DashData | null>(null);
  const [tickers, setTickers] = useState<TickerItem[]>([]);

  async function load() {
    const [d, t] = await Promise.allSettled([
      fetch("/api/dashboard/data").then(r => r.json()),
      fetch("/api/ticker").then(r => r.json()),
    ]);
    if (d.status === "fulfilled") setDash(d.value);
    if (t.status === "fulfilled") setTickers(t.value.items ?? []);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const xau = tickers.find(t => t.symbol === "XAUUSD");
  const dxy = tickers.find(t => t.symbol === "DXY");
  const y10 = tickers.find(t => t.symbol === "US10Y");
  const vix = tickers.find(t => t.symbol === "VIX");

  const lastTrade = dash?.active_trades[0] ?? null;
  const isLong    = lastTrade?.bias?.toLowerCase().includes("bull") || lastTrade?.bias?.toLowerCase().includes("long");
  const biasColor = isLong ? "#4ADE80" : "#F87171";

  // Confluence rows data (what we can compute from ticker)
  const dxyUp  = (dxy?.changePercent ?? 0) > 0.1;
  const dxyDn  = (dxy?.changePercent ?? 0) < -0.1;
  const y10Up  = (y10?.changePercent ?? 0) > 0.1;
  const y10Dn  = (y10?.changePercent ?? 0) < -0.1;
  const vixHi  = (vix?.price ?? 0) > 20;
  const hour   = new Date().getUTCHours();
  const isKZ   = (hour >= 7 && hour < 10) || (hour >= 12 && hour < 15);
  const dow    = new Date().getUTCDay();
  const isWkd  = dow === 0 || dow === 6;

  const confluenceRows = [
    {
      label: "Macro",
      value: dxy ? `DXY ${dxy.changePercent >= 0 ? "+" : ""}${dxy.changePercent.toFixed(2)}% · US10Y ${y10?.changePercent >= 0 ? "+" : ""}${y10?.changePercent.toFixed(2)}%` : "Loading...",
      score: dxyDn ? 0.8 : dxyUp ? 0.3 : 0.55,
      tag: dxyDn ? "ALIGNED" : dxyUp ? "AGAINST" : "MIXED",
      tagColor: dxyDn ? "#4ADE80" : dxyUp ? "#F87171" : "rgba(255,255,255,0.25)",
    },
    {
      label: "Intermarket",
      value: `VIX ${vix ? vix.price.toFixed(1) : "—"}${vixHi ? " (risk-off)" : ""}`,
      score: vixHi ? 0.65 : 0.45,
      tag: vixHi ? "ALIGNED" : "NEUTRAL",
      tagColor: vixHi ? "#4ADE80" : "rgba(255,255,255,0.25)",
    },
    {
      label: "Session",
      value: isWkd ? "Weekend — low liquidity" : isKZ ? (hour < 12 ? "London killzone" : "NY killzone") : "Outside killzone",
      score: isKZ ? 0.8 : isWkd ? 0.15 : 0.45,
      tag: isKZ ? "KILLZONE" : isWkd ? "AVOID" : "NEUTRAL",
      tagColor: isKZ ? "#D4AF37" : isWkd ? "#F87171" : "rgba(255,255,255,0.25)",
    },
    {
      label: "Structure",
      value: lastTrade ? `Last signal: ${isLong ? "Bullish" : "Bearish"} bias` : "No active signal",
      score: lastTrade ? 0.65 : 0.4,
      tag: lastTrade ? "SIGNAL" : "NEUTRAL",
      tagColor: lastTrade ? "#D4AF37" : "rgba(255,255,255,0.25)",
    },
    {
      label: "Institutional",
      value: "COT + ETF — request analysis",
      score: 0.5,
      tag: "MIXED",
      tagColor: "rgba(255,255,255,0.25)",
    },
    {
      label: "Tradability",
      value: `${dash?.tradability_label ?? "—"} · ${dash?.tradability_score?.toFixed(1) ?? "—"}/10`,
      score: (dash?.tradability_score ?? 5) / 10,
      tag: dash?.tradability_label?.toUpperCase() ?? "—",
      tagColor: (dash?.tradability_score ?? 5) > 6.5 ? "#4ADE80" : (dash?.tradability_score ?? 5) >= 4 ? "#D4AF37" : "#F87171",
    },
  ];

  return (
    <div
      className="overflow-y-auto"
      style={{ background: "#0A0A0A", padding: "0 0 32px 0", display: "flex", flexDirection: "column" }}
    >
      {/* ── Ticker strip ── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "0 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2, paddingBottom: 2 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(212,175,55,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", flexShrink: 0 }}>
            ● LIVE
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <LiveTicker />
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Signal Hero Card ── */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          {lastTrade ? (
            <>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                {/* Left */}
                <div style={{ padding: "20px 24px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 10, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em",
                      padding: "2px 8px", borderRadius: 4,
                      background: isLong ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                      color: biasColor,
                      border: `1px solid ${isLong ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
                    }}>
                      {isLong ? "LONG" : "SHORT"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                      #{lastTrade.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.85)", lineHeight: 1.4, marginBottom: 10 }}>
                    {isLong ? "Bullish" : "Bearish"} setup
                    {lastTrade.entry ? ` at ${lastTrade.entry.toFixed(1)}` : ""}
                    {lastTrade.confluence ? ` · ${lastTrade.confluence}/9 confluence` : ""}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                    POSTED {new Date(lastTrade.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC
                  </div>
                </div>
                {/* Right — levels */}
                <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                  {[
                    { label: "ENTRY", value: lastTrade.entry, color: "#D4AF37" },
                    { label: "TP1",   value: lastTrade.tp1,   color: "#4ADE80" },
                    { label: "TP2",   value: lastTrade.tp2,   color: "#4ADE80" },
                    { label: "SL",    value: lastTrade.sl,    color: "#F87171" },
                  ].filter(r => r.value != null).map(({ label, value, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ ...ROW_LABEL }}>{label}</span>
                      <span style={{ fontSize: 13, fontFamily: "monospace", color, fontWeight: 600 }}>
                        {(value as number).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                {[
                  { label: "CONF", value: lastTrade.confluence ? `${lastTrade.confluence}/9` : "—" },
                  {
                    label: "R/R",
                    value: lastTrade.entry && lastTrade.tp1 && lastTrade.sl
                      ? `1:${Math.abs((lastTrade.tp1 - lastTrade.entry) / (lastTrade.entry - lastTrade.sl)).toFixed(1)}`
                      : "—",
                  },
                  { label: "WINRATE", value: dash?.total_trades ? `${dash.winrate}%` : "—" },
                  { label: "STATUS",  value: "PENDING" },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: "14px 16px",
                    borderRight: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={STAT_LABEL}>{s.label}</div>
                    <div style={{
                      ...STAT_VALUE,
                      fontSize: 16,
                      color: s.label === "STATUS" ? "#D4AF37" : s.label === "WINRATE" && dash?.winrate && dash.winrate > 50 ? "#4ADE80" : "rgba(255,255,255,0.75)",
                    }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                No active signal — ask the AI for an analysis
              </div>
              <button
                onClick={onChatOpen}
                style={{
                  padding: "8px 20px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid rgba(212,175,55,0.4)",
                  background: "rgba(212,175,55,0.07)",
                  color: "#D4AF37", fontSize: 12, fontFamily: "monospace",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                }}
              >
                → New Analysis
              </button>
            </div>
          )}
        </div>

        {/* New analysis CTA (when trade exists) */}
        {lastTrade && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onChatOpen}
              style={{
                padding: "7px 18px", borderRadius: 8, cursor: "pointer",
                border: "1px solid rgba(212,175,55,0.3)",
                background: "rgba(212,175,55,0.06)",
                color: "#D4AF37", fontSize: 11, fontFamily: "monospace",
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              → New Analysis  (C)
            </button>
          </div>
        )}

        {/* ── Confluence Rows ── */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            fontSize: 9, fontFamily: "monospace", textTransform: "uppercase",
            letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)",
          }}>
            Market Context
          </div>
          {confluenceRows.map((row, i) => (
            <div key={row.label} style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 100px 90px",
              alignItems: "center",
              padding: "10px 16px",
              background: i % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
              borderBottom: i < confluenceRows.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
            }}>
              <span style={ROW_LABEL}>{row.label}</span>
              <span style={{ ...ROW_VALUE, fontSize: 11, paddingRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${row.score * 100}%`,
                  background: "linear-gradient(90deg, rgba(212,175,55,0.5), #D4AF37)",
                  transition: "width 0.4s ease",
                }} />
              </div>
              <span style={{
                fontSize: 9, fontFamily: "monospace", textTransform: "uppercase",
                letterSpacing: "0.08em", color: row.tagColor,
                textAlign: "right", fontWeight: 700,
              }}>
                {row.tag}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
