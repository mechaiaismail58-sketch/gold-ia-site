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
    <div className="min-h-screen bg-[#07060b] text-white flex flex-col items-center justify-center px-4 py-16 animate-fade-in">

      {/* Background — same purple globs as the main site layout */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
        <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
      </div>

      <div className="w-full max-w-lg">

        {/* ── Logo ── */}
        <div className="text-center mb-12">
          <div className="text-[17px] tracking-[0.22em] uppercase text-white">
            BULLION <span className="text-[color:var(--gold)]">DESK</span>
          </div>
          {/* gold rule */}
          <div className="mx-auto mt-2.5 mb-0 w-8 h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.50)] to-transparent" />
          <p className="mt-2.5 text-xs text-[color:var(--muted)] tracking-[0.14em] uppercase">
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge — violet bg, gold pulsing dot, gold border ── */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.25)] bg-[rgba(109,40,217,0.14)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse shrink-0 shadow-[0_0_6px_rgba(212,175,55,0.70)]" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[rgba(196,181,253,0.90)]">
              COMING SOON
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-[32px] sm:text-[42px] leading-[1.12] tracking-[-0.025em] font-semibold mb-4">
            Precision gold intelligence.<br />
            <span className="bg-gradient-to-br from-[#c4b5fd] via-[#8b5cf6] to-[#6d28d9] bg-clip-text text-transparent">
              Built for traders who think institutionally.
            </span>
          </h1>
          <p className="text-[15px] text-[color:var(--muted)] leading-[1.75] max-w-[44ch] mx-auto">
            AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
          </p>
        </div>

        {/* ── Form card — .card glass with gold top shimmer ── */}
        <div className="card rounded-3xl overflow-hidden mb-6">
          {/* gold shimmer top line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.55)] to-transparent" />

          <div className="p-6 sm:p-8">
            {status === "success" ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(139,92,246,0.20)" strokeWidth="2" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#8B5CF6" strokeWidth="2"
                      strokeDasharray="150" strokeDashoffset="0" strokeLinecap="round"
                      style={{ animation: "drawCircle 0.7s ease-out forwards" }} />
                    <path d="M17 28l8 8L39 20" fill="none" stroke="#D4AF37" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: "drawCheck 0.4s 0.5s ease-out both" }} />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-white mb-1">You&apos;re on the list.</p>
                <p className="text-sm text-[color:var(--muted)]">We&apos;ll notify you when beta access opens.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted)] mb-2">
                  Email address
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email" autoComplete="email" required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="your@email.com"
                    className="flex-1 rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-base focus:outline-none focus:border-[rgba(212,175,55,0.45)] transition placeholder:text-white/20 min-h-[48px]"
                  />
                  {/* CTA — violet gradient + gold border detail */}
                  <button
                    type="submit" disabled={loading}
                    className="rounded-xl px-6 py-3 text-[13px] font-medium tracking-[0.05em] text-[#e8e0fa] min-h-[48px] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                    style={{
                      background: "linear-gradient(135deg, rgba(109,40,217,0.80) 0%, rgba(91,33,182,0.90) 100%)",
                      border: "1px solid rgba(212,175,55,0.30)",
                      boxShadow: "inset 0 1px 0 rgba(212,175,55,0.15), 0 4px 16px rgba(109,40,217,0.40)",
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(212,175,55,0.22), 0 6px 22px rgba(109,40,217,0.55)"; }}}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.30)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(212,175,55,0.15), 0 4px 16px rgba(109,40,217,0.40)"; }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(196,181,253,0.30)] border-t-[#a78bfa] animate-spin" />
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

                <p className="mt-3 text-center text-xs text-[color:var(--gold)] opacity-40">
                  Less than 100 spots available · One-time beta access · $10
                </p>
              </form>
            )}
          </div>
        </div>

        {/* ── Feature cards — .card glass, gold top shimmer on each ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="card rounded-2xl overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.30)] to-transparent" />
              <div className="p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[rgba(167,139,250,0.80)] mb-2">
                  {f.title}
                </div>
                <p className="text-xs text-white/35 leading-[1.65]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Divider gold shimmer ── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.20)] to-transparent mb-5" />

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/20">
          Bullion Desk{" "}
          <span className="text-[color:var(--gold)] opacity-40 text-[9px]">◆</span>
          {" "}© 2026 · Institutional Gold Intelligence
        </p>
      </div>

      <style>{`
        @keyframes drawCircle {
          from { stroke-dashoffset: 150; }
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
