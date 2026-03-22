"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 animate-fade-in">
      {/* Background blobs */}
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

        {/* Card */}
        <div className="card border border-white/10 rounded-3xl overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.50)] to-transparent" />

          <div className="p-8 sm:p-10">
            {/* Checkmark icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,175,55,0.30)] bg-[rgba(212,175,55,0.06)]">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M5 14l7 7L23 7"
                  stroke="#D4AF37"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className="text-[26px] sm:text-[30px] leading-[1.2] tracking-[-0.02em] mb-3">
              Welcome to Bullion Desk Beta
            </h1>
            <p className="text-[color:var(--muted)] text-[14px] leading-relaxed mb-8">
              Your access is now active. The full institutional gold analysis engine is unlocked.
            </p>

            <div className="rounded-2xl border border-[rgba(212,175,55,0.20)] bg-[rgba(212,175,55,0.04)] px-5 py-4 mb-7">
              <p className="text-[13px] text-[rgba(212,175,55,0.85)]">
                Full access granted — no restrictions, no recurring charges.
              </p>
            </div>

            <Link
              href="/"
              className="block w-full rounded-2xl py-4 text-[14px] font-medium tracking-[0.06em] border border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.10)] text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.18)] hover:border-[rgba(212,175,55,0.95)] text-center"
            >
              Go to Dashboard
            </Link>

            <p className="mt-4 text-[11px] text-white/20">
              Redirecting automatically in {countdown}s…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
