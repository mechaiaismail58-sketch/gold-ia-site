"use client";

import { motion } from "framer-motion";

const NEWS_CARDS = [
  "Fed signals rate hold — Gold surges past key resistance",
  "CFTC COT: Institutional longs increase 12% this week",
  "DXY weakness continues — bullish setup for XAUUSD forming",
];

export default function ChatNewsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#0A0A0A] overflow-y-auto">
      <div className="w-full max-w-2xl text-center">
        <h1
          className="text-white font-light mb-4"
          style={{ fontSize: "clamp(48px, 8vw, 72px)", fontWeight: 300, lineHeight: 1.1 }}
        >
          Market Intelligence
        </h1>
        <p className="text-sm sm:text-base text-[#A1A1AA] mb-12">
          Real-time gold news, COT data, and institutional sentiment — launching soon.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {NEWS_CARDS.map((headline, i) => (
            <div key={headline} className="relative rounded-2xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, filter: "blur(8px)" }}
                animate={{ opacity: 0.5, filter: "blur(2px)" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                className="rounded-2xl p-6 h-full text-left"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm text-white/80">{headline}</p>
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.1em] font-medium text-[#D4A843]"
                  style={{
                    background: "rgba(212,168,67,0.15)",
                    border: "1px solid #D4A843",
                  }}
                >
                  Coming Soon
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4A843] px-5 py-2.5 text-sm font-medium text-[#D4A843] hover:bg-[#D4A843]/[0.08] hover:shadow-[0_0_20px_rgba(212,168,67,0.2)] transition"
        >
          Notify me when News launches →
        </button>
      </div>
    </div>
  );
}
