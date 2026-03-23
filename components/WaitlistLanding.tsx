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
    <div style={{ minHeight: "100vh", background: "#08060f", color: "#f0ecfa", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 16px" }}>

      {/* ── Background — violet glows + gold breath ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -280, left: -200,  width: 700, height: 700, borderRadius: "50%", background: "rgba(109,40,217,0.32)", filter: "blur(130px)" }} />
        <div style={{ position: "absolute", top: -180, right: -250, width: 600, height: 600, borderRadius: "50%", background: "rgba(139,92,246,0.20)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: -250, left: "25%", width: 550, height: 550, borderRadius: "50%", background: "rgba(91,33,182,0.24)", filter: "blur(140px)" }} />
        {/* gold breath — center */}
        <div style={{ position: "absolute", top: "35%", left: "38%", width: 320, height: 160, borderRadius: "50%", background: "rgba(212,175,55,0.07)", filter: "blur(90px)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        {/* ── Logo + thin gold underline ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 15, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e8e0fa" }}>
            BULLION <span style={{ color: "#D4AF37" }}>DESK</span>
          </div>
          {/* gold rule under logo */}
          <div style={{ margin: "10px auto 0", width: 36, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)" }} />
          <p style={{ marginTop: 9, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,224,250,0.32)" }}>
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge — violet bg, gold dot + gold border shimmer ── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid rgba(212,175,55,0.22)",
            background: "rgba(109,40,217,0.16)",
            borderRadius: 999, padding: "6px 16px",
            boxShadow: "0 0 10px rgba(212,175,55,0.06)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D4AF37", animation: "pulse 1.6s ease-in-out infinite", display: "inline-block", flexShrink: 0, boxShadow: "0 0 6px rgba(212,175,55,0.60)" }} />
            <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(196,181,253,0.90)" }}>
              COMING SOON
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", lineHeight: 1.12, letterSpacing: "-0.025em", fontWeight: 600, color: "#f0ecfa", margin: "0 0 16px" }}>
            Precision gold intelligence.<br />
            <span style={{ background: "linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 55%, #6d28d9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Built for traders who think institutionally.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(232,224,250,0.42)", lineHeight: 1.75, maxWidth: "44ch", margin: "0 auto" }}>
            AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
          </p>
        </div>

        {/* ── Form card — violet + gold top shimmer + gold corner glow ── */}
        <div style={{
          background: "rgba(109,40,217,0.07)",
          border: "1px solid rgba(139,92,246,0.20)",
          borderRadius: 20, overflow: "hidden", marginBottom: 20,
          boxShadow: "0 0 0 1px rgba(212,175,55,0.06), 0 8px 40px rgba(109,40,217,0.18), inset 0 1px 0 rgba(212,175,55,0.10)",
          position: "relative",
        }}>
          {/* gold top line — shimmer */}
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.50) 40%, rgba(212,175,55,0.70) 50%, rgba(212,175,55,0.50) 60%, transparent 100%)" }} />

          <div style={{ padding: "28px 28px 24px" }}>
            {status === "success" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(139,92,246,0.20)" strokeWidth="2" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="150" strokeDashoffset="0" strokeLinecap="round" style={{ animation: "drawCircle 0.7s ease-out forwards" }} />
                    <path d="M17 28l8 8L39 20" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "drawCheck 0.4s 0.5s ease-out both" }} />
                  </svg>
                </div>
                <p style={{ fontSize: 22, fontWeight: 600, color: "#f0ecfa", margin: "0 0 8px" }}>You&apos;re on the list.</p>
                <p style={{ fontSize: 13, color: "rgba(196,181,253,0.50)" }}>We&apos;ll notify you when beta access opens.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(196,181,253,0.42)", marginBottom: 8 }}>
                  Email address
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="email" autoComplete="email" required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="your@email.com"
                    style={{ flex: 1, minWidth: 180, background: "rgba(109,40,217,0.10)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 12, padding: "12px 16px", color: "#f0ecfa", fontSize: 15, outline: "none", minHeight: 48 }}
                    onFocus={e => (e.target.style.borderColor = "rgba(212,175,55,0.40)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(139,92,246,0.22)")}
                  />
                  {/* CTA button — violet fill + thin gold border */}
                  <button
                    type="submit" disabled={loading}
                    style={{
                      background: "linear-gradient(135deg, rgba(109,40,217,0.75) 0%, rgba(91,33,182,0.85) 100%)",
                      border: "1px solid rgba(212,175,55,0.28)",
                      borderRadius: 12, padding: "12px 24px",
                      color: "#e8e0fa", fontSize: 13, fontWeight: 500, letterSpacing: "0.05em",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.55 : 1,
                      minHeight: 48, whiteSpace: "nowrap",
                      boxShadow: "inset 0 1px 0 rgba(212,175,55,0.12), 0 4px 14px rgba(109,40,217,0.35)",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(124,58,237,0.88) 0%, rgba(109,40,217,0.95) 100%)"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.50)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(212,175,55,0.18), 0 6px 20px rgba(109,40,217,0.45)"; }}}
                    onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(109,40,217,0.75) 0%, rgba(91,33,182,0.85) 100%)"; e.currentTarget.style.borderColor = "rgba(212,175,55,0.28)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(212,175,55,0.12), 0 4px 14px rgba(109,40,217,0.35)"; }}
                  >
                    {loading ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(196,181,253,0.30)", borderTopColor: "#a78bfa", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                        Joining…
                      </span>
                    ) : "Join the waitlist"}
                  </button>
                </div>

                {status === "error" && errorMsg && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, padding: "8px 12px" }}>{errorMsg}</p>
                )}
                {status === "already" && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "rgba(196,181,253,0.45)", textAlign: "center" }}>This email is already on the list.</p>
                )}

                {/* gold caption */}
                <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(212,175,55,0.40)" }}>
                  Less than 100 spots available · One-time beta access · $10
                </p>
              </form>
            )}
          </div>

          {/* gold corner glow — bottom-right */}
          <div style={{ position: "absolute", bottom: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(212,175,55,0.06)", filter: "blur(30px)", pointerEvents: "none" }} />
        </div>

        {/* ── Feature cards — violet + gold top accent per card ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginBottom: 40 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "rgba(109,40,217,0.07)",
              border: "1px solid rgba(139,92,246,0.16)",
              borderRadius: 14, padding: "14px 16px",
              position: "relative", overflow: "hidden",
              boxShadow: "inset 0 1px 0 rgba(212,175,55,0.08)",
            }}>
              {/* gold top shimmer per card */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.30), transparent)" }} />
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(167,139,250,0.75)", marginBottom: 7 }}>
                {f.title}
              </div>
              <p style={{ fontSize: 12, color: "rgba(232,224,250,0.33)", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Divider — gold shimmer line ── */}
        <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.18) 30%, rgba(212,175,55,0.28) 50%, rgba(212,175,55,0.18) 70%, transparent 100%)", marginBottom: 20 }} />

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(196,181,253,0.20)" }}>
          Bullion Desk{" "}
          <span style={{ color: "rgba(212,175,55,0.45)", fontSize: 9 }}>◆</span>
          {" "}© 2026 · Institutional Gold Intelligence
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.40; transform: scale(0.78); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes drawCircle {
          from { stroke-dashoffset: 150; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dasharray: 0 40; }
          to   { stroke-dasharray: 40 0; }
        }
        input::placeholder { color: rgba(196,181,253,0.22); }
      `}</style>
    </div>
  );
}
