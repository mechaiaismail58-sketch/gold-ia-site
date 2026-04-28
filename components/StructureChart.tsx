"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OBLevel    { low: number; high: number; label: string; status?: string }
interface PriceLabel { price: number; label: string }

export interface ChartData {
  current:          number;
  bias?:            "bullish" | "bearish" | "neutral";
  closes?:          number[];
  timeframe?:       string;
  ob_bull?:         OBLevel[];
  ob_bear?:         OBLevel[];
  entry?:           { price: number; type?: string };
  sl?:              number;
  tp1?:             number;
  tp2?:             number;
  sweep?:           { price: number; direction: string };
  liquidity_above?: PriceLabel[];
  liquidity_below?: PriceLabel[];
  amd?:             string;
  // legacy fields — kept for parser compat, not rendered
  fvg_bull?:        unknown[];
  fvg_bear?:        unknown[];
  support?:         PriceLabel[];
  resistance?:      PriceLabel[];
  vwap?:            number;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const VW        = 680;
const VH        = 360;
const X_YLABEL  = 52;   // Y-axis label right edge
const X_LEFT    = 58;   // chart/OB zone left
const X_CURVE_R = 610;  // curve & OB right edge / level line end
const X_BADGE_L = 614;  // badge left (entry/SL/TP)
const BADGE_W   = 64;   // badge width (614+64=678 ≤ 680)
const Y_TOP     = 26;
const Y_BOTTOM  = 308;
const CHART_H   = Y_BOTTOM - Y_TOP;  // 282
const Y_AMD     = 344;               // AMD badge center Y

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(p: number): string {
  if (p === Math.floor(p)) return p.toFixed(0);
  const s = p.toFixed(2);
  return s.endsWith("0") ? p.toFixed(1) : s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StructureChart({ data }: { data: ChartData }) {
  const closes = data.closes ?? [];

  // ── Collect all prices for scale ──────────────────────────────────────────
  const allPrices: number[] = closes.length > 0 ? [...closes] : [data.current];
  allPrices.push(data.current);
  data.ob_bull?.forEach(o => allPrices.push(o.low, o.high));
  data.ob_bear?.forEach(o => allPrices.push(o.low, o.high));
  data.liquidity_above?.forEach(l => allPrices.push(l.price));
  data.liquidity_below?.forEach(l => allPrices.push(l.price));
  if (data.entry)       allPrices.push(data.entry.price);
  if (data.sl != null)  allPrices.push(data.sl);
  if (data.tp1 != null) allPrices.push(data.tp1);
  if (data.tp2 != null) allPrices.push(data.tp2);
  if (data.sweep)       allPrices.push(data.sweep.price);

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const span   = Math.max(rawMax - rawMin, 8);
  const pad    = span * 0.12;
  const pMin   = rawMin - pad;
  const pMax   = rawMax + pad;
  const pSpan  = pMax - pMin;

  function py(price: number): number {
    return Y_TOP + (pMax - price) / pSpan * CHART_H;
  }

  // ── Price curve (smooth quadratic bezier) ────────────────────────────────
  const n = closes.length;
  const curvePoints = n > 1
    ? closes.map((c, i) => ({
        x: X_LEFT + (i / (n - 1)) * (X_CURVE_R - X_LEFT),
        y: py(c),
      }))
    : [];

  let bezierPath = "";
  if (curvePoints.length > 1) {
    bezierPath = `M ${curvePoints[0].x.toFixed(1)},${curvePoints[0].y.toFixed(1)}`;
    for (let i = 1; i < curvePoints.length; i++) {
      const prev = curvePoints[i - 1];
      const curr = curvePoints[i];
      const cpx  = ((prev.x + curr.x) / 2).toFixed(1);
      bezierPath += ` Q ${cpx},${prev.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
    }
  }

  const lastClose = n > 0 ? closes[n - 1] : data.current;
  const dotX      = n > 1 ? X_CURVE_R : (X_LEFT + X_CURVE_R) / 2;
  const dotY      = py(lastClose);

  // ── Y-axis labels: key prices, max 5 ─────────────────────────────────────
  const labelCandidates: number[] = [data.current];
  if (data.entry) labelCandidates.push(data.entry.price);
  if (data.sl != null) labelCandidates.push(data.sl);
  if (data.tp1 != null) labelCandidates.push(data.tp1);
  data.ob_bull?.slice(0, 2).forEach(o => labelCandidates.push(o.low, o.high));
  data.ob_bear?.slice(0, 2).forEach(o => labelCandidates.push(o.low, o.high));
  const yLabels = [...new Set(labelCandidates)]
    .sort((a, b) => b - a)
    .filter((p, i, arr) => i === 0 || arr[i - 1] - p > span * 0.04)
    .slice(0, 5);

  // ── AMD ───────────────────────────────────────────────────────────────────
  const amdStr   = (data.amd ?? "").toLowerCase();
  const amdPhase = amdStr.includes("acc") ? "acc"
    : amdStr.includes("man")  ? "man"
    : amdStr.includes("dist") ? "dist"
    : null;

  // ── Bias color ────────────────────────────────────────────────────────────
  const biasColor = data.bias === "bullish" ? "#4ADE80"
    : data.bias === "bearish" ? "#F87171"
    : "#D4AF37";

  // ── Level line helper (right half: line + badge) ──────────────────────────
  function levelLine(
    price: number,
    lstroke: string, dash: string, lw: number,
    bfill: string, bstroke: string,
    label: string, tfill: string,
  ) {
    const y = py(price);
    return (
      <g>
        <line x1={X_BADGE_L - 220} y1={y} x2={X_BADGE_L - 2} y2={y}
          stroke={lstroke} strokeWidth={lw} strokeDasharray={dash} />
        <rect x={X_BADGE_L} y={y - 8} width={BADGE_W} height={16}
          fill={bfill} stroke={bstroke} strokeWidth="0.8" rx="3" />
        <text x={X_BADGE_L + BADGE_W / 2} y={y + 4.5}
          fontSize="9.5" fill={tfill} fontFamily="monospace"
          textAnchor="middle" fontWeight="600">
          {label}
        </text>
      </g>
    );
  }

  // ── Current price label: float above dot, avoid overlap with badges ───────
  const labelAbove = dotY > 30 && (
    data.sl == null || Math.abs(py(data.sl) - dotY) > 20
  );
  const labelY = labelAbove ? dotY - 14 : dotY + 20;

  return (
    <div style={{
      margin: "16px 0",
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
      padding: "8px 8px 4px 8px",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: "6px",
      }}>
        <span style={{
          fontSize: "9px", fontFamily: "monospace", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(212,175,55,0.45)",
        }}>
          Structure Chart{data.timeframe ? ` · ${data.timeframe}` : ""}
        </span>
        {data.bias && (
          <span style={{
            fontSize: "10px", fontFamily: "monospace",
            color: biasColor, fontWeight: 600, letterSpacing: "0.08em",
          }}>
            {data.bias.toUpperCase()}
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" style={{ display: "block" }}>

        {/* ── Subtle grid at key levels ── */}
        {yLabels.map((p, i) => (
          <line key={`g${i}`}
            x1={X_LEFT} y1={py(p)} x2={X_CURVE_R} y2={py(p)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,4" />
        ))}

        {/* ── Y-axis price labels ── */}
        {yLabels.map((p, i) => (
          <text key={`yl${i}`}
            x={X_YLABEL} y={py(p) + 3.5}
            fontSize="10" fill="rgba(255,255,255,0.28)"
            fontFamily="monospace" textAnchor="end">
            {fmt(p)}
          </text>
        ))}

        {/* ── OB Bullish zones ── */}
        {data.ob_bull?.map((ob, i) => {
          const y1 = py(ob.high);
          const h  = Math.max(py(ob.low) - y1, 3);
          return (
            <g key={`obu${i}`}>
              <rect x={X_LEFT} y={y1} width={X_CURVE_R - X_LEFT} height={h}
                fill="rgba(74,222,128,0.06)" stroke="rgba(74,222,128,0.15)"
                strokeWidth="0.5" rx="1" />
              {h >= 12 && (
                <text x={X_LEFT + 6} y={y1 + 11}
                  fontSize="9" fill="rgba(74,222,128,0.5)"
                  fontFamily="monospace" style={{ textTransform: "uppercase" }}>
                  OB {ob.label}
                </text>
              )}
              {h >= 24 && (
                <text x={X_LEFT + 6} y={y1 + 22}
                  fontSize="9.5" fill="rgba(74,222,128,0.7)" fontFamily="monospace">
                  {fmt(ob.low)}–{fmt(ob.high)}
                </text>
              )}
            </g>
          );
        })}

        {/* ── OB Bearish zones ── */}
        {data.ob_bear?.map((ob, i) => {
          const y1 = py(ob.high);
          const h  = Math.max(py(ob.low) - y1, 3);
          return (
            <g key={`obd${i}`}>
              <rect x={X_LEFT} y={y1} width={X_CURVE_R - X_LEFT} height={h}
                fill="rgba(248,113,113,0.06)" stroke="rgba(248,113,113,0.15)"
                strokeWidth="0.5" rx="1" />
              {h >= 12 && (
                <text x={X_LEFT + 6} y={y1 + 11}
                  fontSize="9" fill="rgba(248,113,113,0.5)"
                  fontFamily="monospace" style={{ textTransform: "uppercase" }}>
                  OB {ob.label}
                </text>
              )}
              {h >= 24 && (
                <text x={X_LEFT + 6} y={y1 + 22}
                  fontSize="9.5" fill="rgba(248,113,113,0.7)" fontFamily="monospace">
                  {fmt(ob.low)}–{fmt(ob.high)}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Liquidity levels (very subtle) ── */}
        {data.liquidity_above?.map((l, i) => (
          <g key={`la${i}`}>
            <line x1={X_LEFT} y1={py(l.price)} x2={X_CURVE_R} y2={py(l.price)}
              stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" strokeDasharray="3,5" />
            <text x={X_CURVE_R - 5} y={py(l.price) - 3}
              fontSize="9" fill="rgba(255,255,255,0.28)"
              fontFamily="monospace" textAnchor="end">
              {l.label || "liq"}
            </text>
          </g>
        ))}
        {data.liquidity_below?.map((l, i) => (
          <g key={`lb${i}`}>
            <line x1={X_LEFT} y1={py(l.price)} x2={X_CURVE_R} y2={py(l.price)}
              stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" strokeDasharray="3,5" />
            <text x={X_CURVE_R - 5} y={py(l.price) + 12}
              fontSize="9" fill="rgba(255,255,255,0.28)"
              fontFamily="monospace" textAnchor="end">
              {l.label || "liq"}
            </text>
          </g>
        ))}

        {/* ── Price curve (smooth bezier) ── */}
        {bezierPath && (
          <path
            d={bezierPath}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}

        {/* ── Sweep annotation ── */}
        {data.sweep && (
          <text
            x={X_LEFT + 8}
            y={data.sweep.direction === "above" ? py(data.sweep.price) - 5 : py(data.sweep.price) + 14}
            fontSize="9" fill="rgba(248,113,113,0.6)" fontFamily="monospace">
            {data.sweep.direction === "above" ? "▲" : "▼"} sweep {fmt(data.sweep.price)}
          </text>
        )}

        {/* ── Trade levels (right half, line + badge) ── */}
        {data.sl != null && levelLine(
          data.sl,
          "rgba(248,113,113,0.65)", "5,3", 1,
          "rgba(248,113,113,0.1)", "rgba(248,113,113,0.35)",
          `SL  ${fmt(data.sl)}`, "#F87171",
        )}
        {data.tp2 != null && levelLine(
          data.tp2,
          "rgba(74,222,128,0.45)", "5,3", 0.9,
          "rgba(74,222,128,0.07)", "rgba(74,222,128,0.28)",
          `TP2 ${fmt(data.tp2)}`, "#4ADE80",
        )}
        {data.tp1 != null && levelLine(
          data.tp1,
          "rgba(74,222,128,0.6)", "5,3", 1,
          "rgba(74,222,128,0.1)", "rgba(74,222,128,0.35)",
          `TP1 ${fmt(data.tp1)}`, "#4ADE80",
        )}
        {data.entry && levelLine(
          data.entry.price,
          "rgba(212,175,55,0.75)", "6,4", 1.2,
          "rgba(212,175,55,0.13)", "rgba(212,175,55,0.45)",
          `ENT ${fmt(data.entry.price)}`, "#D4AF37",
        )}

        {/* ── Current price dot ── */}
        <circle cx={dotX} cy={dotY} r="4" fill="#D4AF37" />

        {/* ── Current price floating label ── */}
        <text
          x={dotX + (dotX > X_CURVE_R - 80 ? -8 : 8)}
          y={labelY}
          fontSize="11" fill="#D4AF37"
          fontFamily="monospace" fontWeight="700"
          textAnchor={dotX > X_CURVE_R - 80 ? "end" : "start"}>
          {fmt(data.current)}
        </text>

        {/* ── AMD phase badges ── */}
        {amdPhase && (() => {
          const phases = [
            { k: "acc",  lbl: "ACCUM",   ac: "#D4AF37", af: "rgba(212,175,55,0.14)",  as_: "rgba(212,175,55,0.38)"  },
            { k: "man",  lbl: "MANIP",   ac: "#F87171", af: "rgba(248,113,113,0.14)", as_: "rgba(248,113,113,0.38)" },
            { k: "dist", lbl: "DISTRIB", ac: "#4ADE80", af: "rgba(74,222,128,0.14)",  as_: "rgba(74,222,128,0.38)"  },
          ];
          return phases.map((ph, i) => {
            const active = amdPhase === ph.k;
            const bx = X_LEFT + i * 100;
            return (
              <g key={ph.k}>
                <rect x={bx} y={Y_AMD - 12} width={92} height={18}
                  fill={active ? ph.af : "rgba(255,255,255,0.02)"}
                  stroke={active ? ph.as_ : "rgba(255,255,255,0.05)"}
                  strokeWidth="0.8" rx="3" />
                <text x={bx + 46} y={Y_AMD + 0.5}
                  fontSize="8.5" fontFamily="monospace" textAnchor="middle"
                  letterSpacing="0.07em"
                  fill={active ? ph.ac : "rgba(255,255,255,0.18)"}
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
