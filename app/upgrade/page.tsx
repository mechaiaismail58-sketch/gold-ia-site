"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PRICING } from "@/lib/pricing";
import SpotlightCard from "@/components/ui/reactbits/SpotlightCard";
import SplitText from "@/components/ui/reactbits/SplitText";
import StarBorder from "@/components/ui/reactbits/StarBorder";
import CountUp from "@/components/ui/reactbits/CountUp";

const FEATURES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    text: "AI-powered XAUUSD coaching & analysis",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    text: "3 analysis modes: Deep Analysis, Quick Brief, Trade Review",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    text: "Real-time data: COT positioning, ETF flows, intermarket context",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 12L6 7l3 3 2-4 2 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    text: "8-criterion confluence scoring — tradability assessment before every decision",
  },
];

function UpgradeContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const exhausted = reason === "exhausted";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function handleCheckout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed. Please try again.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <style>{`
        @keyframes upgrade-card-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .upgrade-card-in {
          animation: upgrade-card-in 500ms ease-out both;
        }
      `}</style>

      {/* Logout button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-[11px] text-white/25 hover:text-white/50 transition disabled:opacity-40"
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>

      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[#D4A843]">Desk</span>
          </Link>
          <p className="mt-1.5 text-xs text-[#A1A1AA] tracking-[0.12em] uppercase">
            AI Gold Trading Coach
          </p>
        </div>

        {/* Card */}
        <div className="relative">
          {/* Subtle gold glow behind the card */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="h-[440px] w-[440px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(212,168,67,0.10) 0%, transparent 70%)" }}
            />
          </div>

          <SpotlightCard className="!rounded-2xl !border-white/5 !bg-[rgba(17,17,17,0.6)] backdrop-blur-xl overflow-hidden !p-0" spotlightColor="rgba(212, 168, 67, 0.15)">
            {/* Top gold line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.50)] to-transparent" />

            <div className="p-8 sm:p-10">
              {/* Badge */}
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.06)] px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[rgba(212,175,55,0.8)]">Beta Access</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-[0.12em] text-white/35">Less than 100 spots available</span>
                </div>
              </div>

              {/* Exhausted notice */}
              {exhausted && (
                <div className="mb-6 rounded-xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.05)] px-4 py-3 text-[13px] text-[rgba(212,175,55,0.85)]">
                  You&apos;ve used your 30 analyses included in beta access — upgrade to continue.
                </div>
              )}

              {/* Title */}
              <SplitText text="Bullion Desk Beta Access" className="text-[28px] sm:text-[32px] leading-[1.15] tracking-[-0.02em] mb-2 text-white font-semibold" />
              <p className="text-[#A1A1AA] text-[14px] leading-relaxed mb-8 max-w-[44ch]">
                Full access to your AI Gold Trading Coach — macro-technical analysis, live data, prop firm monitoring, and institutional-grade clarity.
              </p>

              {/* Feature list */}
              <ul className="space-y-3.5 mb-8">
                {FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-[#D4A843]">{f.icon}</span>
                    <span className="text-[13px] text-white/70 leading-[1.65]">{f.text}</span>
                  </li>
                ))}
              </ul>

              {/* Pricing */}
              <div className="rounded-2xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.04)] p-5 mb-7">
                <div className="flex items-baseline gap-2">
                  <span className="text-[36px] font-semibold tracking-tight text-white">$<CountUp to={PRICING.beta} duration={1.5} /></span>
                  <span className="text-[#A1A1AA] text-sm">one-time · early access</span>
                </div>
                <p className="text-[12px] text-white/30 mt-1.5">Lock your beta price before it&apos;s gone.</p>
              </div>

              {/* Error */}
              {error && (
                <p className="mb-4 text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {/* CTA button */}
              <StarBorder as="div" color="#D4A843" speed="5s" className="w-full !rounded-2xl">
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full !rounded-2xl py-4 text-[15px] font-bold tracking-[0.02em] bg-[#D4A843] text-black transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                      Redirecting to checkout…
                    </span>
                  ) : (
                    `Get Early Access — $${PRICING.beta}`
                  )}
                </button>
              </StarBorder>

              <div className="mt-3 text-center">
                <p className="text-sm font-medium" style={{ color: "#D4A843" }}>🔒 {PRICING.betaLine}</p>
                <p className="text-xs font-normal mt-1" style={{ color: "#71717A" }}>{PRICING.urgencyLine}</p>
              </div>

              <p className="mt-3 text-[11px] text-white/20 text-center">
                Secure checkout via Stripe. Not investment advice.
              </p>
            </div>
          </SpotlightCard>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-[12px] text-white/25 hover:text-white/50 transition">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeContent />
    </Suspense>
  );
}
