"use client";

const CARDS = [
  {
    title: "RECURRING",
    desc:  "Commission on every paid signup you bring.",
  },
  {
    title: "TRACKED",
    desc:  "Custom dashboard with real-time conversion data.",
  },
  {
    title: "CURATED",
    desc:  "Selective program. Not everyone is accepted.",
  },
];

const PROCESS = [
  { n: "1", title: "Apply",   desc: "Submit your profile for review." },
  { n: "2", title: "Review",  desc: "We evaluate audience quality, content alignment, and fit." },
  { n: "3", title: "Onboard", desc: "If accepted, you receive your tracking link and terms." },
];

const CRITERIA = [
  "Gold, XAUUSD, or forex creators with a genuinely engaged audience",
  "Consistent, high-quality content (no signal spam, no pump accounts)",
  "Clear trading framework — structure-based, institutional, or SMC preferred",
  "Minimum 5,000 engaged followers on X, Instagram, YouTube, or Telegram",
  "Willingness to integrate Bullion Desk authentically into your content",
];

const BENEFITS = [
  "Competitive recurring commission structure",
  "Access to Bullion Desk to review and test the platform",
  "Dedicated tracking dashboard",
  "Priority support during the partnership",
];

const NOT_FIT = [
  "Accounts focused on signal-selling or pump-and-dump content",
  "Creators with primarily bought or inactive followers",
  "Anyone looking for guaranteed payouts or upfront fees",
  "Those unwilling to actually use the product before promoting it",
];

const MAILTO =
  "mailto:partners@bulliondesk.pro?subject=Partner%20Program%20Application&body=Name%3A%0AMain%20platform%20(X%20%2F%20IG%20%2F%20YouTube%20%2F%20Telegram)%3A%0AHandle%3A%0AFollower%20count%3A%0ALink%20to%20your%20best%20piece%20of%20content%3A%0AWhy%20you%27d%20be%20a%20good%20fit%20for%20Bullion%20Desk%3A";

export default function PartnersPage() {
  return (
    <div className="bg-[#07060b] text-white flex flex-col items-center px-4 pt-16 pb-8 animate-fade-in">

      {/* Background blobs — same as home */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
        <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
      </div>

      <div className="w-full max-w-lg">

        {/* ── Logo ── */}
        <div className="text-center mb-12">
          <p className="text-[17px] tracking-[0.22em] uppercase text-white font-light">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </p>
          <p className="mt-2 text-[10px] tracking-[0.18em] uppercase text-[color:var(--muted)]">
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge ── */}
        <div className="text-center mb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] border-opacity-30 bg-[rgba(212,175,55,0.06)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse shrink-0" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[color:var(--gold)]">
              Partner Program
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] font-normal mb-5">
            Partner Program{" "}
            <span className="text-[color:var(--gold)] italic">For a select few.</span>
          </h1>
          <p className="text-[16px] text-[color:var(--muted)] leading-[1.7] max-w-[46ch] mx-auto">
            A closed program for trading creators who can move their audience. Apply to be considered.
          </p>
        </div>

        {/* ── 3 cards — same style as home feature cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {CARDS.map((c) => (
            <div key={c.title} className="card rounded-2xl border border-white/10 overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.35)] to-transparent" />
              <div className="p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--gold)] mb-2">
                  {c.title}
                </p>
                <p className="text-xs text-[color:var(--muted)] leading-[1.65]">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── The Process ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-5">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />
          <div className="p-6 sm:p-8">
            <h2 className="text-[18px] tracking-[-0.02em] mb-6">The Process</h2>
            <div className="space-y-5">
              {PROCESS.map((step) => (
                <div key={step.n} className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-[13px] font-mono text-[color:var(--gold)]">{step.n}</span>
                  <div>
                    <div className="text-[14px] text-white/90 mb-0.5">{step.title}</div>
                    <div className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── We're Selective ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-5">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.3)] to-transparent" />
          <div className="p-6 sm:p-8">
            <h2 className="text-[18px] tracking-[-0.02em] mb-1">We&apos;re selective.</h2>
            <p className="text-[13px] text-[color:var(--muted)] mb-5 leading-[1.6]">
              This program isn&apos;t open to everyone. We work with creators who meet these criteria:
            </p>
            <ul className="space-y-2.5 mb-8">
              {CRITERIA.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--gold)]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{c}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-[15px] text-white/80 mb-3">What accepted partners receive</h3>
            <ul className="space-y-2.5 mb-8">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--gold)]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{b}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-[15px] text-white/80 mb-3">This program is not for:</h3>
            <ul className="space-y-2.5">
              {NOT_FIT.map((n, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#ef4444]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="text-center mb-8">
          <a
            href={MAILTO}
            className="inline-block rounded-xl border border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.08)] px-8 py-3.5 text-[13px] font-medium tracking-[0.05em] text-[color:var(--gold)] hover:bg-[rgba(212,175,55,0.16)] hover:border-[rgba(212,175,55,0.85)] transition"
          >
            Apply Now
          </a>
          <p className="mt-3 text-[12px] text-white/25">
            Applications reviewed weekly.
          </p>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/25">
          Bullion Desk © 2026 · Institutional Gold Intelligence
        </p>

      </div>
    </div>
  );
}
