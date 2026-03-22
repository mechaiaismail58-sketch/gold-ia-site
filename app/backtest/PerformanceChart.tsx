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

export default function PerformanceChart({ trades }: { trades: Trade[] }) {
  const orderedTrades = [...trades].reverse();

  let runningTotal = 0;

  const chartData = orderedTrades.map((trade, index) => {
    runningTotal += Number(trade.rr || 0);

    return {
      tradeNumber: index + 1,
      date: trade.date,
      title: trade.title,
      cumulativeR: Number(runningTotal.toFixed(2)),
    };
  });

  return (
    <div className="card rounded-3xl p-6 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.12)]">
      <div className="mb-5">
        <div className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Performance Curve
        </div>
        <p className="mt-2 max-w-[60ch] text-sm leading-6 text-[color:var(--muted)]">
          Cumulative R progression across recorded Bullion Desk trades.
        </p>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
            />
            <Tooltip
              contentStyle={{
                background: "rgba(10,10,10,0.96)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "16px",
                color: "white",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.55)" }}
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