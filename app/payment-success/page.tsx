"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Phase = "verifying" | "countdown" | "redirecting" | "timeout";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [phase, setPhase] = useState<Phase>("verifying");
  const [countdown, setCountdown] = useState(3);
  const [statusMsg, setStatusMsg] = useState("Verifying your payment with Stripe…");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const startCountdown = useCallback(() => {
    setPhase("countdown");
  }, []);

  // ── Main: call verify-payment, fall back to polling has_paid ─────────────
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // ── Path A: we have a session_id → use verify-payment (reliable) ──
      if (sessionId) {
        setStatusMsg("Confirming payment with Stripe…");

        try {
          const res  = await fetch(`/api/stripe/verify-payment?session_id=${sessionId}`);
          const data = await res.json();

          if (cancelled) return;

          if (data.has_paid === true) {
            setStatusMsg("Payment confirmed.");
            startCountdown();
            return;
          }

          console.warn("[payment-success] verify-payment returned:", data);
          // Fall through to polling if verify-payment says not paid yet
        } catch (err) {
          console.error("[payment-success] verify-payment fetch failed:", err);
        }
      }

      // ── Path B: no session_id or verify-payment inconclusive → poll DB ──
      setStatusMsg("Syncing your account…");

      let attempts = 0;
      intervalRef.current = setInterval(async () => {
        if (cancelled) return;
        attempts++;

        try {
          const res  = await fetch("/api/auth/payment-status");
          const data = await res.json();

          if (data.has_paid === true) {
            clearInterval(intervalRef.current!);
            setStatusMsg("Access confirmed.");
            startCountdown();
          } else if (attempts >= 15) {
            clearInterval(intervalRef.current!);
            setPhase("timeout");
          }
        } catch {
          if (attempts >= 15) {
            clearInterval(intervalRef.current!);
            setPhase("timeout");
          }
        }
      }, 1000);
    }

    run();

    // Hard 15 s safety net — show escape button regardless
    timeoutRef.current = setTimeout(() => {
      if (cancelled) return;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase((p) => (p === "verifying" ? "timeout" : p));
    }, 15_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current)  clearTimeout(timeoutRef.current);
    };
  }, [sessionId, startCountdown]);

  // ── Countdown 3 → 2 → 1 → redirect ─────────────────────────────────────
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

  const confirmed = phase === "countdown" || phase === "redirecting";

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
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.06)]">
              {phase === "timeout" ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M14 8v8M14 20v.5" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : confirmed ? (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <path d="M5 14l7 7L23 7" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="h-7 w-7 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
              )}
            </div>

            <h1 className="text-[26px] sm:text-[30px] leading-[1.2] tracking-[-0.02em] mb-3">
              {phase === "timeout"
                ? "Taking longer than expected"
                : confirmed
                ? "Welcome to Bullion Desk Beta"
                : "Confirming your payment…"}
            </h1>

            <p className="text-[color:var(--muted)] text-[14px] leading-relaxed mb-8">
              {phase === "timeout"
                ? "Your payment was received. Access activation may take a few more seconds."
                : confirmed
                ? "Your access is now active. The full institutional gold analysis engine is unlocked."
                : "Processing your payment confirmation. This takes just a moment."}
            </p>

            <div className="rounded-2xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.04)] px-5 py-4 mb-7">
              <p className="text-[13px] text-[rgba(212,175,55,0.85)]">
                {phase === "timeout"
                  ? "Click below to access your account — your payment is confirmed by Stripe."
                  : confirmed
                  ? "Full access granted — no restrictions, no recurring charges."
                  : statusMsg}
              </p>
            </div>

            {/* CTA — shown when confirmed or timeout */}
            {(confirmed || phase === "timeout") && (
              <button
                onClick={() => { router.push("/"); router.refresh(); }}
                className="block w-full rounded-2xl py-4 text-[14px] font-medium tracking-[0.06em] border border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.10)] text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.95)] text-center"
              >
                {phase === "timeout" ? "Access my account →" : "Go to Dashboard"}
              </button>
            )}

            {/* Status footer */}
            <div className="mt-5 flex items-center justify-center gap-3 min-h-[20px]">
              {phase === "verifying" && (
                <span className="text-[11px] text-white/25 animate-pulse">{statusMsg}</span>
              )}
              {(phase === "countdown" || phase === "redirecting") && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessContent />
    </Suspense>
  );
}
