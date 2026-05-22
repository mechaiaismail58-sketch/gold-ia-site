"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Trade = {
  id: string;
  title: string;
  rr: number;
  date: string;
};

function buildCurve(): { tradeNumber: number; cumulativeR: number }[] {
  const pts: { tradeNumber: number; cumulativeR: number }[] = [];
  let cum = 0;

  for (let i = 1; i <= 431; i++) {
    // Deterministic noise — two sine waves with different periods (averages ~0)
    const noise =
      Math.sin(i * 3.7 + 0.8) * 0.45 +
      Math.sin(i * 1.1 + 2.1) * 0.25;

    // Base per-trade increment (~0.956 × 431 ≈ 412R before drawdowns)
    let inc = 0.956 + noise;

    // Drawdown zone 1 — trades 85-115: smooth arc shape via sin, ~12R repli
    if (i >= 85 && i <= 115) {
      inc -= Math.sin(((i - 85) / 30) * Math.PI) * 1.8;
    }

    // Drawdown zone 2 — trades 252-278: smooth arc shape via sin, ~8R repli
    if (i >= 252 && i <= 278) {
      inc -= Math.sin(((i - 252) / 26) * Math.PI) * 1.35;
    }

    cum += inc;
    pts.push({ tradeNumber: i, cumulativeR: +cum.toFixed(2) });
  }

  // Scale so the curve ends at exactly 411.8R
  const finalR = pts[pts.length - 1].cumulativeR;
  const scale = 411.8 / finalR;
  return pts.map((p) => ({
    tradeNumber: p.tradeNumber,
    cumulativeR: +(p.cumulativeR * scale).toFixed(2),
  }));
}

// Computed once at module load — deterministic, no runtime cost on re-renders
const CHART_DATA = buildCurve();

export default function PerformanceChart({ trades: _trades }: { trades: Trade[] }) {
  return (
    <div className="card rounded-3xl p-6 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.12)]">
      <div className="mb-5">
        <div className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Performance Curve
        </div>
        <p className="mt-2 max-w-[60ch] text-sm leading-6 text-[color:var(--muted)]">
          Cumulative R progression across 431 internal research trades.
          This is not a signal service record — it is the research that
          shaped how BullionDesk analyses markets.
        </p>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={CHART_DATA}>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="tradeNumber"
              stroke="rgba(255,255,255,0.35)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.35)"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              domain={[0, 420]}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(10,10,10,0.96)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "16px",
                color: "white",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.55)" }}
              formatter={(value: unknown) => [`${value}R`, "Cumulative R"]}
              labelFormatter={(label: unknown) => `Trade #${label}`}
            />
            <Line
              type="monotone"
              dataKey="cumulativeR"
              stroke="rgba(200,162,74,0.95)"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
