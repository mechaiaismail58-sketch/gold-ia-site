export default function MethodologyPage() {
  return (
    <main className="text-white space-y-6">

      {/* ── Hero ── */}
      <section className="card rounded-3xl p-8 sm:p-12 border border-white/10">
        <div className="max-w-3xl">
          <div className="text-xs tracking-[0.22em] uppercase text-[color:var(--gold)]">
            Methodology
          </div>

          <h1 className="mt-5 text-[32px] sm:text-[46px] leading-[1.08] tracking-[-0.03em]">
            A filtered trade signal framework for gold markets.
          </h1>

          <p className="mt-6 text-[color:var(--muted)] leading-7 max-w-[68ch]">
            Bullion Desk is designed to generate structured gold trade signals.
            The system does not produce signals blindly — it first evaluates
            whether the market is tradable, then builds a directional view and
            execution logic only when conditions justify action.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Structure First", "Permission Required", "Score-Filtered", "Macro + Technical"].map((tag) => (
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

      {/* ── Analytical Layers ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-1">
          Step 01
        </div>
        <h2 className="text-[22px] tracking-[-0.02em]">Analytical Layers</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          Each signal is built from three analytical pillars. Macro defines the
          dominant driver, technical defines structure and timing, and sentiment
          captures positioning and extremes.
        </p>

        <div className="mt-7 grid md:grid-cols-3 gap-4">
          {[
            {
              weight: "40",
              label: "Macro",
              items: ["DXY / Real Yields", "Fed policy expectations", "Inflation repricing", "Event risk"],
            },
            {
              weight: "40",
              label: "Technical",
              items: ["H1 trend structure", "M30 regime", "Volatility state", "Liquidity zones"],
            },
            {
              weight: "20",
              label: "Sentiment",
              items: ["Session context", "Momentum bias", "Positioning extremes", "Behavioral risk"],
            },
          ].map((pillar) => (
            <div key={pillar.label} className="card rounded-2xl border border-white/10 p-6">
              <div className="flex items-end gap-2">
                <span className="text-[36px] leading-none font-light tracking-[-0.04em] text-[color:var(--gold)]">
                  {pillar.weight}
                </span>
                <span className="mb-1 text-xs text-[color:var(--muted)] uppercase tracking-widest">
                  / 100
                </span>
              </div>
              <div className="mt-2 text-[15px] tracking-[-0.01em]">{pillar.label}</div>
              <ul className="mt-4 space-y-1.5">
                {pillar.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13px] text-[color:var(--muted)]">
                    <span className="h-px w-3 bg-white/20 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scoring System ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-1">
          Step 02
        </div>
        <h2 className="text-[22px] tracking-[-0.02em]">Scoring System</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          Signals are quantified using a weighted model. Only setups with
          sufficient alignment and score are considered valid.
        </p>

        <div className="mt-7 space-y-3">
          {[
            { label: "Macro", value: 40, color: "bg-[color:var(--gold)]" },
            { label: "Technical", value: 40, color: "bg-[rgba(139,92,246,0.85)]" },
            { label: "Sentiment", value: 20, color: "bg-white/30" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-4">
              <div className="w-24 shrink-0 text-[13px] text-[color:var(--muted)] uppercase tracking-widest">
                {row.label}
              </div>
              <div className="flex-1 h-[6px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${row.value}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-[13px] text-[color:var(--muted)]">
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { range: "≥ 60", label: "Full permission", color: "border-emerald-500/30 text-emerald-400" },
            { range: "52 – 59", label: "Reduced permission", color: "border-[rgba(109,40,217,0.4)] text-[rgba(139,92,246,0.9)]" },
            { range: "< 52", label: "Stand Aside", color: "border-white/10 text-white/40" },
          ].map((tier) => (
            <div key={tier.range} className={`rounded-xl border p-4 ${tier.color}`}>
              <div className="text-[18px] tracking-[-0.02em]">{tier.range}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.10em] opacity-80">{tier.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Model Status Board ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-1">
          Step 03
        </div>
        <h2 className="text-[22px] tracking-[-0.02em]">Model Status Board</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          This is the signal filter. Before any trade is produced, the system
          determines whether execution is allowed. If edge is weak, no signal is
          generated.
        </p>

        <div className="mt-7 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Environment",     desc: "Market tradability classification" },
            { label: "Decision",        desc: "Core directional bias output" },
            { label: "Regime",          desc: "H1 / M30 structure reading" },
            { label: "Edge",            desc: "Setup quality — High, Degraded, None" },
            { label: "Grade",           desc: "Signal tier — A+, B, or Non-tradable" },
            { label: "Score",           desc: "Composite weighted score out of 100" },
            { label: "Liquidity Risk",  desc: "Exposure to active sweep zones" },
            { label: "Event Risk",      desc: "Scheduled macro catalyst exposure" },
            { label: "Behavioral Risk", desc: "Positioning and sentiment flags" },
            { label: "Permission",      desc: "Final execution gate — YES or NO" },
          ].map((item) => (
            <div key={item.label} className="card rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgba(139,92,246,0.7)] shrink-0" />
                <div className="text-[11px] tracking-widest text-white/70 uppercase">
                  {item.label}
                </div>
              </div>
              <div className="mt-2 text-[12px] text-[color:var(--muted)] leading-5">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Executive Snapshot ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-1">
          Step 04
        </div>
        <h2 className="text-[22px] tracking-[-0.02em]">Executive Snapshot</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          Once tradability is validated, the system produces a structured trade
          signal including bias, driver, and execution quality.
        </p>

        <div className="mt-7 grid sm:grid-cols-2 gap-3">
          {[
            { label: "Bias",             desc: "Directional conviction — Long, Short, or Neutral" },
            { label: "Dominant Driver",  desc: "Primary macro or technical force behind the signal" },
            { label: "Confidence",       desc: "Probability estimate of setup success" },
            { label: "Actionability",    desc: "Execution readiness — Live, Conditional, or Blocked" },
          ].map((item) => (
            <div key={item.label} className="card rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shrink-0" />
                <div className="text-[11px] tracking-widest text-white/70 uppercase">
                  {item.label}
                </div>
              </div>
              <div className="mt-2 text-[12px] text-[color:var(--muted)] leading-5">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Edge Control ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-1">
          Step 05
        </div>
        <h2 className="text-[22px] tracking-[-0.02em]">Edge Control</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          The system is designed to generate signals, but also to block them.
          When the environment is unstable, Bullion Desk explicitly prevents execution.
        </p>

        <div className="mt-7 grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">
              Permission = YES
            </div>
            <div className="mt-3 text-[13px] text-[color:var(--muted)] leading-6">
              Score ≥ 60, structure exploitable, macro aligned, asymmetry positive.
              Trade plan is produced with entry, invalidation, and targets.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Permission = NO
            </div>
            <div className="mt-3 text-[13px] text-[color:var(--muted)] leading-6">
              Score &lt; 52, structure unstable, or asymmetry negative.
              No signal is generated. Stand Aside is the output.
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
