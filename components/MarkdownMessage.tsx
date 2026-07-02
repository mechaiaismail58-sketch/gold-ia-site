"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import StructureChart, { type ChartData } from "@/components/StructureChart";
import { t } from "@/lib/i18n";

// ── Trade card types ──────────────────────────────────────────────────────────

interface TradeData {
  BIAS?: string;
  ENTRY?: string;
  SL?: string;
  TP1?: string;
  TP2?: string;
  CONFLUENCE?: string;
  SESSION?: string;
  NOTE?: string;
}

interface NoTradeData {
  reason?: string;
  WAIT_FOR?: string;
  NEXT_CHECK?: string;
}

interface ScenarioData {
  CONDITION?:   string;
  DIRECTION?:   string;
  ENTRY?:       string;
  SL?:          string;
  TP1?:         string;
  VALID_UNTIL?: string;
}

// ── ScenarioCard ──────────────────────────────────────────────────────────────

function ScenarioCard({ data }: { data: ScenarioData }) {
  const [saveState, setSaveState] = useState<"idle" | "loading" | "done">("idle");

  async function saveScenario() {
    setSaveState("loading");
    try {
      await fetch("/api/trades/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bias:       data.DIRECTION ?? "Scenario",
          entry:      data.ENTRY ? parseFloat(data.ENTRY.replace(/[^0-9.]/g, "")) : null,
          sl:         data.SL ? parseFloat(data.SL.replace(/[^0-9.]/g, "")) : null,
          tp1:        data.TP1 ? parseFloat(data.TP1.replace(/[^0-9.]/g, "")) : null,
          type:       "scenario",
          condition:  data.CONDITION ?? "",
        }),
      });
      setSaveState("done");
    } catch {
      setSaveState("idle");
    }
  }

  return (
    <div style={{
      borderRadius: "10px",
      border: "1px solid rgba(212,175,55,0.18)",
      borderLeft: "3px solid #D4AF37",
      margin: "10px 0",
      maxWidth: "100%",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>

      {/* ── TRIGGER REQUIRED header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px",
        background: "rgba(212,175,55,0.08)",
        borderBottom: "1px solid rgba(212,175,55,0.15)",
      }}>
        <span style={{ fontSize: "11px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "#D4AF37", fontWeight: 700 }}>
          Trigger Required — Conditional Scenario
        </span>
      </div>

      {/* ── Conditions block ── */}
      {data.CONDITION && (
        <div style={{
          padding: "10px 14px",
          background: "rgba(212,175,55,0.04)",
          borderBottom: "1px solid rgba(212,175,55,0.1)",
        }}>
          <div style={{ fontSize: "9px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(212,175,55,0.5)", marginBottom: "6px" }}>
            Condition to trigger
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <span style={{ color: "#D4AF37", marginTop: "1px", flexShrink: 0 }}>●</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.82)", lineHeight: "1.55" }}>
              {data.CONDITION}
            </span>
          </div>
        </div>
      )}

      {/* ── Warning line ── */}
      <div style={{
        padding: "8px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(251,146,60,0.04)",
      }}>
        <span style={{ fontSize: "11px", color: "rgba(251,146,60,0.85)", fontWeight: 600 }}>
          Do not enter before all conditions are met — front-running invalidates the setup
        </span>
      </div>

      {/* ── Levels ── */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {[
          { label: "DIRECTION", value: data.DIRECTION },
          { label: "ENTRY",     value: data.ENTRY },
          { label: "SL",        value: data.SL },
          { label: "TP1",       value: data.TP1 },
        ].filter((r) => r.value).map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "10px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", minWidth: "68px" }}>{label}</span>
            <span style={{ color: "rgba(255,255,255,0.88)", fontSize: "13px", fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
        {data.VALID_UNTIL && (
          <div style={{ marginTop: "4px", fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
            Valid until: {data.VALID_UNTIL}
          </div>
        )}
      </div>

      {/* ── Save button ── */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {saveState === "done" ? (
          <span style={{ color: "rgba(212,175,55,0.6)", fontSize: "11px", fontFamily: "monospace" }}>Scenario saved ✓</span>
        ) : (
          <button
            onClick={saveScenario}
            disabled={saveState === "loading"}
            style={{
              border: "1px solid rgba(212,175,55,0.25)",
              background: "transparent",
              color: "rgba(212,175,55,0.7)",
              padding: "6px 14px",
              borderRadius: "7px",
              fontSize: "11px",
              minHeight: "36px",
              cursor: saveState === "loading" ? "not-allowed" : "pointer",
              opacity: saveState === "loading" ? 0.6 : 1,
            }}
          >
            {saveState === "loading" ? "Saving…" : "Save scenario"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── TradeCard ─────────────────────────────────────────────────────────────────

function TradeCard({ data }: { data: TradeData }) {
  const [logState, setLogState] = useState<"idle" | "loading" | "done">("idle");

  const bias = data.BIAS ?? "";
  const isBullish = bias.toLowerCase().includes("bullish") || bias.toLowerCase().includes("long");
  const isBearish = bias.toLowerCase().includes("bearish") || bias.toLowerCase().includes("short");
  const biasColor = isBullish ? "#22c55e" : isBearish ? "#ef4444" : "#D4AF37";

  const confluence = data.CONFLUENCE ? parseInt(data.CONFLUENCE, 10) : null;
  const confColor =
    confluence == null ? "#6b7280"
    : confluence >= 6 ? "#22c55e"
    : confluence === 5 ? "#f59e0b"
    : "#ef4444";

  async function logTrade() {
    setLogState("loading");
    try {
      await fetch("/api/trades/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bias,
          entry: data.ENTRY ? parseFloat(data.ENTRY.replace(/[^0-9.]/g, "")) : null,
          sl: data.SL ? parseFloat(data.SL.replace(/[^0-9.]/g, "")) : null,
          tp1: data.TP1 ? parseFloat(data.TP1.replace(/[^0-9.]/g, "")) : null,
          tp2: data.TP2 ? parseFloat(data.TP2.replace(/[^0-9.]/g, "")) : null,
          confluence,
        }),
      });
      setLogState("done");
    } catch {
      setLogState("idle");
    }
  }

  return (
    <div style={{
      padding: "16px",
      borderRadius: "12px",
      background: "rgba(212,175,55,0.05)",
      border: "1px solid rgba(212,175,55,0.25)",
      borderLeft: "3px solid #D4AF37",
      margin: "12px 0",
      maxWidth: "100%",
      boxSizing: "border-box",
    }}>
      {bias && (
        <div style={{ fontSize: "16px", fontWeight: 700, color: biasColor, marginBottom: "10px" }}>
          {bias}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "10px" }}>
        {[
          { label: "ENTRY", value: data.ENTRY },
          { label: "SL", value: data.SL },
          { label: "TP1", value: data.TP1 },
          { label: "TP2", value: data.TP2 },
        ].filter(r => r.value).map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", minWidth: "40px" }}>{label}</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {confluence != null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>CONFLUENCE</span>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: confColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            color: "#000",
            flexShrink: 0,
          }}>
            {confluence}
          </div>
        </div>
      )}

      {data.SESSION && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>SESSION</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px" }}>{data.SESSION}</span>
        </div>
      )}

      {data.NOTE && (
        <div style={{ fontStyle: "italic", color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "8px" }}>
          {data.NOTE}
        </div>
      )}

      <div style={{ marginTop: "12px" }}>
        {logState === "done" ? (
          <span style={{ color: "rgba(34,197,94,0.7)", fontSize: "11px", fontFamily: "var(--font-mono, monospace)" }}>Trade logged ✓</span>
        ) : (
          <button
            onClick={logTrade}
            disabled={logState === "loading"}
            style={{
              border: "1px solid rgba(212,175,55,0.4)",
              background: "transparent",
              color: "#D4AF37",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              minHeight: "44px",
              minWidth: "120px",
              cursor: logState === "loading" ? "not-allowed" : "pointer",
              opacity: logState === "loading" ? 0.6 : 1,
            }}
          >
            {logState === "loading" ? "Logging…" : "Log this trade"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── NoTradeCard ───────────────────────────────────────────────────────────────

function NoTradeCard({ data }: { data: NoTradeData }) {
  return (
    <div style={{
      padding: "16px",
      borderRadius: "12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      margin: "12px 0",
      maxWidth: "100%",
      boxSizing: "border-box",
    }}>
      <div style={{ color: "#f59e0b", fontWeight: 600, fontSize: "14px", marginBottom: data.WAIT_FOR || data.NEXT_CHECK ? "8px" : "0" }}>
        NO TRADE{data.reason ? ` — ${data.reason}` : ""}
      </div>
      {data.WAIT_FOR && (
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", marginBottom: "4px" }}>
          <span style={{ color: "rgba(255,255,255,0.4)", marginRight: "8px" }}>WAIT FOR</span>
          {data.WAIT_FOR}
        </div>
      )}
      {data.NEXT_CHECK && (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          <span style={{ marginRight: "8px" }}>NEXT CHECK</span>
          {data.NEXT_CHECK}
        </div>
      )}
    </div>
  );
}

// ── VerdictCard ───────────────────────────────────────────────────────────────
// The coach is prompted to lead every response with a one-line verdict
// ("Don't trade this.", "There's a setup forming.", "Wait for [level].").
// That first line is the real "no ::: marker" signal — this card promotes it
// into the visual centerpiece instead of letting it read as a plain sentence.

type Verdict = { type: "notrade" | "trade"; phrase: string };

const VERDICT_NOTRADE_RE = /^(don'?t\s+trade\s+this|no\s+trade|nothing\s+to\s+do(\s+today)?|wait\s+for\b.*|stand\s+aside|ne\s+pas\s+trader\b.*|pas\s+de\s+trade\b.*|rien\s+à\s+faire(\s+aujourd'?hui)?|attend(s|ez)\b.*)\.?$/i;
const VERDICT_TRADE_RE = /^((there'?s|there\s+is)\s+a\s+setup\s+forming|a\s+setup\s+is\s+forming|setup\s+forming|une\s+configuration\s+se\s+forme\b.*|un\s+setup\s+se\s+forme\b.*)\.?$/i;

function detectVerdict(content: string): Verdict | null {
  const firstLine = content.trim().split("\n").find((l) => l.trim())?.trim();
  if (!firstLine) return null;
  const clean = firstLine.replace(/^[*_#>\s]+|[*_\s]+$/g, "");
  if (VERDICT_NOTRADE_RE.test(clean)) return { type: "notrade", phrase: clean.replace(/\.$/, "") };
  if (VERDICT_TRADE_RE.test(clean))   return { type: "trade",   phrase: clean.replace(/\.$/, "") };
  return null;
}

function stripFirstLine(content: string): string {
  const idx = content.indexOf("\n");
  return idx === -1 ? "" : content.slice(idx + 1).replace(/^\s+/, "");
}

function VerdictCard({ type, phrase }: Verdict) {
  const isNoTrade = type === "notrade";
  return (
    <div
      className="rounded-2xl px-5 py-5 mb-5"
      style={{
        border: `1px solid ${isNoTrade ? "rgba(212,168,67,0.3)" : "rgba(212,168,67,0.15)"}`,
        background: isNoTrade ? "rgba(212,168,67,0.03)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#D4A843]/50 mb-2.5">
        {isNoTrade ? t("chat-verdict-no-trade-label") : t("chat-verdict-trade-label")}
      </div>
      <p className="font-serif italic text-[20px] sm:text-[22px] leading-snug text-white/90">
        {phrase}.
      </p>
    </div>
  );
}

// ── Block parsers ─────────────────────────────────────────────────────────────

function parseTradeBlock(block: string): TradeData {
  const data: TradeData = {};
  const keys: (keyof TradeData)[] = ["BIAS", "ENTRY", "SL", "TP1", "TP2", "CONFLUENCE", "SESSION", "NOTE"];
  for (const line of block.split("\n")) {
    for (const key of keys) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)`, "i"));
      if (m) (data as Record<string, string>)[key] = m[1].trim();
    }
  }
  return data;
}

function parseChartBlock(block: string): ChartData | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const d: Partial<ChartData> = {};

  for (const line of lines) {
    const ci = line.indexOf(":");
    if (ci < 0) continue;
    const key = line.slice(0, ci).trim().toUpperCase();
    const val = line.slice(ci + 1).trim();

    const num = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : null; };
    const parts = (s: string) => s.split("|").map((p) => p.trim());

    // range "low-high" where both are positive numbers
    const parseRange = (s: string): [number, number] | null => {
      const m = s.match(/^([\d.]+)\s*-\s*([\d.]+)/);
      if (!m) return null;
      const lo = parseFloat(m[1]), hi = parseFloat(m[2]);
      return isFinite(lo) && isFinite(hi) ? [Math.min(lo, hi), Math.max(lo, hi)] : null;
    };

    switch (key) {
      case "CURRENT": { const n = num(val); if (n) d.current = n; break; }
      case "BIAS": {
        const b = val.toLowerCase();
        if (b === "bullish" || b === "bearish" || b === "neutral") d.bias = b;
        break;
      }
      case "TIMEFRAME": { d.timeframe = val; break; }
      case "OB_BULL": case "OB_BEAR": {
        const ps = parts(val); const r = parseRange(ps[0]);
        if (r) {
          const item = { low: r[0], high: r[1], status: ps[1] ?? "clean", label: ps[2] ?? "" };
          if (key === "OB_BULL") d.ob_bull = [...(d.ob_bull ?? []), item];
          else                   d.ob_bear = [...(d.ob_bear ?? []), item];
        }
        break;
      }
      case "FVG_BULL": case "FVG_BEAR": {
        const ps = parts(val); const r = parseRange(ps[0]);
        if (r) {
          const item = { low: r[0], high: r[1], label: ps[1] ?? "" };
          if (key === "FVG_BULL") d.fvg_bull = [...(d.fvg_bull ?? []), item];
          else                    d.fvg_bear = [...(d.fvg_bear ?? []), item];
        }
        break;
      }
      case "LIQUIDITY_ABOVE": case "LIQUIDITY_BELOW": {
        const ps = parts(val); const p = num(ps[0]);
        if (p) {
          const item = { price: p, label: ps[1] ?? "" };
          if (key === "LIQUIDITY_ABOVE") d.liquidity_above = [...(d.liquidity_above ?? []), item];
          else                           d.liquidity_below = [...(d.liquidity_below ?? []), item];
        }
        break;
      }
      case "SUPPORT": {
        const ps = parts(val); const p = num(ps[0]);
        if (p) d.support = [...(d.support ?? []), { price: p, label: ps[1] ?? "" }];
        break;
      }
      case "RESISTANCE": {
        const ps = parts(val); const p = num(ps[0]);
        if (p) d.resistance = [...(d.resistance ?? []), { price: p, label: ps[1] ?? "" }];
        break;
      }
      case "CLOSES": {
        const nums = val.split(",").map(s => parseFloat(s.trim())).filter(n => isFinite(n));
        if (nums.length > 0) d.closes = nums;
        break;
      }
      case "VWAP":  { const n = num(val); if (n) d.vwap = n; break; }
      case "ENTRY": {
        const ps = parts(val); const p = num(ps[0]);
        if (p) d.entry = { price: p, type: ps[1] ?? "limit" };
        break;
      }
      case "SL":  { const n = num(val); if (n != null) d.sl  = n; break; }
      case "TP1": { const n = num(val); if (n != null) d.tp1 = n; break; }
      case "TP2": { const n = num(val); if (n != null) d.tp2 = n; break; }
      case "AMD":   { d.amd = val; break; }
      case "SWEEP": {
        const ps = parts(val); const p = num(ps[0]);
        if (p) d.sweep = { price: p, direction: ps[1] ?? "above" };
        break;
      }
    }
  }

  if (!d.current || !isFinite(d.current)) return null;
  return d as ChartData;
}

function parseScenarioBlock(block: string): ScenarioData {
  const data: ScenarioData = {};
  for (const line of block.split("\n")) {
    const m = (key: string) => line.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)`, "i"))?.[1]?.trim();
    if (m("CONDITION"))   data.CONDITION   = m("CONDITION")!;
    if (m("DIRECTION"))   data.DIRECTION   = m("DIRECTION")!;
    if (m("ENTRY"))       data.ENTRY       = m("ENTRY")!;
    if (m("SL"))          data.SL          = m("SL")!;
    if (m("TP1"))         data.TP1         = m("TP1")!;
    if (m("VALID UNTIL")) data.VALID_UNTIL = m("VALID UNTIL")!;
  }
  return data;
}

function parseNoTradeBlock(block: string): NoTradeData {
  const data: NoTradeData = {};
  const firstLine = block.split("\n").find(l => l.trim());
  if (firstLine) {
    const colonIdx = firstLine.indexOf(":");
    data.reason = colonIdx >= 0 ? firstLine.slice(colonIdx + 1).trim() : firstLine.trim();
  }
  for (const line of block.split("\n")) {
    const wm = line.match(/^\s*WAIT\s*FOR\s*:\s*(.+)/i);
    if (wm) data.WAIT_FOR = wm[1].trim();
    const nm = line.match(/^\s*NEXT\s*CHECK\s*:\s*(.+)/i);
    if (nm) data.NEXT_CHECK = nm[1].trim();
  }
  return data;
}

// ── Pre-processor: split content into segments ────────────────────────────────

type Segment =
  | { type: "markdown"; content: string }
  | { type: "trade";    data: TradeData }
  | { type: "notrade";  data: NoTradeData }
  | { type: "scenario"; data: ScenarioData }
  | { type: "chart";    data: ChartData }
  | { type: "thinking"; text: string };

function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const blockRe =
    /:::thinking\b([\s\S]*?)^:::\s*$|:::trade\b([\s\S]*?)^:::\s*$|:::notrade\b([\s\S]*?)^:::\s*$|:::scenario\b([\s\S]*?)^:::\s*$|:::chart\b([\s\S]*?)^:::\s*$/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "markdown", content: content.slice(lastIndex, match.index) });
    }
    if (match[1] != null) {
      segments.push({ type: "thinking", text: match[1].trim() });
    } else if (match[2] != null) {
      try { segments.push({ type: "trade",    data: parseTradeBlock(match[2]) }); }
      catch { segments.push({ type: "markdown", content: match[0] }); }
    } else if (match[3] != null) {
      try { segments.push({ type: "notrade",  data: parseNoTradeBlock(match[3]) }); }
      catch { segments.push({ type: "markdown", content: match[0] }); }
    } else if (match[4] != null) {
      try { segments.push({ type: "scenario", data: parseScenarioBlock(match[4]) }); }
      catch { segments.push({ type: "markdown", content: match[0] }); }
    } else if (match[5] != null) {
      const chartData = parseChartBlock(match[5]);
      if (chartData) segments.push({ type: "chart", data: chartData });
      // silently skip malformed chart blocks
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "markdown", content: content.slice(lastIndex) });
  }

  return segments;
}

// ── Price highlighter ─────────────────────────────────────────────────────────

// Indicator prefixes that mean the number is NOT a price
// The char class below is split to avoid Tailwind JIT scanning it as an arbitrary property.
const _sepChars = "[-" + ":=]";
const INDICATOR_PREFIXES = new RegExp(
  `\\b(RSI|ADX|ATR|CCI|MACD|EMA|VIX|Stoch|volume|OI|contracts)\\s*${_sepChars}?\\s*$`,
  "i"
);
const PRICE_RE = /\b(4[0-9]{3}|5[0-9]{3})(\.\d{1,2})?\b/g;

function highlightPrices(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  PRICE_RE.lastIndex = 0;

  while ((m = PRICE_RE.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    if (INDICATOR_PREFIXES.test(before)) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} style={{ color: "#D4AF37", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// ── processChildren: walk React children and highlight prices in strings ─────

function processChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts = highlightPrices(child);
      if (parts.length === 1 && typeof parts[0] === "string") return child;
      return <>{parts}</>;
    }
    return child;
  });
}

// The coach writes section labels (STRUCTURE, MACRO CONTEXT, CONDITIONS,
// RISKS TO WATCH, BIAS, PROP FIRM NOTE…) as plain standalone lines — never
// as markdown "## " headings. Detect them by shape (short, all-caps, its
// own paragraph) instead of relying on heading syntax that never appears.
const SECTION_LABEL_RE = /^[A-Z][A-Z0-9 /&'-]{1,38}$/;

function asSectionLabel(children: React.ReactNode): string | null {
  let text: string | null = null;
  if (typeof children === "string") text = children;
  else if (Array.isArray(children) && children.length === 1 && typeof children[0] === "string") text = children[0];
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return null;
  return SECTION_LABEL_RE.test(trimmed) ? trimmed : null;
}

// ── Markdown components ───────────────────────────────────────────────────────

let headingCount = 0;

function SectionLabel({ text }: { text: string }) {
  const isFirst = headingCount === 0;
  headingCount++;
  return (
    <>
      {!isFirst && (
        <div style={{
          height: "1px",
          border: "none",
          background: "linear-gradient(to right, transparent, rgba(212,175,55,0.15), transparent)",
          margin: "18px 0",
        }} />
      )}
      <p className="text-[10px] sm:text-[11px] font-mono font-semibold text-[#D4A843]/40 tracking-[0.15em] uppercase mt-6 mb-3 first:mt-0">
        {text}
      </p>
    </>
  );
}

const components: Components = {
  h2({ children }) {
    const isFirst = headingCount === 0;
    headingCount++;
    return (
      <>
        {!isFirst && (
          <div style={{
            height: "1px",
            border: "none",
            background: "linear-gradient(to right, transparent, rgba(212,175,55,0.15), transparent)",
            margin: "18px 0",
          }} />
        )}
        <h2 className="text-[10px] sm:text-[11px] font-mono font-semibold text-[#D4A843]/40 tracking-[0.15em] uppercase mt-6 mb-3 first:mt-0">
          {children}
        </h2>
      </>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-[12px] font-semibold text-white/75 tracking-[0.04em] uppercase mt-5 mb-2 first:mt-0">
        {children}
      </h3>
    );
  },
  strong({ children }) {
    return <strong className="font-semibold text-white/90">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-white/70">{children}</em>;
  },
  p({ children }) {
    const label = asSectionLabel(children);
    if (label) return <SectionLabel text={label} />;
    return (
      <p className="font-serif leading-[1.8] text-[15px] font-normal text-[#E5E5E5] mb-4 last:mb-0 px-2 sm:px-0">
        {processChildren(children)}
      </p>
    );
  },
  ul({ children }) {
    return <ul className="mb-4 space-y-1.5 pl-4 list-disc marker:text-white/25 last:mb-0">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-4 space-y-1.5 pl-4 list-decimal marker:text-white/30 last:mb-0">{children}</ol>;
  },
  li({ children }) {
    return <li className="font-serif text-[15px] font-normal text-[#E5E5E5] leading-[1.8]">{processChildren(children)}</li>;
  },
  hr() {
    return <div className="my-3 h-px w-full bg-white/[0.07]" role="separator" />;
  },
  code({ children }) {
    return (
      <code className="rounded px-1.5 py-0.5 bg-white/[0.06] text-[12px] text-white/80 font-mono">
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-[12px] text-white/70 font-mono overflow-x-auto mb-4 leading-relaxed">
        {children}
      </pre>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-white/20 pl-3 my-4 text-white/60 italic">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div style={{ overflowX: "auto", margin: "12px 0" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          fontSize: "13px",
        }}>
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <thead style={{
        background: "rgba(212,175,55,0.06)",
        borderBottom: "1px solid rgba(212,175,55,0.12)",
      }}>
        {children}
      </thead>
    );
  },
  tbody({ children }) {
    return <tbody>{children}</tbody>;
  },
  tr({ children }) {
    return (
      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        {children}
      </tr>
    );
  },
  th({ children }) {
    return (
      <th style={{
        padding: "8px 12px",
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "rgba(212,175,55,0.6)",
        fontWeight: 600,
        textAlign: "left",
        whiteSpace: "nowrap",
      }}>
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td style={{
        padding: "8px 12px",
        color: "rgba(255,255,255,0.8)",
        verticalAlign: "top",
        lineHeight: "1.5",
      }}>
        {processChildren(children)}
      </td>
    );
  },
};

// ── MarkdownSegment: renders one markdown block with price highlights ──────────

function MarkdownSegment({ content }: { content: string }) {
  headingCount = 0;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type Props = { content: string };

function MarkdownMessage({ content }: Props) {
  const verdict = detectVerdict(content);
  const bodyContent = verdict ? stripFirstLine(content) : content;
  const segments = splitSegments(bodyContent);

  return (
    <>
      {verdict && <VerdictCard type={verdict.type} phrase={verdict.phrase} />}
      {segments.map((seg, i) => {
        if (seg.type === "thinking") return null;
        if (seg.type === "trade")    return <TradeCard key={i} data={seg.data} />;
        if (seg.type === "notrade")  return <NoTradeCard key={i} data={seg.data} />;
        if (seg.type === "scenario") return <ScenarioCard key={i} data={seg.data} />;
        if (seg.type === "chart")    return <StructureChart key={i} data={seg.data} />;
        return <MarkdownSegment key={i} content={seg.content} />;
      })}
    </>
  );
}

export default React.memo(MarkdownMessage);
