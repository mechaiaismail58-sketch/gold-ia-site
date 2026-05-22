"use client";

import { useState } from "react";

type ParsedSignal = {
  direction: "LONG" | "SHORT";
  entry: string;
  stopLoss: string;
  tp1: string;
  tp2: string;
  confluenceScore: string | null;
};

function parseSignal(text: string): ParsedSignal | null {
  const dirMatch = text.match(/DIRECTION\s*[:\-]\s*(LONG|SHORT)/i);
  const entryMatch = text.match(/ENTRY\s*[:\-]\s*([\d\s,.]+)/i);
  const slMatch = text.match(/STOP\s*LOSS\s*[:\-]\s*([\d\s,.]+)/i)
    ?? text.match(/\bSL\s*[:\-]\s*([\d\s,.]+)/i);
  const tp1Match = text.match(/TP1\s*[:\-]\s*([\d\s,.]+)/i);
  const tp2Match = text.match(/TP2\s*[:\-]\s*([\d\s,.]+)/i);
  const confluenceMatch = text.match(/Confluence\s*Score\s*[:\-]\s*(\d+)\/10/i)
    ?? text.match(/CONFLUENCE\s*[:\-]\s*(\d+)\/10/i);

  if (!dirMatch || !entryMatch || !slMatch) return null;

  const cleanNum = (s: string) => s.trim().replace(/\s+/g, "").split("—")[0].split("–")[0].trim();

  return {
    direction: dirMatch[1].toUpperCase() as "LONG" | "SHORT",
    entry: cleanNum(entryMatch[1]),
    stopLoss: cleanNum(slMatch[1]),
    tp1: tp1Match ? cleanNum(tp1Match[1]) : "—",
    tp2: tp2Match ? cleanNum(tp2Match[1]) : "—",
    confluenceScore: confluenceMatch ? `${confluenceMatch[1]}/10` : null,
  };
}

function drawSignalCard(signal: ParsedSignal): string {
  const W = 720;
  const H = 400;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const GOLD = "#D4AF37";
  const BG = "#0A0812";
  const MUTED = "rgba(255,255,255,0.28)";
  const WHITE = "rgba(255,255,255,0.88)";
  const isLong = signal.direction === "LONG";
  const DIRECTION_COLOR = isLong ? "#22c55e" : "#ef4444";

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Top gold accent bar
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, W, 3);

  // Subtle inner border
  ctx.strokeStyle = "rgba(212,175,55,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Header: BULLION DESK
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.letterSpacing = "0.18em";
  ctx.fillStyle = GOLD;
  ctx.fillText("BULLION DESK", 40, 38);

  ctx.font = "10px 'Courier New', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillText("XAUUSD  ·  AI SENIOR TRADING ADVISOR", 40, 56);

  // Timestamp top-right
  const now = new Date().toUTCString().slice(0, 25);
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.textAlign = "right";
  ctx.fillText(now + " UTC", W - 40, 38);
  ctx.textAlign = "left";

  // Divider
  ctx.strokeStyle = "rgba(212,175,55,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 68);
  ctx.lineTo(W - 40, 68);
  ctx.stroke();

  // Direction badge
  const badgeW = 200;
  const badgeH = 56;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 82;
  const badgeRadius = 10;

  ctx.fillStyle = isLong ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)";
  ctx.strokeStyle = isLong ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 30px 'Courier New', monospace";
  ctx.fillStyle = DIRECTION_COLOR;
  ctx.textAlign = "center";
  ctx.fillText(signal.direction, W / 2, badgeY + badgeH - 14);
  ctx.textAlign = "left";

  // Trade data grid
  const colLeft = 64;
  const colRight = 400;
  const labelY = 174;
  const rowH = 38;

  function drawRow(label: string, value: string, x: number, y: number) {
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = MUTED;
    ctx.fillText(label, x, y);
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillStyle = WHITE;
    ctx.fillText(value, x, y + 20);
  }

  drawRow("ENTRY", signal.entry, colLeft, labelY);
  drawRow("STOP LOSS", signal.stopLoss, colLeft, labelY + rowH);
  drawRow("TP1", signal.tp1, colRight, labelY);
  drawRow("TP2", signal.tp2, colRight, labelY + rowH);

  // Divider before score
  const divY = 270;
  ctx.strokeStyle = "rgba(212,175,55,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, divY);
  ctx.lineTo(W - 40, divY);
  ctx.stroke();

  // Confluence Score
  if (signal.confluenceScore) {
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillStyle = MUTED;
    ctx.fillText("CONFLUENCE SCORE", colLeft, 292);
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillStyle = GOLD;
    ctx.fillText(signal.confluenceScore, colLeft, 316);
  }

  // XAUUSD label right side
  ctx.font = "10px 'Courier New', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.textAlign = "right";
  ctx.fillText("GOLD ANALYSIS", W - 40, 292);
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.fillStyle = "rgba(212,175,55,0.4)";
  ctx.fillText("XAUUSD", W - 40, 316);
  ctx.textAlign = "left";

  // Bottom divider
  ctx.strokeStyle = "rgba(212,175,55,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, H - 42);
  ctx.lineTo(W - 40, H - 42);
  ctx.stroke();

  // Footer
  ctx.font = "10px 'Courier New', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.textAlign = "center";
  ctx.fillText("bulliondesk.pro  —  Not investment advice. Trade at your own risk.", W / 2, H - 18);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

export default function ShareSignalButton({ text }: { text: string }) {
  const [showMenu, setShowMenu] = useState(false);

  const signal = parseSignal(text);
  if (!signal) return null;

  function handleDownload() {
    const dataUrl = drawSignalCard(signal!);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `bulliondesk-analysis-${signal!.direction.toLowerCase()}-${Date.now()}.png`;
    a.click();
    setShowMenu(false);
  }

  function handleTwitter() {
    const tweetText = [
      `Gold market analysis — Bullion Desk`,
      ``,
      `${signal!.direction} XAUUSD`,
      signal!.confluenceScore ? `Confluence: ${signal!.confluenceScore}` : "",
      ``,
      `bulliondesk.pro — AI Senior Trading Advisor`,
      `Not investment advice.`,
    ].filter(Boolean).join("\n");

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShowMenu(false);
  }

  return (
    <div className="relative inline-block mt-2">
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl border border-[rgba(212,175,55,0.3)] px-3 py-1.5 text-[11px] text-[rgba(212,175,55,0.7)] hover:border-[rgba(212,175,55,0.6)] hover:text-[#D4AF37] transition"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1L11 4L8 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 4H5C3.34 4 2 5.34 2 7V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Share Analysis
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-20 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[rgba(10,8,18,0.97)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden min-w-[160px]">
            <button
              type="button"
              onClick={handleDownload}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/70 hover:bg-[rgba(212,175,55,0.06)] hover:text-white transition text-left"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1V8M6 8L3 5M6 8L9 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 10H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Download PNG
            </button>
            <button
              type="button"
              onClick={handleTwitter}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] text-white/70 hover:bg-[rgba(212,175,55,0.06)] hover:text-white transition text-left border-t border-white/5"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M11 1L7 5.5L11 10H8.5L6 7L3.5 10H1L5 5.5L1 1H3.5L6 4L8.5 1H11Z" fill="currentColor"/>
              </svg>
              Share on X
            </button>
          </div>
        </>
      )}
    </div>
  );
}
