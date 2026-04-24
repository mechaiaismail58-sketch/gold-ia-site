function GoldBarIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="4" y="6" width="40" height="14" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="4" y="6" width="40" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <rect x="8" y="10" width="32" height="6" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <line x1="4" y1="6" x2="8" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="44" y1="6" x2="40" y2="2" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="8" y1="2" x2="40" y2="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <main className="text-white space-y-6">

      {/* ── Hero ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.4)] to-transparent" />
        <div className="p-8 sm:p-12">
          <div className="flex items-center gap-3">
            <div className="text-xs tracking-[0.22em] uppercase text-[color:var(--gold)]">
              About
            </div>
            <GoldBarIcon className="h-4 w-8 text-[color:var(--gold)]" />
          </div>

          <h1 className="mt-5 text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] max-w-3xl">
            About Bullion Desk
          </h1>

          <p className="mt-4 text-[15px] text-[color:var(--gold)] tracking-[-0.01em]">
            Built by traders, for traders.
          </p>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="card rounded-3xl border border-white/10 p-8 sm:p-12">
        <div className="space-y-7 max-w-[72ch]">
          <p className="text-[color:var(--muted)] leading-7 text-[15px]">
            Two traders passionate about gold met through their shared journey — countless hours
            spent analyzing XAUUSD, learning from losses, searching for the perfect framework.
            Like most retail traders, they started with too many indicators, too much noise, and
            not enough discipline. They lost before they won.
          </p>

          <div className="h-px bg-white/8" />

          <p className="text-[color:var(--muted)] leading-7 text-[15px]">
            What transformed their approach was the discovery of institutional analysis — ICT,
            Wyckoff, order flow, macro reading. They realized the best traders in the world
            don&apos;t watch RSI — they watch structure, positioning, and flow. But accessing that
            level of analysis demanded hours of work every day, dozens of sources to monitor, and
            a discipline that few retail traders can maintain on their own.
          </p>

          <div className="h-px bg-white/8" />

          <p className="text-[color:var(--muted)] leading-7 text-[15px]">
            BullionDesk was born from that frustration. The idea: build an intelligence engine
            that does this work automatically — one that reads 22+ data sources, applies
            institutional frameworks, and delivers clear analysis with iron discipline. Not a
            Telegram signal. Not another indicator. A real trading partner that thinks before it
            speaks, and says no when there is no trade.
          </p>

          <div className="h-px bg-white/8" />

          <p className="text-[color:var(--muted)] leading-7 text-[15px]">
            Today, BullionDesk is in beta. The product improves every day thanks to feedback
            from early users. The goal remains the same: make institutional gold analysis
            accessible to every trader willing to trade with discipline.
          </p>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-[rgba(212,175,55,0.5)] to-transparent" />

        <div className="px-10 py-10 sm:py-12">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-px w-6 bg-[rgba(212,175,55,0.4)]" />
            <GoldBarIcon className="h-3 w-6 text-[color:var(--gold)]" />
            <div className="h-px w-6 bg-[rgba(212,175,55,0.4)]" />
          </div>

          <blockquote className="text-[22px] sm:text-[28px] leading-[1.3] tracking-[-0.02em] max-w-3xl">
            BullionDesk provides gold analysis — but only when the market{" "}
            <span className="text-[color:var(--gold)]">deserves</span> to be traded.
          </blockquote>

          <div className="mt-6 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[rgba(212,175,55,0.5)]" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">
              Bullion Desk — Core Principle
            </span>
          </div>
        </div>
      </section>

    </main>
  );
}
