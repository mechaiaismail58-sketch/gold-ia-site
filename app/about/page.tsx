function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" stroke="rgba(212,175,55,0.35)" />
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
      <circle cx="7" cy="7" r="6.5" stroke="rgba(239,68,68,0.3)" />
      <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const STORY_BLOCKS = [
  {
    tag: "The Problem",
    text: "Two traders. Countless hours analyzing XAUUSD. Too many indicators, too much noise, not enough discipline. Like most retail traders, they lost before they won — chasing signals, ignoring structure, letting emotion drive decisions.",
  },
  {
    tag: "The Discovery",
    text: "What changed everything was institutional analysis — ICT, Wyckoff, order flow, macro reading. The best traders in the world don't watch RSI. They watch structure, positioning, and flow. But accessing that level of analysis demanded hours of work every day and a discipline few retail traders can maintain alone.",
  },
  {
    tag: "The Solution",
    text: "BullionDesk was built to do that work automatically. An intelligence engine that reads 22+ data sources, applies institutional frameworks, and delivers clear analysis with iron discipline. Not a signal service. Not another indicator. A real trading coach that says no when conditions don't warrant a trade.",
  },
];

const IS_LIST = [
  "AI Trading Coach specialized in XAUUSD",
  "Institutional-grade structure & macro analysis",
  "Structure + Macro + Risk — all in one place",
  "Prop firm guidance for FTMO, E8, Apex & more",
];

const IS_NOT_LIST = [
  "A signal provider with entry/exit prices",
  "Copy trading or trade mirroring",
  "A get-rich-quick scheme",
  "A Telegram group or community",
];

export default function AboutPage() {
  return (
    <main className="text-white space-y-5">

      {/* ── Section 1 — Hero ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.45)] to-transparent" />
        <div className="p-8 sm:p-12">
          <p className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--gold)] mb-5">
            About
          </p>
          <h1 className="text-[32px] sm:text-[48px] leading-[1.06] tracking-[-0.03em] font-normal mb-4">
            About BullionDesk
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[color:var(--muted)] tracking-[-0.01em]">
            Built by traders, for traders.
          </p>
        </div>
      </section>

      {/* ── Section 2 — The Story ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STORY_BLOCKS.map((block) => (
          <div key={block.tag} className="card rounded-2xl border border-white/10 overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.4)] to-transparent" />
            <div className="p-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--gold)] mb-3">
                {block.tag}
              </p>
              <p className="text-[13px] text-[color:var(--muted)] leading-[1.7]">
                {block.text}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Section 3 — What We Are / What We're Not ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Left — IS */}
        <div className="card rounded-2xl border border-white/10 overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.4)] to-transparent" />
          <div className="p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--gold)] mb-4">
              What BullionDesk IS
            </p>
            <ul className="space-y-3">
              {IS_LIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/80">
                  <span className="text-[color:var(--gold)]"><CheckIcon /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right — IS NOT */}
        <div className="card rounded-2xl border border-white/10 overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(239,68,68,0.25)] to-transparent" />
          <div className="p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-red-400/60 mb-4">
              What BullionDesk is NOT
            </p>
            <ul className="space-y-3">
              {IS_NOT_LIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/50">
                  <span className="text-red-400/70"><CrossIcon /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 4 — CTA ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.4)] to-transparent" />
        <div className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-[22px] sm:text-[28px] leading-[1.15] tracking-[-0.02em] font-normal mb-1.5">
              Ready to trade with clarity?
            </h2>
            <p className="text-[13px] text-[color:var(--muted)]">
              3 free messages. No signup required.
            </p>
          </div>
          <a
            href="/#demo"
            className="shrink-0 rounded-xl px-6 py-3 text-[12px] tracking-[0.10em] uppercase font-medium border border-[rgba(212,175,55,0.55)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.95)] hover:bg-[rgba(212,175,55,0.08)] whitespace-nowrap"
          >
            Try it free →
          </a>
        </div>
      </section>

    </main>
  );
}
