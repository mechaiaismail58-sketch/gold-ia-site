"use client";

export const dynamic = "force-dynamic";

export default function ChatMarketPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
      {/* Header */}
      <header className="flex-none bg-white/[0.02] border-b border-white/[0.06] chat-header-enter">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">
            <div className="flex flex-col gap-0.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
                <span className="text-sm font-semibold text-white">BullionDesk</span>
              </div>
              <span className="text-xs text-[#71717A] uppercase tracking-[0.15em] font-medium pl-4">
                AI Gold Trading Coach · XAUUSD
              </span>
            </div>
            <div className="chat-anchor-pulse chat-banner-glow bg-[#D4A843]/[0.08] border border-[#D4A843]/20 rounded-xl px-4 py-2.5 flex-1 max-w-md">
              <p className="text-sm text-[#D4A843] font-medium text-center leading-snug">
                Don&apos;t take any trade before checking with the AI.
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

      {/* TradingView Chart — full height */}
      <div className="flex-1">
        <iframe
          src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_xauusd&symbol=OANDA%3AXAUUSD&interval=60&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=0&saveimage=1&toolbarbg=0A0A0A&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&locale=en"
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title="XAUUSD Live Chart"
          allowFullScreen
        />
      </div>
    </div>
  );
}
