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
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .wl-root {
          min-height: 100vh;
          background: #0a0a0a;
          background-image: radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.04) 0%, transparent 70%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 20px;
        }

        .wl-inner {
          width: 100%;
          max-width: 600px;
        }

        /* Logo */
        .wl-logo {
          text-align: center;
          margin-bottom: 48px;
        }
        .wl-logo-text {
          font-size: 14px;
          font-weight: 300;
          letter-spacing: 0.30em;
          text-transform: uppercase;
          color: #fff;
        }
        .wl-logo-gold { color: #D4AF37; }
        .wl-logo-tagline {
          margin-top: 10px;
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #4b5563;
        }

        /* Badge */
        .wl-badge-wrap { text-align: center; margin-bottom: 28px; }
        .wl-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(212,175,55,0.40);
          background: transparent;
          border-radius: 999px;
          padding: 6px 16px;
        }
        .wl-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #D4AF37;
          flex-shrink: 0;
          animation: wlPulse 1.8s ease-in-out infinite;
        }
        .wl-badge-text {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: #D4AF37;
        }

        /* Hero */
        .wl-hero { text-align: center; margin-bottom: 44px; }
        .wl-h1 {
          font-size: clamp(38px, 6vw, 68px);
          font-weight: 300;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: #fff;
          margin-bottom: 20px;
        }
        .wl-h1-coming {
          font-style: italic;
          color: #D4AF37;
        }
        .wl-sub {
          font-size: 16px;
          color: #9ca3af;
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto;
        }

        /* Form container */
        .wl-form-wrap {
          background: #111111;
          border: 1px solid rgba(212,175,55,0.20);
          border-radius: 12px;
          padding: 28px 28px 24px;
          margin-bottom: 24px;
        }
        .wl-label {
          display: block;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 10px;
        }
        .wl-fields { display: flex; gap: 10px; }
        .wl-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 12px 14px;
          color: #fff;
          font-size: 15px;
          outline: none;
          min-height: 46px;
          transition: border-color 0.15s;
        }
        .wl-input::placeholder { color: #374151; }
        .wl-input:focus { border-color: rgba(212,175,55,0.50); }
        .wl-btn {
          background: #D4AF37;
          border: none;
          border-radius: 8px;
          padding: 12px 22px;
          color: #000;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.03em;
          cursor: pointer;
          min-height: 46px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.15s, opacity 0.15s;
        }
        .wl-btn:hover:not(:disabled) { background: #debb55; }
        .wl-btn:disabled { opacity: 0.50; cursor: not-allowed; }
        .wl-btn-inner { display: flex; align-items: center; gap: 8px; justify-content: center; }
        .wl-spin {
          width: 13px; height: 13px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.20);
          border-top-color: #000;
          animation: wlSpin 0.7s linear infinite;
          display: inline-block;
        }
        .wl-caption {
          margin-top: 14px;
          text-align: center;
          font-size: 11px;
          color: #374151;
        }
        .wl-error {
          margin-top: 10px;
          font-size: 12px;
          color: #f87171;
          background: rgba(248,113,113,0.05);
          border: 1px solid rgba(248,113,113,0.15);
          border-radius: 6px;
          padding: 8px 12px;
        }
        .wl-already {
          margin-top: 10px;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }

        /* Success */
        .wl-success { text-align: center; padding: 12px 0; }
        .wl-success-title { font-size: 20px; font-weight: 400; color: #fff; margin-bottom: 6px; }
        .wl-success-sub   { font-size: 13px; color: #6b7280; }

        /* Feature cards */
        .wl-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 40px;
        }
        .wl-card {
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 24px;
          transition: border-color 0.2s;
        }
        .wl-card:hover { border-color: rgba(212,175,55,0.15); }
        .wl-card-title {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #D4AF37;
          margin-bottom: 10px;
        }
        .wl-card-desc {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.6;
        }

        /* Footer */
        .wl-footer {
          text-align: center;
          font-size: 11px;
          color: #4b5563;
        }

        /* Animations */
        @keyframes wlPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.75); }
        }
        @keyframes wlSpin { to { transform: rotate(360deg); } }
        @keyframes wlDrawCircle {
          from { stroke-dashoffset: 150; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes wlDrawCheck {
          from { stroke-dasharray: 0 40; }
          to   { stroke-dasharray: 40 0; }
        }

        /* Mobile */
        @media (max-width: 580px) {
          .wl-fields { flex-direction: column; }
          .wl-input, .wl-btn { width: 100%; }
          .wl-cards { grid-template-columns: 1fr; }
          .wl-form-wrap { padding: 22px 18px 20px; }
        }
      `}</style>

      <div className="wl-root">
        <div className="wl-inner">

          {/* Logo */}
          <div className="wl-logo">
            <div className="wl-logo-text">
              Bullion <span className="wl-logo-gold">Desk</span>
            </div>
            <div className="wl-logo-tagline">Institutional Gold Intelligence</div>
          </div>

          {/* Badge */}
          <div className="wl-badge-wrap">
            <span className="wl-badge">
              <span className="wl-badge-dot" />
              <span className="wl-badge-text">Coming Soon</span>
            </span>
          </div>

          {/* Hero */}
          <div className="wl-hero">
            <h1 className="wl-h1">
              Institutional-grade<br />gold intelligence.<br />
              <span className="wl-h1-coming">Coming soon.</span>
            </h1>
            <p className="wl-sub">
              AI-powered XAUUSD analysis combining macro, smart money, and technical confluence. Beta access opening soon.
            </p>
          </div>

          {/* Form */}
          <div className="wl-form-wrap">
            {status === "success" ? (
              <div className="wl-success">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <svg width="52" height="52" viewBox="0 0 52 52">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="1.5" />
                    <circle cx="26" cy="26" r="22" fill="none" stroke="#D4AF37" strokeWidth="1.5"
                      strokeDasharray="138" strokeLinecap="round"
                      style={{ animation: "wlDrawCircle 0.8s ease-out forwards" }} />
                    <path d="M15 26l8 8 14-15" fill="none" stroke="#D4AF37" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ animation: "wlDrawCheck 0.35s 0.65s ease-out both" }} />
                  </svg>
                </div>
                <p className="wl-success-title">You&apos;re on the list.</p>
                <p className="wl-success-sub">We&apos;ll notify you when beta access opens.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <label className="wl-label">Email address</label>
                <div className="wl-fields">
                  <input
                    type="email" autoComplete="email" required
                    className="wl-input"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                    placeholder="your@email.com"
                  />
                  <button type="submit" disabled={loading} className="wl-btn">
                    {loading ? (
                      <span className="wl-btn-inner">
                        <span className="wl-spin" />
                        Joining…
                      </span>
                    ) : "Join the waitlist"}
                  </button>
                </div>
                {status === "error" && errorMsg && <p className="wl-error">{errorMsg}</p>}
                {status === "already" && <p className="wl-already">This email is already on the list.</p>}
                <p className="wl-caption">Less than 100 spots available · One-time beta access · $10</p>
              </form>
            )}
          </div>

          {/* Feature cards */}
          <div className="wl-cards">
            {FEATURES.map((f) => (
              <div key={f.title} className="wl-card">
                <div className="wl-card-title">{f.title}</div>
                <p className="wl-card-desc">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="wl-footer">Bullion Desk © 2026 · Institutional Gold Intelligence</p>

        </div>
      </div>
    </>
  );
}
