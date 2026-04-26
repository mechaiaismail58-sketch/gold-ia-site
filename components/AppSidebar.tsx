"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DashData = {
  tradability_score:   number;
  tradability_label:   string;
  tradability_summary: string;
  active_trades:       Array<{ id: string; bias: string | null; entry: number | null; tp1: number | null; sl: number | null }>;
  wins:         number;
  losses:       number;
  winrate:      number;
  total_trades: number;
  events:       Array<{ title: string; date: string; impact: string }>;
};

type TickerItem = {
  symbol:        string;
  price:         number;
  change:        number;
  changePercent: number;
  decimals:      number;
  prefix?:       string;
  suffix?:       string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "9px", fontFamily: "monospace", textTransform: "uppercase",
  letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)",
};

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={LABEL_STYLE}>{title}</span>
        {count != null && (
          <span style={{
            fontSize: "9px", fontFamily: "monospace",
            color: "rgba(212,175,55,0.7)",
            background: "rgba(212,175,55,0.08)",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 4, padding: "0 5px",
          }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function fmtUtcTime(dateStr: string) {
  const d = new Date(dateStr);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function fmtPrice(item: TickerItem) {
  const v = item.price.toFixed(item.decimals);
  return `${item.prefix ?? ""}${v}${item.suffix ?? ""}`;
}

function chgColor(pct: number) {
  return pct > 0 ? "#4ADE80" : pct < 0 ? "#F87171" : "rgba(255,255,255,0.35)";
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AppSidebar() {
  const [dash, setDash]       = useState<DashData | null>(null);
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

  const xau  = tickers.find(t => t.symbol === "XAUUSD");
  const dxy  = tickers.find(t => t.symbol === "DXY");
  const y10  = tickers.find(t => t.symbol === "US10Y");
  const xag  = tickers.find(t => t.symbol === "XAGUSD");
  const vix  = tickers.find(t => t.symbol === "VIX");

  const score = dash?.tradability_score ?? 0;
  const scorePct = (score / 10) * 100;
  const scoreColor = score > 6.5 ? "#4ADE80" : score >= 4 ? "#D4AF37" : "#F87171";

  return (
    <div
      className="overflow-y-auto"
      style={{
        background: "#0E0B1A",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* ── Tradability Score ── */}
      <Section title="Tradability Score">
        <div style={{
          padding: "14px",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
          background: "rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 500, color: scoreColor, fontFamily: "monospace" }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>/ 10</span>
          </div>
          <div style={{ fontSize: 12, color: scoreColor, marginBottom: 8 }}>
            {dash?.tradability_label ?? "—"}
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.05)", marginBottom: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${scorePct}%`, background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontFamily: "monospace", lineHeight: 1.5 }}>
            {dash?.tradability_summary ?? "Loading..."}
          </div>
        </div>
      </Section>

      {/* ── Watchlist ── */}
      <Section title="Watchlist">
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[
            { item: xau, sym: "XAUUSD", active: true },
            { item: dxy, sym: "DXY",    active: false },
            { item: y10, sym: "US 10Y", active: false },
            { item: xag, sym: "XAG/USD",active: false },
            { item: vix, sym: "VIX",    active: false },
          ].map(({ item, sym, active }) => (
            <div key={sym} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 10px", borderRadius: 6,
              background: active ? "rgba(212,175,55,0.05)" : "transparent",
              border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
            }}>
              <span style={{ fontSize: 12, color: active ? "#D4AF37" : "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
                {sym}
              </span>
              <div style={{ textAlign: "right" }}>
                {item ? (
                  <>
                    <div style={{ fontSize: 12, color: active ? "#D4AF37" : "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>
                      {fmtPrice(item)}
                    </div>
                    <div style={{ fontSize: 10, color: chgColor(item.changePercent), fontFamily: "monospace" }}>
                      {item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Active Signals ── */}
      <Section title="Active Signals" count={dash?.active_trades.length}>
        {!dash || dash.active_trades.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", padding: "8px 0" }}>
            No pending signals
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {dash.active_trades.map((t, i) => {
              const isLong = t.bias?.toLowerCase().includes("bull") || t.bias?.toLowerCase().includes("long");
              const biasColor = isLong ? "#4ADE80" : "#F87171";
              const currentXau = xau?.price;
              let pnl: string | null = null;
              if (currentXau && t.entry) {
                const raw = isLong ? currentXau - t.entry : t.entry - currentXau;
                pnl = `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}`;
              }
              return (
                <div key={t.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 6,
                  background: i === 0 ? "rgba(212,175,55,0.04)" : "transparent",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                      #{t.id.slice(0, 6).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, color: biasColor, fontFamily: "monospace", fontWeight: 600 }}>
                      {isLong ? "LONG" : "SHORT"}{t.entry ? ` @ ${t.entry.toFixed(1)}` : ""}
                    </div>
                  </div>
                  {pnl && (
                    <span style={{
                      fontSize: 12, fontFamily: "monospace", fontWeight: 600,
                      color: parseFloat(pnl) >= 0 ? "#4ADE80" : "#F87171",
                    }}>
                      {pnl}pt
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {dash && (dash.total_trades ?? 0) > 0 && (
          <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
            {dash.winrate}% winrate · {dash.wins}W / {dash.losses}L
          </div>
        )}
      </Section>

      {/* ── Next Catalysts ── */}
      <Section title="Next Catalysts">
        {!dash || dash.events.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", padding: "8px 0" }}>
            No major events in 48h
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dash.events.map((evt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "#D4AF37", fontFamily: "monospace", flexShrink: 0, paddingTop: 1 }}>
                  {fmtUtcTime(evt.date)}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
                    {evt.title}
                  </div>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
                    color: evt.impact === "high" ? "#F87171" : evt.impact === "medium" ? "#D4AF37" : "rgba(255,255,255,0.3)",
                  }}>
                    {evt.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
