const DATA_CATEGORIES = [
  {
    title: "Price & Structure",
    items: [
      { text: "Twelve Data — H1, H4, D1 OHLCV bars for all covered assets (XAUUSD, Forex pairs, Indices, Futures, Energy)", badge: "LIVE" },
      { text: "Calculated indicators — RSI, MACD, EMA, ADX, Bollinger, Stochastic, CCI, ATR, VWAP", badge: "LIVE" },
      { text: "Orderblocks, Fair Value Gaps, BOS/CHOCH detection — computed locally", badge: "LIVE" },
    ],
  },
  {
    title: "Macro & Rates",
    items: [
      { text: "FRED — US 10Y yield, Real yield, 2Y, Breakevens, SOFR, TGA balance, Fed Funds rate", badge: "DAILY" },
      { text: "DXY momentum — Twelve Data", badge: "LIVE" },
      { text: "EUR/USD, JPY — currency pair momentum", badge: "LIVE" },
    ],
  },
  {
    title: "Institutional Positioning",
    items: [
      { text: "CFTC COT — Swap Dealers, Managed Money, Small Speculators, Open Interest", badge: "WEEKLY" },
      { text: "ETF Flows — GLD and IAU via Yahoo Finance", badge: "DAILY" },
      { text: "Central Bank reserves", badge: "DAILY" },
    ],
  },
  {
    title: "Order Flow",
    items: [
      { text: "Polygon.io tick-level data (when available)", badge: "LIVE" },
      { text: "Local CVD and delta calculation from OHLCV", badge: "LIVE" },
    ],
  },
  {
    title: "Intermarket",
    items: [
      { text: "VIX, MOVE index, SPX, Copper/Gold ratio, WTI Oil — Yahoo Finance", badge: "LIVE" },
      { text: "GLD options implied volatility", badge: "DAILY" },
      { text: "VIX term structure (contango/backwardation)", badge: "DAILY" },
    ],
  },
  {
    title: "News & Events",
    items: [
      { text: "Live news feeds — RSS from Yahoo Finance, ForexLive, FXStreet", badge: "LIVE" },
      { text: "Economic calendar — high-impact events with UTC times", badge: "LIVE" },
      { text: "Geopolitical monitoring", badge: "LIVE" },
    ],
  },
];

const BADGE_STYLES: Record<string, string> = {
  LIVE:   "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  DAILY:  "bg-[rgba(212,175,55,0.12)] text-[color:var(--gold)] border border-[rgba(212,175,55,0.25)]",
  WEEKLY: "bg-white/[0.05] text-white/40 border border-white/10",
};

const FRAMEWORKS = [
  {
    name: "ICT / Smart Money Concepts",
    desc: "Orderblocks, Fair Value Gaps, Liquidity Sweeps, BOS/CHOCH, Market Structure Shift, Premium/Discount zones, Precision context levels",
  },
  {
    name: "Wyckoff Method",
    desc: "Accumulation/Distribution phases, Spring/Upthrust events, Composite Man behavior, Effort vs Result analysis",
  },
  {
    name: "Candle Range Theory (CRT)",
    desc: "Previous candle body as value area, wick zones as liquidity already grabbed, multi-timeframe application",
  },
  {
    name: "Quarterly Theory",
    desc: "Q1–Q4 cycle on yearly, monthly, weekly, daily scales. Tuesday judas swing, Wednesday distribution day",
  },
  {
    name: "Power of 3 (AMD)",
    desc: "Session-level Accumulation → Manipulation → Distribution cycle",
  },
  {
    name: "Fibonacci",
    desc: "0.382, 0.5, 0.618, 0.786 retracements as confirmation levels in confluence with OBs and FVGs",
  },
  {
    name: "Narrative Analysis (MSNR)",
    desc: "Detecting when market consensus is exhausted, when institutional flow contradicts price action",
  },
];

const STEPS = [
  { n: "01", label: "Regime Detection",         desc: "Trending, Ranging, Breakout, or Transition" },
  { n: "02", label: "Macro Classification",      desc: "Each driver ranked Dominant, Secondary, Priced In, or Neutral" },
  { n: "03", label: "Structure Alignment",       desc: "D1 → H4 → H1, minimum 2/3 aligned" },
  { n: "04", label: "Institutional Cross-Check", desc: "COT, ETF flows, smart money verdict" },
  { n: "05", label: "Confluence Scoring",        desc: "9 factors scored, minimum 5/9 for a trade" },
  { n: "06", label: "Precision Assessment",       desc: "Price at the level, volatility within range, reward-to-risk structurally justified" },
];

const DISCIPLINE = [
  "Extremely selective — 'nothing to do today' is a complete and valid answer",
  "Analysis only at structural levels — never mid-range, never forced",
  "Risk always structural and proportional to account phase",
  "Minimum 1.5R reward-to-risk context required to recommend engagement",
  "Caution flag raised automatically within 2 hours of high-impact events (CPI, NFP, FOMC, GDP)",
  "Session awareness — London (07–10 UTC) and New York (12–15 UTC) prioritized for actionable conditions",
  "Prop firm rules enforced automatically — DD limits, consistency rules, phase-specific guidance",
  "Psychological pattern detection — revenge trading, FOMO, and overtrading flagged before analysis",
];

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
            Our Methodology
          </h1>
          <p className="mt-6 text-[color:var(--muted)] leading-7 max-w-[68ch]">
            A disciplined, multi-framework approach to market analysis across all asset classes — built on the same principles used by institutional trading desks.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["22+ Data Sources", "7 Analytical Frameworks", "6-Step Reasoning", "All Asset Classes", "No Signals"].map((tag) => (
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

      {/* ── Section 1 — Data Sources ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <h2 className="text-[22px] tracking-[-0.02em]">Data Sources</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          BullionDesk processes 22+ real-time data sources every time you ask for an analysis.
        </p>

        <div className="mt-7 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DATA_CATEGORIES.map((cat) => (
            <div key={cat.title} className="card rounded-2xl border border-white/10 p-5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/55 mb-4">
                {cat.title}
              </div>
              <ul className="space-y-3">
                {cat.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium tracking-[0.08em] uppercase ${BADGE_STYLES[item.badge]}`}
                    >
                      {item.badge}
                    </span>
                    <span className="text-[12px] text-[color:var(--muted)] leading-5">
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2 — Analysis Frameworks ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <h2 className="text-[22px] tracking-[-0.02em]">Analysis Frameworks</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          Every analysis runs through multiple institutional frameworks simultaneously.
        </p>

        <div className="mt-7 space-y-3">
          {FRAMEWORKS.map((fw, i) => (
            <div
              key={fw.name}
              className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4"
            >
              <span className="mt-0.5 shrink-0 text-[11px] text-[color:var(--gold)] font-mono tracking-widest">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="text-[14px] text-white tracking-[-0.01em]">{fw.name}</div>
                <div className="mt-1 text-[12px] text-[color:var(--muted)] leading-5">{fw.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3 — Decision Process ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <h2 className="text-[22px] tracking-[-0.02em]">Decision Process</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          Before every response, the AI executes a 6-step reasoning sequence.
        </p>

        <div className="mt-7 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="card rounded-2xl border border-white/10 p-5 relative overflow-hidden"
            >
              <div className="pointer-events-none absolute -right-1 -top-2 text-[64px] leading-none font-bold tracking-[-0.05em] text-white/[0.025] select-none">
                {step.n}
              </div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--gold)] mb-2">
                {step.n}
              </div>
              <div className="text-[14px] text-white mb-2">{step.label}</div>
              <div className="text-[12px] text-[color:var(--muted)] leading-5">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4 — Trade Discipline ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <h2 className="text-[22px] tracking-[-0.02em]">Trade Discipline</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          The advisor says{" "}
          <span className="text-white font-medium">WAIT</span>{" "}more often than it
          validates conditions. That is by design.{" "}
          <span className="text-white/50">No position pressure. Ever.</span>
        </p>

        <div className="mt-7 space-y-2.5">
          {DISCIPLINE.map((rule, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
            >
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--gold)]" />
              <span className="text-[13px] text-[color:var(--muted)] leading-5">{rule}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 5 — What the Advisor Will Never Do ── */}
      <section className="card rounded-3xl p-8 border border-white/10">
        <h2 className="text-[22px] tracking-[-0.02em]">What the Advisor Will Never Do</h2>
        <p className="mt-3 text-[color:var(--muted)] leading-6 text-sm max-w-[60ch]">
          These constraints are hard-coded into every response. Not guidelines — rules.
        </p>
        <div className="mt-7 grid sm:grid-cols-2 gap-3">
          {[
            { label: "No entry prices", desc: "Never gives a specific price to enter a trade" },
            { label: "No stop loss targets", desc: "Never gives an exact SL price — explains the logic instead" },
            { label: "No take profit targets", desc: "Never gives a TP price — explains the structural context" },
            { label: "No directional predictions", desc: "Never says 'price will go to X'" },
            { label: "No position recommendations", desc: "Never says 'buy' or 'sell' as a direct instruction" },
            { label: "No performance promises", desc: "Never claims past or future returns" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3">
              <span className="mt-[3px] text-red-500/50 text-[13px] shrink-0">✕</span>
              <div>
                <div className="text-[13px] text-white/70">{item.label}</div>
                <div className="text-[11px] text-white/30 mt-0.5 leading-5">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer disclaimer ── */}
      <div className="pb-2 text-center">
        <p className="text-[11px] text-white/25 tracking-[0.06em]">
          BullionDesk does not provide investment advice. All analysis is for informational purposes only.
        </p>
      </div>

    </main>
  );
}
