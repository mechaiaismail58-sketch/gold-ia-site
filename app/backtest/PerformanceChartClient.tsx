"use client";

import dynamic from "next/dynamic";

type Trade = { id: string; title: string; rr: number; date: string };

const PerformanceChart = dynamic(() => import("./PerformanceChart"), {
  ssr: false,
  loading: () => (
    <div className="card rounded-3xl p-6 border border-white/10 h-[420px] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[rgba(200,162,74,0.95)] animate-spin" />
    </div>
  ),
});

export default function PerformanceChartClient({ trades }: { trades: Trade[] }) {
  return <PerformanceChart trades={trades} />;
}
