// Inline SVG — gold bar (lingot) subtle icon
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

// Divider with purple dot
function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/6" />
      <div className="h-1 w-1 rounded-full bg-[rgba(139,92,246,0.5)]" />
      <div className="h-px flex-1 bg-white/6" />
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="text-white space-y-6">

      {/* ── Hero ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />

        <div className="p-8 sm:p-12">
          <div className="flex items-center gap-3">
            <div className="text-xs tracking-[0.22em] uppercase text-[color:var(--gold)]">
              About
            </div>
            <GoldBarIcon className="h-4 w-8 text-[color:var(--gold)]" />
          </div>

          <h1 className="mt-5 text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] max-w-3xl">
            A gold trading intelligence system built by two young operators.
          </h1>

          <div className="mt-8 space-y-5 max-w-[68ch]">
            <p className="text-[color:var(--muted)] leading-7">
              Bullion Desk was created by two young finance-driven individuals and active
              gold traders, with a clear objective: build a structured system capable
              of delivering high-quality trade signals on gold.
            </p>

            <Divider />

            <p className="text-[color:var(--muted)] leading-7">
              Both founders are Yale certified students, with a strong focus on
              analytical rigor, disciplined thinking, and serious market execution.
              The project reflects a commitment to structure, not speculation.
            </p>

            <Divider />

            <p className="text-[color:var(--muted)] leading-7">
              Bullion Desk is not a generic signal feed. It is a filtered decision system.
              The model first determines whether the market is tradable, then delivers
              structured trade signals only when conditions support a real edge.
            </p>

            <Divider />

            <p className="text-[color:var(--muted)] leading-7">
              The goal is not to trade constantly, but to trade with precision.
              In many cases, the system will deliberately block execution when the
              environment is unstable, unclear, or statistically unfavorable.
            </p>
          </div>

          {/* Credential tags */}
          <div className="mt-8 flex flex-wrap gap-2">
            {["Yale Certified", "Active Gold Traders", "Institutional Framework", "Macro-Technical"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Three pillars ── */}
      <section className="grid md:grid-cols-3 gap-4">
        {[
          {
            num: "01",
            title: "Trade Signals",
            text: "Bullion Desk delivers structured gold trade signals when macro and technical conditions align.",
            accent: "text-[color:var(--gold)]",
            border: "border-[rgba(200,162,74,0.18)]",
            glow: "shadow-[0_0_40px_rgba(200,162,74,0.05)]",
          },
          {
            num: "02",
            title: "Market Filtering",
            text: "The system first evaluates if the environment is tradable before allowing any signal.",
            accent: "text-[rgba(139,92,246,0.9)]",
            border: "border-[rgba(109,40,217,0.25)]",
            glow: "shadow-[0_0_40px_rgba(109,40,217,0.08)]",
          },
          {
            num: "03",
            title: "Risk Discipline",
            text: "Every signal includes scenario logic, invalidation, and controlled execution.",
            accent: "text-white/50",
            border: "border-white/10",
            glow: "",
          },
        ].map((item) => (
          <div
            key={item.title}
            className={`card rounded-2xl border p-6 ${item.border} ${item.glow} relative overflow-hidden`}
          >
            {/* Background number watermark */}
            <div className="pointer-events-none absolute -right-2 -top-3 text-[72px] leading-none font-bold tracking-[-0.05em] text-white/[0.03] select-none">
              {item.num}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <GoldBarIcon className={`h-3.5 w-7 ${item.accent}`} />
              <div className={`text-[10px] tracking-[0.18em] uppercase ${item.accent}`}>
                {item.num}
              </div>
            </div>

            <div className="text-[15px] tracking-[-0.01em] text-white mb-3">
              {item.title}
            </div>

            <p className="text-[color:var(--muted)] leading-6 text-[13px]">
              {item.text}
            </p>
          </div>
        ))}
      </section>

      {/* ── Core numbers ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.4)] to-transparent" />

        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
          {[
            { value: "XAUUSD", label: "Exclusive focus", sub: "Spot gold only" },
            { value: "40 / 40 / 20", label: "Scoring model", sub: "Macro · Technical · Sentiment" },
            { value: "≥ 60", label: "Minimum score", sub: "Required for full permission" },
          ].map((stat) => (
            <div key={stat.label} className="px-8 py-7">
              <div className="text-[22px] tracking-[-0.02em] text-[color:var(--gold)]">
                {stat.value}
              </div>
              <div className="mt-1 text-[13px] text-white/80">{stat.label}</div>
              <div className="mt-0.5 text-[11px] text-white/30 tracking-[0.06em]">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden relative">
        {/* Purple left accent */}
        <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-[rgba(139,92,246,0.6)] to-transparent" />

        <div className="px-10 py-10 sm:py-12">
          <div className="mb-5 flex items-center gap-2">
            <div className="h-px w-6 bg-[rgba(139,92,246,0.5)]" />
            <GoldBarIcon className="h-3 w-6 text-[color:var(--gold)]" />
            <div className="h-px w-6 bg-[rgba(139,92,246,0.5)]" />
          </div>

          <blockquote className="text-[22px] sm:text-[28px] leading-[1.3] tracking-[-0.02em] max-w-3xl">
            Bullion Desk provides gold trade signals — but only when the market{" "}
            <span className="text-[color:var(--gold)]">deserves</span> to be traded.
          </blockquote>

          <div className="mt-6 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-[rgba(139,92,246,0.6)]" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/30">
              Bullion Desk — Core Principle
            </span>
          </div>
        </div>
      </section>

    </main>
  );
}
