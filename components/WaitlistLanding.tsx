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
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<"idle" | "success" | "already" | "error">("idle");
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
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f5f0e8",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
      }}
    >
      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: -200, width: 600, height: 600, borderRadius: "50%", background: "rgba(212,175,55,0.06)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: -200, right: -200, width: 500, height: 500, borderRadius: "50%", background: "rgba(212,175,55,0.04)", filter: "blur(100px)" }} />
      </div>

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 15, letterSpacing: "0.22em", textTransform: "uppercase", color: "#f5f0e8" }}>
            BULLION <span style={{ color: "#D4AF37" }}>DESK</span>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,240,232,0.35)" }}>
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge ── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: "1px solid rgba(212,175,55,0.30)",
            background: "rgba(212,175,55,0.05)",
            borderRadius: 999, padding: "6px 14px",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: "#D4AF37",
              animation: "pulse 1.5s ease-in-out infinite",
              display: "inline-block", flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(212,175,55,0.80)" }}>
              COMING SOON
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{
            fontSize: "clamp(26px, 5vw, 40px)", lineHeight: 1.12,
            letterSpacing: "-0.025em", fontWeight: 600,
            color: "#f5f0e8", margin: "0 0 16px",
          }}>
            Precision gold intelligence.<br />
            <span style={{ color: "#D4AF37" }}>Built for traders who think institutionally.</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(245,240,232,0.50)", lineHeight: 1.7, maxWidth: "44ch", margin: "0 auto" }}>
            AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
          </p>
        </div>

        {/* ── Form card ── */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, overflow: "hidden", marginBottom: 24,
        }}>
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.50), transparent)" }} />
          <div style={{ padding: "28px 28px 24px" }}>
            {status === "success" ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                {/* Animated checkmark circle */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle
                      cx="28" cy="28" r="24"
                      fill="none" stroke="rgba(212,175,55,0.25)" strokeWidth="2"
                    />
                    <circle
                      cx="28" cy="28" r="24"
                      fill="none" stroke="#D4AF37" strokeWidth="2"
                      strokeDasharray="150" strokeDashoffset="0"
                      strokeLinecap="round"
                      style={{ animation: "drawCircle 0.7s ease-out forwards" }}
                    />
                    <path
                      d="M17 28l8 8L39 20"
                      fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: "drawCheck 0.4s 0.5s ease-out both" }}
                    />
                  </svg>
                </div>
                <p style={{ fontSize: 22, fontWeight: 600, color: "#f5f0e8", margin: "0 0 8px" }}>
                  You&apos;re on the list.
                </p>
                <p style={{ fontSize: 13, color: "rgba(245,240,232,0.45)" }}>
                  We&apos;ll notify you when beta access opens.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,240,232,0.35)", marginBottom: 8 }}>
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
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12, padding: "12px 16px",
                      color: "#f5f0e8", fontSize: 15,
                      outline: "none", minHeight: 48,
                    }}
                    onFocus={e => (e.target.style.borderColor = "rgba(212,175,55,0.55)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      background: "rgba(212,175,55,0.10)",
                      border: "1px solid rgba(212,175,55,0.55)",
                      borderRadius: 12, padding: "12px 24px",
                      color: "#D4AF37", fontSize: 13,
                      fontWeight: 500, letterSpacing: "0.06em",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.55 : 1,
                      minHeight: 48, whiteSpace: "nowrap",
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                    onMouseEnter={e => { if (!loading) { (e.target as HTMLButtonElement).style.background = "rgba(212,175,55,0.20)"; (e.target as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.90)"; }}}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "rgba(212,175,55,0.10)"; (e.target as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.55)"; }}
                  >
                    {loading ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(212,175,55,0.30)", borderTopColor: "#D4AF37", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                        Joining…
                      </span>
                    ) : "Join the waitlist"}
                  </button>
                </div>

                {status === "error" && errorMsg && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 8, padding: "8px 12px" }}>
                    {errorMsg}
                  </p>
                )}
                {status === "already" && (
                  <p style={{ marginTop: 10, fontSize: 12, color: "rgba(245,240,232,0.45)", textAlign: "center" }}>
                    This email is already on the list.
                  </p>
                )}

                <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(245,240,232,0.22)" }}>
                  Less than 100 spots available · One-time beta access · $10
                </p>
              </form>
            )}
          </div>
        </div>

        {/* ── Feature cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 40 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14, padding: 16,
              }}
            >
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(212,175,55,0.70)", marginBottom: 8 }}>
                {f.title}
              </div>
              <p style={{ fontSize: 12, color: "rgba(245,240,232,0.40)", lineHeight: 1.65, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(245,240,232,0.18)" }}>
          Bullion Desk © 2026 · Institutional Gold Intelligence
        </p>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes drawCircle {
          from { stroke-dashoffset: 150; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dasharray: 0 40; }
          to { stroke-dasharray: 40 0; }
        }
      `}</style>
    </div>
  );
}
