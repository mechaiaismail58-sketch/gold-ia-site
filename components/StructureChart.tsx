"use client";

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OBLevel     { low: number; high: number; status: string; label: string }
interface FVGLevel    { low: number; high: number; label: string }
interface PriceLabel  { price: number; label: string }

export interface ChartData {
  current:           number;
  bias?:             "bullish" | "bearish" | "neutral";
  timeframe?:        string;
  ob_bull?:          OBLevel[];
  ob_bear?:          OBLevel[];
  fvg_bull?:         FVGLevel[];
  fvg_bear?:         FVGLevel[];
  liquidity_above?:  PriceLabel[];
  liquidity_below?:  PriceLabel[];
  support?:          PriceLabel[];
  resistance?:       PriceLabel[];
  vwap?:             number;
  entry?:            { price: number; type: string };
  sl?:               number;
  tp1?:              number;
  tp2?:              number;
  amd?:              string;
  sweep?:            { price: number; direction: string };
}

// ── Layout constants ──────────────────────────────────────────────────────────

const VW         = 680;
const VH         = 362;
const X_LABEL    = 54;   // right edge of price labels
const X_LEFT     = 58;   // chart area left
const X_RIGHT    = 608;  // chart area right (line ends here)
const X_BADGE_L  = 611;  // badge/label start
const X_BADGE_R  = 678;  // badge/label end
const BADGE_W    = X_BADGE_R - X_BADGE_L; // 67
const Y_TOP      = 28;
const Y_BOTTOM   = 318;
const CHART_H    = Y_BOTTOM - Y_TOP;      // 290
const AMD_Y      = 348;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(p: number): string {
  if (p === Math.floor(p)) return p.toFixed(0);
  const s = p.toFixed(2);
  return s.endsWith("0") ? p.toFixed(1) : s;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StructureChart({ data }: { data: ChartData }) {
  // Collect every price in the data to compute scale
  const all: number[] = [data.current];
  data.ob_bull?.forEach(o  => all.push(o.low, o.high));
  data.ob_bear?.forEach(o  => all.push(o.low, o.high));
  data.fvg_bull?.forEach(f => all.push(f.low, f.high));
  data.fvg_bear?.forEach(f => all.push(f.low, f.high));
  data.liquidity_above?.forEach(l => all.push(l.price));
  data.liquidity_below?.forEach(l => all.push(l.price));
  data.support?.forEach(s  => all.push(s.price));
  data.resistance?.forEach(r => all.push(r.price));
  if (data.vwap)        all.push(data.vwap);
  if (data.entry)       all.push(data.entry.price);
  if (data.sl != null)  all.push(data.sl);
  if (data.tp1 != null) all.push(data.tp1);
  if (data.tp2 != null) all.push(data.tp2);
  if (data.sweep)       all.push(data.sweep.price);

  const rawMin  = Math.min(...all);
  const rawMax  = Math.max(...all);
  const span    = Math.max(rawMax - rawMin, 8);
  const pad     = span * 0.13;
  const pMin    = rawMin - pad;
  const pMax    = rawMax + pad;
  const pSpan   = pMax - pMin;

  function py(price: number): number {
    return Y_TOP + (pMax - price) / pSpan * CHART_H;
  }

  // Grid: unique prices, deduplicated if too close (< 2% of span apart)
  const gridPrices = [...new Set(all)]
    .sort((a, b) => b - a)
    .filter((p, i, arr) => i === 0 || arr[i - 1] - p > span * 0.025);

  // AMD
  const amdStr   = (data.amd ?? "").toLowerCase();
  const amdPhase = amdStr.includes("acc") ? "acc"
    : amdStr.includes("man")  ? "man"
    : amdStr.includes("dist") ? "dist"
    : null;

  const biasColor = data.bias === "bullish" ? "#4ADE80"
    : data.bias === "bearish" ? "#F87171"
    : "#D4AF37";

  // Helper: horizontal dashed line + right badge
  function levelLine(
    price: number,
    stroke: string, dashArray: string, strokeW: number,
    badgeFill: string, badgeStroke: string,
    badgeText: string, textFill: string,
  ) {
    const y = py(price);
    return (
      <g>
        <line x1={X_LEFT} y1={y} x2={X_BADGE_L - 2} y2={y}
          stroke={stroke} strokeWidth={strokeW} strokeDasharray={dashArray} />
        <rect x={X_BADGE_L} y={y - 8} width={BADGE_W} height={16}
          fill={badgeFill} stroke={badgeStroke} strokeWidth="0.8" rx="3" />
        <text x={X_BADGE_L + BADGE_W / 2} y={y + 4.5}
          fontSize="9.5" fill={textFill} fontFamily="monospace"
          textAnchor="middle" fontWeight="600">
          {badgeText}
        </text>
      </g>
    );
  }

  return (
    <div style={{
      margin: "16px 0",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(5,4,10,0.6)",
      overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{
          fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(212,175,55,0.5)",
        }}>
          Structure Chart{data.timeframe ? ` · ${data.timeframe}` : ""}
        </span>
        <span style={{
          fontSize: "10px", fontFamily: "monospace",
          color: biasColor, fontWeight: 600, letterSpacing: "0.08em",
        }}>
          {data.bias?.toUpperCase()}
        </span>
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{ display: "block" }}>

        {/* ── Grid lines ── */}
        {gridPrices.map((p, i) => (
          <line key={`g${i}`}
            x1={X_LEFT} y1={py(p)} x2={X_RIGHT} y2={py(p)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,4" />
        ))}

        {/* ── Y-axis price labels ── */}
        {gridPrices.map((p, i) => (
          <text key={`gl${i}`}
            x={X_LABEL} y={py(p) + 3.5}
            fontSize="9" fill="rgba(255,255,255,0.26)"
            fontFamily="monospace" textAnchor="end">
            {fmt(p)}
          </text>
        ))}

        {/* ── OB Bullish ── */}
        {data.ob_bull?.map((ob, i) => {
          const y1 = py(ob.high);
          const h  = Math.max(py(ob.low) - y1, 3);
          const op = ob.status === "dead" ? 0.3 : ob.status === "mitigated" ? 0.6 : 1;
          return (
            <g key={`obu${i}`} opacity={op}>
              <rect x={X_LEFT} y={y1} width={X_RIGHT - X_LEFT} height={h}
                fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.18)" strokeWidth="0.8" rx="1" />
              <text x={X_LEFT + 7} y={y1 + 11} fontSize="8" fill="rgba(74,222,128,0.5)"
                fontFamily="monospace" textTransform="uppercase">
                OB {ob.label}
              </text>
              <text x={X_LEFT + 7} y={y1 + 21} fontSize="8.5" fill="rgba(74,222,128,0.65)"
                fontFamily="monospace">
                {fmt(ob.low)}–{fmt(ob.high)}
              </text>
            </g>
          );
        })}

        {/* ── OB Bearish ── */}
        {data.ob_bear?.map((ob, i) => {
          const y1 = py(ob.high);
          const h  = Math.max(py(ob.low) - y1, 3);
          const op = ob.status === "dead" ? 0.3 : ob.status === "mitigated" ? 0.6 : 1;
          return (
            <g key={`obd${i}`} opacity={op}>
              <rect x={X_LEFT} y={y1} width={X_RIGHT - X_LEFT} height={h}
                fill="rgba(248,113,113,0.06)" stroke="rgba(248,113,113,0.18)" strokeWidth="0.8" rx="1" />
              <text x={X_LEFT + 7} y={y1 + 11} fontSize="8" fill="rgba(248,113,113,0.5)"
                fontFamily="monospace">
                OB {ob.label}
              </text>
              <text x={X_LEFT + 7} y={y1 + 21} fontSize="8.5" fill="rgba(248,113,113,0.65)"
                fontFamily="monospace">
                {fmt(ob.low)}–{fmt(ob.high)}
              </text>
            </g>
          );
        })}

        {/* ── FVG Bullish ── */}
        {data.fvg_bull?.map((f, i) => {
          const y1 = py(f.high);
          const h  = Math.max(py(f.low) - y1, 3);
          return (
            <g key={`fbu${i}`}>
              <rect x={X_LEFT} y={y1} width={X_RIGHT - X_LEFT} height={h}
                fill="rgba(212,175,55,0.05)" stroke="rgba(212,175,55,0.22)"
                strokeWidth="0.6" strokeDasharray="4,3" rx="1" />
              <text x={X_LEFT + 7} y={y1 + 11} fontSize="8" fill="rgba(212,175,55,0.55)"
                fontFamily="monospace">
                FVG {f.label}
              </text>
            </g>
          );
        })}

        {/* ── FVG Bearish ── */}
        {data.fvg_bear?.map((f, i) => {
          const y1 = py(f.high);
          const h  = Math.max(py(f.low) - y1, 3);
          return (
            <g key={`fbd${i}`}>
              <rect x={X_LEFT} y={y1} width={X_RIGHT - X_LEFT} height={h}
                fill="rgba(248,113,113,0.04)" stroke="rgba(248,113,113,0.2)"
                strokeWidth="0.6" strokeDasharray="4,3" rx="1" />
              <text x={X_LEFT + 7} y={y1 + 11} fontSize="8" fill="rgba(248,113,113,0.5)"
                fontFamily="monospace">
                FVG {f.label}
              </text>
            </g>
          );
        })}

        {/* ── Liquidity Above ── */}
        {data.liquidity_above?.map((l, i) => (
          <g key={`la${i}`}>
            <line x1={X_LEFT} y1={py(l.price)} x2={X_RIGHT} y2={py(l.price)}
              stroke="rgba(74,222,128,0.55)" strokeWidth="0.8" strokeDasharray="3,3" />
            <text x={X_LEFT + 7} y={py(l.price) - 4} fontSize="8" fill="rgba(74,222,128,0.6)"
              fontFamily="monospace">
              ⚡ {l.label || "Liq"}
            </text>
          </g>
        ))}

        {/* ── Liquidity Below ── */}
        {data.liquidity_below?.map((l, i) => (
          <g key={`lb${i}`}>
            <line x1={X_LEFT} y1={py(l.price)} x2={X_RIGHT} y2={py(l.price)}
              stroke="rgba(248,113,113,0.55)" strokeWidth="0.8" strokeDasharray="3,3" />
            <text x={X_LEFT + 7} y={py(l.price) + 12} fontSize="8" fill="rgba(248,113,113,0.6)"
              fontFamily="monospace">
              ⚡ {l.label || "Liq"}
            </text>
          </g>
        ))}

        {/* ── Support ── */}
        {data.support?.map((s, i) => (
          <g key={`sp${i}`}>
            <line x1={X_LEFT} y1={py(s.price)} x2={X_RIGHT} y2={py(s.price)}
              stroke="rgba(74,222,128,0.22)" strokeWidth="0.8" strokeDasharray="6,3" />
            <text x={X_RIGHT - 4} y={py(s.price) - 3} fontSize="8" fill="rgba(74,222,128,0.45)"
              fontFamily="monospace" textAnchor="end">
              {s.label || fmt(s.price)}
            </text>
          </g>
        ))}

        {/* ── Resistance ── */}
        {data.resistance?.map((r, i) => (
          <g key={`rs${i}`}>
            <line x1={X_LEFT} y1={py(r.price)} x2={X_RIGHT} y2={py(r.price)}
              stroke="rgba(248,113,113,0.22)" strokeWidth="0.8" strokeDasharray="6,3" />
            <text x={X_RIGHT - 4} y={py(r.price) - 3} fontSize="8" fill="rgba(248,113,113,0.45)"
              fontFamily="monospace" textAnchor="end">
              {r.label || fmt(r.price)}
            </text>
          </g>
        ))}

        {/* ── VWAP ── */}
        {data.vwap != null && (
          <g>
            <line x1={X_LEFT} y1={py(data.vwap)} x2={X_RIGHT} y2={py(data.vwap)}
              stroke="rgba(212,175,55,0.45)" strokeWidth="0.9" />
            <text x={X_RIGHT - 4} y={py(data.vwap) - 3} fontSize="8" fill="rgba(212,175,55,0.6)"
              fontFamily="monospace" textAnchor="end">
              VWAP
            </text>
          </g>
        )}

        {/* ── Sweep ── */}
        {data.sweep && (
          <g>
            <line x1={X_LEFT} y1={py(data.sweep.price)} x2={X_RIGHT} y2={py(data.sweep.price)}
              stroke="rgba(248,113,113,0.5)" strokeWidth="0.7" strokeDasharray="2,3" />
            <text x={X_LEFT + 7} y={
              data.sweep.direction === "above"
                ? py(data.sweep.price) - 4
                : py(data.sweep.price) + 13
            } fontSize="8" fill="rgba(248,113,113,0.65)" fontFamily="monospace">
              {data.sweep.direction === "above" ? "▲" : "▼"} SWEEP {fmt(data.sweep.price)}
            </text>
          </g>
        )}

        {/* ── SL ── */}
        {data.sl != null && levelLine(
          data.sl,
          "rgba(248,113,113,0.65)", "5,3", 1,
          "rgba(248,113,113,0.1)", "rgba(248,113,113,0.35)",
          `SL  ${fmt(data.sl)}`, "#F87171",
        )}

        {/* ── TP2 ── */}
        {data.tp2 != null && levelLine(
          data.tp2,
          "rgba(74,222,128,0.45)", "5,3", 0.9,
          "rgba(74,222,128,0.07)", "rgba(74,222,128,0.28)",
          `TP2 ${fmt(data.tp2)}`, "#4ADE80",
        )}

        {/* ── TP1 ── */}
        {data.tp1 != null && levelLine(
          data.tp1,
          "rgba(74,222,128,0.6)", "5,3", 1,
          "rgba(74,222,128,0.1)", "rgba(74,222,128,0.35)",
          `TP1 ${fmt(data.tp1)}`, "#4ADE80",
        )}

        {/* ── Entry ── */}
        {data.entry && levelLine(
          data.entry.price,
          "rgba(212,175,55,0.75)", "6,4", 1.2,
          "rgba(212,175,55,0.13)", "rgba(212,175,55,0.45)",
          `ENT ${fmt(data.entry.price)}`, "#D4AF37",
        )}

        {/* ── Current price subtle horizontal ── */}
        <line x1={X_LEFT} y1={py(data.current)} x2={X_BADGE_L - 2} y2={py(data.current)}
          stroke="rgba(212,175,55,0.2)" strokeWidth="1" />

        {/* ── Current price dot ── */}
        <circle cx={X_LEFT - 4} cy={py(data.current)} r="3.5" fill="#D4AF37" />

        {/* ── Current price badge ── */}
        <rect x={X_BADGE_L} y={py(data.current) - 9} width={BADGE_W} height={18}
          fill="rgba(212,175,55,0.18)" stroke="rgba(212,175,55,0.5)" strokeWidth="1" rx="3" />
        <text x={X_BADGE_L + BADGE_W / 2} y={py(data.current) + 4.5}
          fontSize="10.5" fill="#D4AF37" fontFamily="monospace"
          textAnchor="middle" fontWeight="700">
          {fmt(data.current)}
        </text>

        {/* ── AMD phase badges ── */}
        {amdPhase && (() => {
          const phases: Array<{ k: string; lbl: string; ac: string; af: string; as: string }> = [
            { k: "acc",  lbl: "ACCUM",  ac: "#D4AF37", af: "rgba(212,175,55,0.15)",  as: "rgba(212,175,55,0.45)" },
            { k: "man",  lbl: "MANIP",  ac: "#F87171", af: "rgba(248,113,113,0.15)", as: "rgba(248,113,113,0.45)" },
            { k: "dist", lbl: "DISTRIB",ac: "#4ADE80", af: "rgba(74,222,128,0.15)",  as: "rgba(74,222,128,0.45)" },
          ];
          return phases.map((ph, i) => {
            const active = amdPhase === ph.k;
            const bx     = X_LEFT + i * 100;
            return (
              <g key={ph.k}>
                <rect x={bx} y={AMD_Y - 13} width={94} height={18}
                  fill={active ? ph.af : "rgba(255,255,255,0.025)"}
                  stroke={active ? ph.as : "rgba(255,255,255,0.06)"}
                  strokeWidth="0.8" rx="3" />
                <text x={bx + 47} y={AMD_Y} fontSize="8.5" fontFamily="monospace"
                  textAnchor="middle" letterSpacing="0.06em"
                  fill={active ? ph.ac : "rgba(255,255,255,0.2)"}
                  fontWeight={active ? "700" : "400"}>
                  {ph.lbl}
                </text>
              </g>
            );
          });
        })()}

      </svg>
    </div>
  );
}
