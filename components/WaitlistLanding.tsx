"use client";

import { useState } from "react";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const FEATURES = [
  {
    title: "Institutional Analysis",
    desc: "Full macro-technical confluence: COT positioning, ETF flows, yields, DXY and smart money reads.",
  },
  {
    title: "Sniper Entries",
    desc: "OB/FVG-based entry levels with structural SL and minimum 1.5R TP — never a guess.",
  },
  {
    title: "Real-time Data",
    desc: "Live XAUUSD price, intermarket context, and AI-driven confluence scoring updated on demand.",
  },
];

export default function WaitlistLanding() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<"idle" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) { setStatus("error"); setErrorMsg("Please enter a valid email address."); return; }
    setStatus("idle"); setErrorMsg(""); setLoading(true);
    try {
      const res  = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.status === 409) { setStatus("already"); return; }
      if (!res.ok) { setStatus("error"); setErrorMsg(data.error || "Something went wrong. Please try again."); return; }
      setStatus("success");
    } catch { setStatus("error"); setErrorMsg("Network error — please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-[#07060b] text-white flex flex-col items-center px-4 py-16 animate-fade-in">

      {/* Same purple blobs as main site layout */}
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
              Coming Soon
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] font-normal mb-5">
            Institutional-grade gold intelligence.{" "}
            <span className="text-[color:var(--gold)] italic">Coming soon.</span>
          </h1>
          <p className="text-[16px] text-[color:var(--muted)] leading-[1.7] max-w-[46ch] mx-auto">
            AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
          </p>
        </div>

        {/* ── Form card — same .card glass as the rest of the site ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-5">
          {/* Purple top accent bar — same as About, Methodology, etc. */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />

          <div className="p-6 sm:p-8">
            {status === "success" ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-5">
                  <svg width="52" height="52" viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(139,92,246,0.20)" strokeWidth="1.5" />
                    <circle cx="26" cy="26" r="22" fill="none" stroke="#8B5CF6" strokeWidth="1.5"
                      strokeDasharray="138" strokeLinecap="round"
                      style={{ animation: "drawCircle 0.8s ease-out forwards" }} />
                    <path d="M15 26l8 8 14-15" fill="none" stroke="#D4AF37" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: "drawCheck 0.35s 0.65s ease-out both" }} />
                  </svg>
                </div>
                <p className="text-lg font-medium text-white mb-1.5">You&apos;re on the list.</p>
                <p className="text-sm text-[color:var(--muted)]">We&apos;ll notify you when beta access opens.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted)] mb-2.5">
                  Email address
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email" autoComplete="email" required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="your@email.com"
                    className="flex-1 rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-base focus:outline-none focus:border-[rgba(212,175,55,0.50)] transition placeholder:text-white/20 min-h-[48px]"
                  />
                  <button
                    type="submit" disabled={loading}
                    className="rounded-xl border border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.08)] px-6 py-3 text-[13px] font-medium tracking-[0.05em] text-[color:var(--gold)] hover:bg-[rgba(212,175,55,0.16)] hover:border-[rgba(212,175,55,0.85)] disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[48px] shrink-0"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(212,175,55,0.25)] border-t-[color:var(--gold)] animate-spin" />
                        Joining…
                      </span>
                    ) : "Join the waitlist"}
                  </button>
                </div>

                {status === "error" && errorMsg && (
                  <p className="mt-2.5 text-xs text-red-400 border border-red-500/20 bg-red-500/[0.05] rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}
                {status === "already" && (
                  <p className="mt-2.5 text-xs text-center text-[color:var(--muted)]">
                    This email is already on the list.
                  </p>
                )}

                <p className="mt-3 text-center text-[11px] text-white/25">
                  Less than 100 spots available · One-time beta access · $10
                </p>
              </form>
            )}
          </div>
        </div>

        {/* ── Feature cards — same style as site's pill tags / small cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="card rounded-2xl border border-white/10 overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.35)] to-transparent" />
              <div className="p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--gold)] mb-2">
                  {f.title}
                </p>
                <p className="text-xs text-[color:var(--muted)] leading-[1.65]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/25">
          Bullion Desk © 2026 · Institutional Gold Intelligence
        </p>
      </div>

      <style>{`
        @keyframes drawCircle {
          from { stroke-dashoffset: 138; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dasharray: 0 40; }
          to   { stroke-dasharray: 40 0; }
        }
      `}</style>
    </div>
  );
}
