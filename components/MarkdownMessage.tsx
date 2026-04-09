"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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
      setTimeout(() => setLogState("idle"), 3000);
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
          <span style={{ color: "#22c55e", fontSize: "13px" }}>Trade logged ✓</span>
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
  | { type: "trade"; data: TradeData }
  | { type: "notrade"; data: NoTradeData };

function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  // Match :::trade ... ::: or :::notrade ... :::
  const blockRe = /:::trade\b([\s\S]*?)^:::\s*$|:::notrade\b([\s\S]*?)^:::\s*$/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "markdown", content: content.slice(lastIndex, match.index) });
    }
    if (match[1] != null) {
      try {
        segments.push({ type: "trade", data: parseTradeBlock(match[1]) });
      } catch {
        segments.push({ type: "markdown", content: match[0] });
      }
    } else if (match[2] != null) {
      try {
        segments.push({ type: "notrade", data: parseNoTradeBlock(match[2]) });
      } catch {
        segments.push({ type: "markdown", content: match[0] });
      }
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
      <span key={m.index} style={{ color: "#D4AF37", fontWeight: 600 }}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// ── Markdown components ───────────────────────────────────────────────────────

let headingCount = 0;

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
            background: "linear-gradient(to right, transparent, rgba(212,175,55,0.2), transparent)",
            margin: "20px 0",
          }} />
        )}
        <h2 className="text-[13px] font-semibold text-white/90 tracking-[0.06em] uppercase mt-5 mb-1.5 first:mt-0">
          {children}
        </h2>
      </>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-[12px] font-semibold text-white/75 tracking-[0.04em] uppercase mt-3.5 mb-1 first:mt-0">
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
    return (
      <p className="leading-[1.75] text-[13px] text-white/75 mb-2 last:mb-0 px-2 sm:px-0">
        {children}
      </p>
    );
  },
  ul({ children }) {
    return <ul className="mb-2 space-y-0.5 pl-4 list-disc marker:text-white/25 last:mb-0">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-2 space-y-0.5 pl-4 list-decimal marker:text-white/30 last:mb-0">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-[13px] text-white/75 leading-[1.7]">{children}</li>;
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
      <pre className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-[12px] text-white/70 font-mono overflow-x-auto mb-2 leading-relaxed">
        {children}
      </pre>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-white/20 pl-3 my-2 text-white/60 italic">
        {children}
      </blockquote>
    );
  },
  // text-level price highlighting
  text({ children }) {
    if (typeof children !== "string") return <>{children}</>;
    const parts = highlightPrices(children);
    if (parts.length === 1 && typeof parts[0] === "string") return <>{children}</>;
    return <>{parts}</>;
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

export default function MarkdownMessage({ content }: Props) {
  const segments = splitSegments(content);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "trade") return <TradeCard key={i} data={seg.data} />;
        if (seg.type === "notrade") return <NoTradeCard key={i} data={seg.data} />;
        return <MarkdownSegment key={i} content={seg.content} />;
      })}
    </>
  );
}
