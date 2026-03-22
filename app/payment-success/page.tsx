"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Phase = "polling" | "countdown" | "redirecting";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("polling");
  const [countdown, setCountdown] = useState(3);
  const [pollFailed, setPollFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    // Poll /api/auth/payment-status every 1s, up to 10 attempts
    pollRef.current = setInterval(async () => {
      pollCount.current += 1;

      try {
        const res = await fetch("/api/auth/payment-status");
        const data = await res.json();

        if (data.has_paid === true) {
          clearInterval(pollRef.current!);
          setPhase("countdown");
        } else if (pollCount.current >= 10) {
          // 10s timeout — webhook may be delayed; show countdown anyway
          clearInterval(pollRef.current!);
          setPollFailed(true);
          setPhase("countdown");
        }
      } catch {
        if (pollCount.current >= 10) {
          clearInterval(pollRef.current!);
          setPhase("countdown");
        }
      }
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Start the 3→2→1 countdown once has_paid is confirmed
  useEffect(() => {
    if (phase !== "countdown") return;

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase("redirecting");
          router.push("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, router]);

  return (
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 animate-fade-in">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.18)] blur-[110px]" />
        <div className="absolute bottom-[-120px] left-[20%] h-[400px] w-[400px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[120px]" />
      </div>

      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-10">
          <Link href="/" className="inline-block text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </Link>
          <p className="mt-1.5 text-xs text-[color:var(--muted)] tracking-[0.12em] uppercase">
            Institutional Gold Intelligence
          </p>
        </div>

        <div className="card border border-white/10 rounded-3xl overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.50)] to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Icon — spinner while polling, checkmark when confirmed */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.06)]">
              {phase === "polling" ? (
                <span className="h-7 w-7 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M5 14l7 7L23 7" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            <h1 className="text-[26px] sm:text-[30px] leading-[1.2] tracking-[-0.02em] mb-3">
              {phase === "polling" ? "Confirming your payment…" : "Welcome to Bullion Desk Beta"}
            </h1>
            <p className="text-[color:var(--muted)] text-[14px] leading-relaxed mb-8">
              {phase === "polling"
                ? "Processing your payment confirmation. This takes just a moment."
                : "Your access is now active. The full institutional gold analysis engine is unlocked."}
            </p>

            <div className="rounded-2xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.04)] px-5 py-4 mb-7">
              <p className="text-[13px] text-[rgba(212,175,55,0.85)]">
                {phase === "polling"
                  ? "Syncing your account access…"
                  : "Full access granted — no restrictions, no recurring charges."}
              </p>
            </div>

            {phase !== "polling" && (
              <Link
                href="/"
                className="block w-full rounded-2xl py-4 text-[14px] font-medium tracking-[0.06em] border border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.10)] text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.95)] text-center"
              >
                Go to Dashboard
              </Link>
            )}

            {/* Status footer */}
            <div className="mt-5 flex items-center justify-center gap-3 min-h-[20px]">
              {phase === "polling" ? (
                <span className="text-[11px] text-white/25 animate-pulse">
                  Verifying with Stripe…
                </span>
              ) : phase === "countdown" || phase === "redirecting" ? (
                <>
                  <span className="text-[11px] text-white/25">Redirecting in</span>
                  <div className="flex items-center gap-1.5">
                    {[3, 2, 1].map((n) => (
                      <span
                        key={n}
                        className={`text-[11px] font-mono transition-all duration-300 ${
                          countdown === n
                            ? "text-[#D4AF37] scale-110"
                            : countdown < n
                            ? "text-white/10 line-through"
                            : "text-white/25"
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {pollFailed && phase !== "polling" && (
              <p className="mt-3 text-[11px] text-white/20">
                Access may take a few seconds to activate — refresh if needed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
