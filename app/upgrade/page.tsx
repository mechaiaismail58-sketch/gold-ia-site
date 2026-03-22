"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    text: "Institutional-grade XAUUSD macro-technical analysis",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    text: "3 analysis modes: Deep Analysis, Quick Brief, Trade Only",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    text: "Real-time data: COT positioning, ETF flows, intermarket signals",
  },
  {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 12L6 7l3 3 2-4 2 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    text: "Sniper entries with calibrated SL/TP — 8-criterion confluence scoring",
  },
];

function UpgradeContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const exhausted = reason === "exhausted";
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
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
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 py-16 animate-fade-in">
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

      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.18)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.10)] blur-[120px]" />
        <div className="absolute bottom-[-120px] left-[20%] h-[400px] w-[400px] rounded-full bg-[rgba(200,162,74,0.06)] blur-[120px]" />
      </div>

      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </Link>
          <p className="mt-1.5 text-xs text-[color:var(--muted)] tracking-[0.12em] uppercase">
            Institutional Gold Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="card border border-white/10 rounded-3xl overflow-hidden">
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
                <span className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0" />
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
            <h1 className="text-[28px] sm:text-[32px] leading-[1.15] tracking-[-0.02em] mb-2">
              Bullion Desk Beta Access
            </h1>
            <p className="text-[color:var(--muted)] text-[14px] leading-relaxed mb-8 max-w-[44ch]">
              Full access to the institutional gold analysis engine — macro-technical signals, live data, and precision trade plans.
            </p>

            {/* Feature list */}
            <ul className="space-y-3.5 mb-8">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-[#D4AF37]">{f.icon}</span>
                  <span className="text-[13px] text-white/70 leading-[1.65]">{f.text}</span>
                </li>
              ))}
            </ul>

            {/* Pricing */}
            <div className="rounded-2xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.04)] p-5 mb-7">
              <div className="flex items-baseline gap-2">
                <span className="text-[36px] font-semibold tracking-tight text-white">$10</span>
                <span className="text-[color:var(--muted)] text-sm">one-time · beta pricing</span>
              </div>
              <p className="text-[12px] text-white/30 mt-1.5">No subscription. No recurring charges. Full access.</p>
            </div>

            {/* Error */}
            {error && (
              <p className="mb-4 text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {/* CTA button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full rounded-2xl py-4 text-[14px] font-medium tracking-[0.06em] border border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.10)] text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.95)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-[#D4AF37]/30 border-t-[#D4AF37] animate-spin" />
                  Redirecting to checkout…
                </span>
              ) : (
                "Get Access — $10"
              )}
            </button>

            <p className="mt-4 text-[11px] text-white/20 text-center">
              Secure checkout via Stripe. Not investment advice.
            </p>
          </div>
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
