"use client";

import { motion } from "framer-motion";
import GoldTradingViewChart from "@/components/GoldTradingViewChart";

export const dynamic = "force-dynamic";

export default function ChatMarketPage() {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#0A0A0A]">
      {/* ── Header ── */}
      <div className="flex-none flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.06]">
        <h1 className="text-sm font-semibold uppercase text-white" style={{ letterSpacing: "0.1em" }}>
          XAUUSD — Live Market
        </h1>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[#D4A843]">
          <span className="h-2 w-2 rounded-full pulse-dot-gold inline-block shrink-0" />
          Live
        </div>
      </div>

      {/* ── Chart ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 p-4 md:p-6"
      >
        <div
          className="h-full overflow-hidden"
          style={{ borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <GoldTradingViewChart theme="light" />
        </div>
      </motion.div>
    </div>
  );
}
