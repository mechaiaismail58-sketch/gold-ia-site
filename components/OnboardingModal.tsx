"use client";

import { useState } from "react";

type Props = {
  onComplete: () => void;
};

type Horizon = "scalp" | "daytrade" | "swing";
type AccountSize = "under_5k" | "5k_25k" | "25k_100k" | "100k_plus";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

const HORIZON_OPTIONS: { value: Horizon; label: string; desc: string }[] = [
  { value: "scalp",    label: "Scalp",     desc: "Minutes to hours" },
  { value: "daytrade", label: "Day Trade", desc: "Within the session" },
  { value: "swing",    label: "Swing",     desc: "Multi-day positions" },
];

const ACCOUNT_OPTIONS: { value: AccountSize; label: string }[] = [
  { value: "under_5k",   label: "Under $5k" },
  { value: "5k_25k",     label: "$5k – $25k" },
  { value: "25k_100k",   label: "$25k – $100k" },
  { value: "100k_plus",  label: "$100k+" },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "Learning the framework" },
  { value: "intermediate", label: "Intermediate", desc: "Comfortable with technicals" },
  { value: "advanced",     label: "Advanced",     desc: "Institutional-level trading" },
];

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [accountSize, setAccountSize] = useState<AccountSize | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const steps = [
    { title: "What is your trading horizon?", subtitle: "This calibrates the analysis framework to your style." },
    { title: "What is your approximate account size?", subtitle: "Used to calibrate position sizing guidance." },
    { title: "What is your experience level?", subtitle: "This adjusts the complexity of explanations and risk notes." },
  ];

  const canProceed = [
    horizon !== null,
    accountSize !== null,
    experienceLevel !== null,
  ][step];

  async function handleFinish() {
    if (!horizon || !accountSize || !experienceLevel) return;
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trading_horizon: horizon,
          account_size: accountSize,
          experience_level: experienceLevel,
        }),
      });
    } catch {
      // Non-blocking — proceed anyway
    } finally {
      setSaving(false);
      onComplete();
    }
  }

  function handleNext() {
    if (step < 2) setStep((s) => s + 1);
    else handleFinish();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(7,6,11,0.88)", backdropFilter: "blur(12px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(10,8,18,0.95)] shadow-[0_0_80px_rgba(212,175,55,0.07)] p-6 sm:p-8">

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i <= step ? "#D4AF37" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[rgba(212,175,55,0.6)] mb-2">
            Bullion Desk — Profile Setup {step + 1}/3
          </div>
          <h2 className="text-[20px] font-semibold text-white leading-snug">
            {steps[step].title}
          </h2>
          <p className="text-[13px] text-white/35 mt-1">{steps[step].subtitle}</p>
        </div>

        {/* Step 0 — Horizon */}
        {step === 0 && (
          <div className="flex flex-col gap-2">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHorizon(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: horizon === opt.value ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.08)",
                  background: horizon === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[13px] font-medium" style={{ color: horizon === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — Account size */}
        {step === 1 && (
          <div className="flex flex-col gap-2">
            {ACCOUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAccountSize(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: accountSize === opt.value ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.08)",
                  background: accountSize === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[13px] font-medium" style={{ color: accountSize === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Experience */}
        {step === 2 && (
          <div className="flex flex-col gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExperienceLevel(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: experienceLevel === opt.value ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.08)",
                  background: experienceLevel === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[13px] font-medium" style={{ color: experienceLevel === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-[12px] text-white/30 hover:text-white/60 transition"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || saving}
            className="rounded-xl px-6 py-2.5 min-h-[44px] text-[14px] font-medium tracking-wide transition"
            style={{
              border: "1px solid rgba(212,175,55,0.55)",
              color: canProceed ? "#D4AF37" : "rgba(212,175,55,0.3)",
              opacity: canProceed ? 1 : 0.5,
              cursor: canProceed ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : step < 2 ? "Next" : "Start Trading"}
          </button>
        </div>

      </div>
    </div>
  );
}
