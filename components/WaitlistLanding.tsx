"use client";

import { useState } from "react";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const FEATURES = [
  {
    title: "Deep Analysis",
    desc: "Macro-technical confluence across COT, ETF flows, DXY, yields and key S/R levels.",
  },
  {
    title: "Real-time signals",
    desc: "Live XAUUSD data with AI-generated entry, stop-loss and target levels on demand.",
  },
  {
    title: "Institutional framework",
    desc: "8-criterion scoring system built on the same logic used by institutional desks.",
  },
];

export default function WaitlistLanding() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07060b] flex flex-col items-center justify-center px-4 py-16 animate-fade-in">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.20)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.12)] blur-[120px]" />
        <div className="absolute bottom-[-120px] left-[20%] h-[400px] w-[400px] rounded-full bg-[rgba(200,162,74,0.07)] blur-[120px]" />
      </div>

      <div className="w-full max-w-lg">
        {/* ── Logo ── */}
        <div className="text-center mb-12">
          <div className="text-[17px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)] tracking-[0.14em] uppercase">
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.05)] px-3.5 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse shrink-0" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[rgba(212,175,55,0.75)]">
              Coming Soon
            </span>
          </div>

          <h1 className="text-[32px] sm:text-[42px] leading-[1.12] tracking-[-0.025em] mb-4">
            Institutional-grade gold intelligence.{" "}
            <span className="text-[color:var(--gold)]">Coming soon.</span>
          </h1>

          <p className="text-[15px] sm:text-[16px] text-[color:var(--muted)] leading-[1.7] max-w-[42ch] mx-auto">
            Be the first to access precision XAUUSD trade signals powered by AI.
          </p>
        </div>

        {/* ── Form card ── */}
        <div className="card border border-white/10 rounded-3xl overflow-hidden mb-8">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.45)] to-transparent" />

          <div className="p-6 sm:p-8">
            {success ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11l5 5L18 6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-[15px] text-white/85 leading-relaxed">
                  You&apos;re on the list.
                </p>
                <p className="mt-1 text-[13px] text-[color:var(--muted)]">
                  We&apos;ll notify you when early access opens.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label
                  htmlFor="waitlist-email"
                  className="block text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted)] mb-2"
                >
                  Email address
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="waitlist-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    placeholder="your@email.com"
                    className="flex-1 rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-[16px] focus:outline-none focus:border-[rgba(212,175,55,0.55)] transition placeholder:text-white/25 min-h-[48px]"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl border border-[rgba(212,175,55,0.60)] bg-[rgba(212,175,55,0.09)] px-6 py-3 text-[13px] font-medium tracking-[0.06em] text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.95)] disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] shrink-0"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-[#D4AF37]/30 border-t-[#D4AF37] animate-spin" />
                        Joining…
                      </span>
                    ) : (
                      "Join the waitlist"
                    )}
                  </button>
                </div>

                {error && (
                  <p className="mt-2.5 text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.05] rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <p className="mt-3 text-center text-[12px] text-white/25">
                  Less than 100 spots available. One-time beta access — $10.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* ── Feature cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card rounded-2xl border border-white/[0.07] p-4"
            >
              <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[rgba(212,175,55,0.70)] mb-2">
                {f.title}
              </div>
              <p className="text-[12px] text-white/45 leading-[1.65]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/20">
          Bullion Desk © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
