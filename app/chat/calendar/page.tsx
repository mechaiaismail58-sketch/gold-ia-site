"use client";

export default function ChatCalendarPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Header */}
      <header className="flex-none bg-white/[0.02] border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
                <span className="text-sm font-semibold text-white">BullionDesk</span>
              </div>
              <span className="text-[10px] text-[#71717A] uppercase tracking-wider pl-4">
                AI Gold Trading Coach · XAUUSD
              </span>
            </div>
            <div className="chat-anchor-pulse bg-[#D4A843]/[0.08] border border-[#D4A843]/20 rounded-xl px-4 py-2.5 flex-1 max-w-md">
              <p className="text-sm text-[#D4A843] font-medium text-center leading-snug">
                <span className="lightning-pulse">⚡</span> Don&apos;t take any trade before checking with the AI.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[9px] uppercase bg-[#D4A843]/20 text-[#D4A843] px-2 py-0.5 rounded-full font-medium tracking-wide shadow-[0_0_12px_rgba(212,168,67,0.15)]">
                Beta
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="h-px bg-gradient-to-r from-transparent via-[#D4A843]/30 to-transparent flex-none" />

      {/* Coming soon */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-5 flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D4A843]/[0.08] border border-[#D4A843]/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#D4A843]">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 3v3M17 3v3M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <p className="text-lg text-white/50">Coming soon — Economic calendar for gold traders</p>
          <p className="text-sm text-[#52525B] mt-2">CPI, NFP, FOMC, PCE — all events that move XAUUSD.</p>
        </div>
      </div>
    </div>
  );
}
