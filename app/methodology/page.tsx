const FRAMEWORK_CARDS = [
  {
    title: "Market Structure",
    desc: "Higher timeframe bias, key levels, orderblocks, and Fair Value Gaps. Every analysis starts with structure — mid-range entries don't exist here.",
  },
  {
    title: "Macro Analysis",
    desc: "DXY, real yields, Fed policy, ETF flows, and intermarket correlations. Macro sets the context; structure provides the precision.",
  },
  {
    title: "Risk Management",
    desc: "Structural position sizing, R-multiple tracking, and drawdown limits enforced automatically. Risk is always proportional, never emotional.",
  },
  {
    title: "Psychology & Discipline",
    desc: "Bias detection, overtrading alerts, and consistency scoring built into every response. The AI says wait more often than it validates conditions.",
  },
];

const DIFFERENTIATORS = [
  {
    value: "22+",
    label: "Data Sources",
    desc: "Price, macro, COT, ETF flows, order flow, news — all processed on every request.",
  },
  {
    value: "No Signals",
    label: "Just Clarity",
    desc: "No entry prices, no stop targets. Analysis and education only — the discipline stays with you.",
  },
  {
    value: "Prop Firm",
    label: "Ready",
    desc: "FTMO, E8, Apex, The5ers — DD rules, phase guidance, and consistency logic built in.",
  },
];

export default function MethodologyPage() {
  return (
    <main className="text-white space-y-5">

      {/* ── Hero ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.45)] to-transparent" />
        <div className="p-8 sm:p-12">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--gold)] mb-5">
            Methodology
          </p>
          <h1 className="text-[32px] sm:text-[48px] leading-[1.06] tracking-[-0.03em] font-normal mb-4">
            Our Methodology
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[color:var(--muted)] tracking-[-0.01em]">
            How BullionDesk analyzes gold.
          </p>
        </div>
      </section>

      {/* ── The Framework — 2×2 grid ── */}
      <section>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30 mb-4 px-1">
          The Framework
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FRAMEWORK_CARDS.map((card) => (
            <div key={card.title} className="card rounded-2xl border border-white/10 overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.4)] to-transparent" />
              <div className="p-6">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[color:var(--gold)] mb-2">
                  {card.title}
                </p>
                <p className="text-[13px] text-[color:var(--muted)] leading-[1.7]">
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What Makes Us Different — 3 columns ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DIFFERENTIATORS.map((d) => (
          <div key={d.label} className="card rounded-2xl border border-white/10 overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.3)] to-transparent" />
            <div className="p-6">
              <p className="text-[28px] font-light tracking-[-0.02em] text-[color:var(--gold)] leading-none mb-1">
                {d.value}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/50 mb-3">
                {d.label}
              </p>
              <p className="text-[12px] text-[color:var(--muted)] leading-[1.65]">
                {d.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.4)] to-transparent" />
        <div className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] sm:text-[28px] leading-[1.15] tracking-[-0.02em] font-normal mb-1.5">
              See it in action.
            </h2>
            <p className="text-[13px] text-[color:var(--muted)]">
              3 free messages. No signup required.
            </p>
          </div>
          <a
            href="/#demo"
            className="shrink-0 rounded-xl px-6 py-3 text-[12px] tracking-[0.10em] uppercase font-medium border border-[rgba(212,175,55,0.55)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.95)] hover:bg-[rgba(212,175,55,0.08)] whitespace-nowrap"
          >
            See it in action →
          </a>
        </div>
      </section>

    </main>
  );
}
