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
    if (!isValidEmail(email)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStatus("idle");
    setErrorMsg("");
    setLoading(true);
    try {
      const res  = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 409) { setStatus("already"); return; }
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08060f",
      color: "#f0ecfa",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 16px",
    }}>

      {/* Background — large violet glows */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -280, left: -200, width: 700, height: 700, borderRadius: "50%", background: "rgba(109,40,217,0.30)", filter: "blur(130px)" }} />
        <div style={{ position: "absolute", top: -180, right: -250, width: 600, height: 600, borderRadius: "50%", background: "rgba(139,92,246,0.20)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: -250, left: "25%", width: 550, height: 550, borderRadius: "50%", background: "rgba(91,33,182,0.22)", filter: "blur(140px)" }} />
        {/* tiny gold warmth at center-bottom */}
        <div style={{ position: "absolute", bottom: -100, left: "45%", width: 200, height: 200, borderRadius: "50%", background: "rgba(212,175,55,0.05)", filter: "blur(80px)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 15, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e8e0fa" }}>
            BULLION <span style={{ color: "#D4AF37", fontSize: 15 }}>DESK</span>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,224,250,0.35)" }}>
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge — violet bg, gold dot ── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid rgba(139,92,246,0.40)",
            background: "rgba(109,40,217,0.14)",
            borderRadius: 999, padding: "6px 16px",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#D4AF37",
              animation: "pulse 1.6s ease-in-out infinite",
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(196,181,253,0.90)" }}>
              COMING SOON
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{
            fontSize: "clamp(26px, 5vw, 40px)", lineHeight: 1.12,
            letterSpacing: "-0.025em", fontWeight: 600,
            color: "#f0ecfa", margin: "0 0 16px",
          }}>
            Precision gold intelligence.<br />
            <span style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 60%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Built for traders who think institutionally.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(232,224,250,0.45)", lineHeight: 1.75, maxWidth: "44ch", margin: "0 auto" }}>
            AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
          </p>
        </div>

        {/* ── Form card — violet tint ── */}
        <div style={{
          background: "rgba(109,40,217,0.07)",
          border: "1px solid rgba(139,92,246,0.22)",
          borderRadius: 20, overflow: "hidden", marginBottom: 20,
        }}>
          {/* top accent line — violet */}
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.60), transparent)" }} />

          <div style={{ padding: "28px 28px 24px" }}>
            {status === "success" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(139,92,246,0.20)" strokeWidth="2" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#8B5CF6" strokeWidth="2"
                      strokeDasharray="150" strokeDashoffset="0" strokeLinecap="round"
                      style={{ animation: "drawCircle 0.7s ease-out forwards" }} />
                    {/* gold checkmark — the one gold detail */}
                    <path d="M17 28l8 8L39 20" fill="none" stroke="#D4AF37" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: "drawCheck 0.4s 0.5s ease-out both" }} />
                  </svg>
                </div>
                <p style={{ fontSize: 22, fontWeight: 600, color: "#f0ecfa", margin: "0 0 8px" }}>
                  You&apos;re on the list.
                </p>
                <p style={{ fontSize: 13, color: "rgba(196,181,253,0.55)" }}>
                  We&apos;ll notify you when beta access opens.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(196,181,253,0.45)", marginBottom: 8 }}>
                  Email address
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="your@email.com"
                    style={{
                      flex: 1, minWidth: 180,
                      background: "rgba(109,40,217,0.10)",
                      border: "1px solid rgba(139,92,246,0.25)",
                      borderRadius: 12, padding: "12px 16px",
                      color: "#f0ecfa", fontSize: 15,
                      outline: "none", minHeight: 48,
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(139,92,246,0.65)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(139,92,246,0.25)")}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      background: "linear-gradient(135deg, rgba(109,40,217,0.70) 0%, rgba(91,33,182,0.80) 100%)",
                      border: "1px solid rgba(139,92,246,0.50)",
                      borderRadius: 12, padding: "12px 24px",
                      color: "#e8e0fa", fontSize: 13,
                      fontWeight: 500, letterSpacing: "0.05em",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.55 : 1,
                      minHeight: 48, whiteSpace: "nowrap",
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                    onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = "linear-gradient(135deg, rgba(124,58,237,0.85) 0%, rgba(109,40,217,0.95) 100%)"); }}
                    onMouseLeave={e => { (e.currentTarget.style.background = "linear-gradient(135deg, rgba(109,40,217,0.70) 0%, rgba(91,33,182,0.80) 100%)"); }}
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
                  <p style={{ marginTop: 10, fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, padding: "8px 12px" }}>
                    {errorMsg}
                  </p>
                )}
                {status === "already" && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "rgba(196,181,253,0.50)", textAlign: "center" }}>
                    This email is already on the list.
                  </p>
                )}

                {/* gold detail — just this one small line */}
                <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(212,175,55,0.35)" }}>
                  Less than 100 spots available · One-time beta access · $10
                </p>
              </form>
            )}
          </div>
        </div>

        {/* ── Feature cards — violet tint ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginBottom: 40 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "rgba(109,40,217,0.06)",
              border: "1px solid rgba(139,92,246,0.14)",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(167,139,250,0.75)", marginBottom: 7 }}>
                {f.title}
              </div>
              <p style={{ fontSize: 12, color: "rgba(232,224,250,0.35)", lineHeight: 1.65, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Footer — tiny gold dot as the only other gold detail ── */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(196,181,253,0.22)" }}>
          Bullion Desk{" "}
          <span style={{ color: "rgba(212,175,55,0.40)", fontSize: 9 }}>◆</span>
          {" "}© 2026 · Institutional Gold Intelligence
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.80); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes drawCircle {
          from { stroke-dashoffset: 150; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dasharray: 0 40; }
          to   { stroke-dasharray: 40 0; }
        }
        input::placeholder { color: rgba(196,181,253,0.25); }
      `}</style>
    </div>
  );
}
