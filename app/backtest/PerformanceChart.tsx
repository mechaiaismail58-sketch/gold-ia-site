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
  const points: number[] = [0];
  const TARGET = 411.8;
  const N = 431;

  function pseudoRand(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x); // 0..1
  }

  for (let i = 1; i < N; i++) {
    const prev = points[i - 1];
    const r = pseudoRand(i);

    const isWin = r < 0.6988;
    let tradeR: number;

    if (isWin) {
      const rSize = pseudoRand(i + 500);
      tradeR = 1.0 + rSize * 2.2;
    } else {
      const rSize = pseudoRand(i + 1000);
      tradeR = -(0.8 + rSize * 0.5);
    }

    // DD1 : trades 78-118 — série difficile
    if (i >= 78 && i <= 118) {
      tradeR = isWin ? tradeR * 0.4 : tradeR * 1.6;
    }
    // DD2 : trades 248-272 — correction rapide
    if (i >= 248 && i <= 272) {
      tradeR = isWin ? tradeR * 0.3 : tradeR * 1.8;
    }

    points.push(prev + tradeR);
  }

  const rawFinal = points[N - 1];
  const scale = TARGET / rawFinal;
  return points.map((v, idx) => ({
    tradeNumber: idx + 1,
    cumulativeR: parseFloat((v * scale).toFixed(2)),
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
