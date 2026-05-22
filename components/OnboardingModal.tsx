"use client";

import { useState } from "react";

type Props = {
  onComplete: () => void;
};

type AccountType = "prop_firm" | "personal" | "both";
type PropFirm = "FTMO" | "The5ers" | "Apex" | "E8" | "FundedNext" | "BlueGuardian" | "AlphaCapital" | "Other";
type PropFirmPhase = "challenge_1" | "challenge_2" | "funded" | "personal";
type AccountSize = "under_5k" | "5k_25k" | "25k_100k" | "100k_plus";
type PrimaryAsset = "forex" | "metals" | "indices" | "futures" | "energy" | "crypto";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string; desc: string }[] = [
  { value: "prop_firm", label: "Prop Firm", desc: "Capital fourni par une firme de financement" },
  { value: "personal",  label: "Capital Personnel", desc: "Je trade avec mon propre capital" },
  { value: "both",      label: "Les Deux", desc: "Prop firm + capital personnel" },
];

const PROP_FIRM_OPTIONS: { value: PropFirm; label: string }[] = [
  { value: "FTMO",         label: "FTMO" },
  { value: "The5ers",      label: "The5ers" },
  { value: "Apex",         label: "Apex Trader Funding" },
  { value: "E8",           label: "E8 Funding" },
  { value: "FundedNext",   label: "Funded Next" },
  { value: "BlueGuardian", label: "Blue Guardian" },
  { value: "AlphaCapital", label: "Alpha Capital" },
  { value: "Other",        label: "Autre" },
];

const PHASE_OPTIONS: { value: PropFirmPhase; label: string; desc: string }[] = [
  { value: "challenge_1", label: "Challenge Phase 1", desc: "En cours d'évaluation initiale" },
  { value: "challenge_2", label: "Challenge Phase 2", desc: "En cours d'évaluation finale" },
  { value: "funded",      label: "Funded / Live",     desc: "Compte financé actif" },
  { value: "personal",    label: "Compte perso",      desc: "Pas de phase active en ce moment" },
];

const ACCOUNT_OPTIONS: { value: AccountSize; label: string }[] = [
  { value: "under_5k",  label: "Moins de $5k" },
  { value: "5k_25k",    label: "$5k – $25k" },
  { value: "25k_100k",  label: "$25k – $100k" },
  { value: "100k_plus", label: "$100k+" },
];

const ASSET_OPTIONS: { value: PrimaryAsset; label: string; desc: string }[] = [
  { value: "forex",   label: "Forex",           desc: "EURUSD, GBPUSD, USDJPY…" },
  { value: "metals",  label: "Métaux Précieux",  desc: "Gold, Silver, Platinum…" },
  { value: "indices", label: "Indices",          desc: "SPX, NAS100, DAX40…" },
  { value: "futures", label: "Futures",          desc: "ES, NQ, GC, CL…" },
  { value: "energy",  label: "Énergie",          desc: "WTI, Brent, Natural Gas" },
  { value: "crypto",  label: "Crypto",           desc: "BTC, ETH (analyse macro)" },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Débutant",      desc: "En apprentissage du framework" },
  { value: "intermediate", label: "Intermédiaire", desc: "À l'aise avec les techniques" },
  { value: "advanced",     label: "Avancé",        desc: "Niveau institutionnel" },
];

const GOLD_BTN = "rgba(212,175,55,0.6)";
const DIM_BTN  = "rgba(255,255,255,0.08)";

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [accountType, setAccountType]     = useState<AccountType | null>(null);
  const [propFirm, setPropFirm]           = useState<PropFirm | null>(null);
  const [propFirmPhase, setPropFirmPhase] = useState<PropFirmPhase | null>(null);
  const [accountSize, setAccountSize]     = useState<AccountSize | null>(null);
  const [primaryAssets, setPrimaryAssets] = useState<PrimaryAsset[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const usesPropFirm = accountType === "prop_firm" || accountType === "both";

  const STEPS = [
    { title: "Quel type de compte utilisez-vous ?",       subtitle: "Cela détermine les règles de gestion appliquées à vos analyses." },
    ...(usesPropFirm
      ? [
          { title: "Quelle prop firm ?",                    subtitle: "Pour appliquer les règles exactes de votre firme." },
          { title: "Dans quelle phase êtes-vous ?",         subtitle: "La gestion du risque diffère selon la phase." },
        ]
      : []),
    { title: "Taille approximative du compte ?",           subtitle: "Pour calibrer les conseils de sizing." },
    { title: "Quels actifs tradez-vous principalement ?",  subtitle: "Plusieurs choix possibles." },
    { title: "Votre niveau d'expérience ?",                subtitle: "Ajuste la complexité et le vocabulaire des analyses." },
  ];

  const totalSteps = STEPS.length;

  const stepValues: (boolean)[] = [
    accountType !== null,
    ...(usesPropFirm ? [propFirm !== null, propFirmPhase !== null] : []),
    accountSize !== null,
    primaryAssets.length > 0,
    experienceLevel !== null,
  ];

  const canProceed = stepValues[step] ?? false;

  function toggleAsset(asset: PrimaryAsset) {
    setPrimaryAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  }

  async function handleFinish() {
    if (!accountType || !accountSize || !experienceLevel || primaryAssets.length === 0) return;
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_type: accountType,
          prop_firm: propFirm ?? null,
          prop_firm_phase: propFirmPhase ?? (usesPropFirm ? null : "personal"),
          account_size: accountSize,
          primary_assets: primaryAssets,
          experience_level: experienceLevel,
          trading_horizon: "daytrade",
        }),
      });
    } catch {
      // Non-blocking
    } finally {
      setSaving(false);
      onComplete();
    }
  }

  function handleNext() {
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else handleFinish();
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  // Determine which conceptual step we're on
  const isAccountTypeStep  = step === 0;
  const isPropFirmStep     = usesPropFirm && step === 1;
  const isPhaseStep        = usesPropFirm && step === 2;
  const isAccountSizeStep  = step === (usesPropFirm ? 3 : 1);
  const isPrimaryAssetsStep = step === (usesPropFirm ? 4 : 2);
  const isExperienceStep   = step === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(7,6,11,0.88)", backdropFilter: "blur(12px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-[rgba(212,175,55,0.18)] bg-[rgba(10,8,18,0.95)] shadow-[0_0_80px_rgba(212,175,55,0.07)] p-6 sm:p-8">

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
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
            BullionDesk — Profil Trader {step + 1}/{totalSteps}
          </div>
          <h2 className="text-[20px] font-semibold text-white leading-snug">
            {STEPS[step].title}
          </h2>
          <p className="text-[13px] text-white/35 mt-1">{STEPS[step].subtitle}</p>
        </div>

        {/* Step: Account Type */}
        {isAccountTypeStep && (
          <div className="flex flex-col gap-2">
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setAccountType(opt.value); setPropFirm(null); setPropFirmPhase(null); }}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: accountType === opt.value ? GOLD_BTN : DIM_BTN,
                  background: accountType === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[13px] font-medium" style={{ color: accountType === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Prop Firm */}
        {isPropFirmStep && (
          <div className="grid grid-cols-2 gap-2">
            {PROP_FIRM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPropFirm(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[48px] text-left transition"
                style={{
                  borderColor: propFirm === opt.value ? GOLD_BTN : DIM_BTN,
                  background: propFirm === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[12px] font-medium" style={{ color: propFirm === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Phase */}
        {isPhaseStep && (
          <div className="flex flex-col gap-2">
            {PHASE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPropFirmPhase(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: propFirmPhase === opt.value ? GOLD_BTN : DIM_BTN,
                  background: propFirmPhase === opt.value ? "rgba(212,175,55,0.07)" : "transparent",
                }}
              >
                <div className="text-[13px] font-medium" style={{ color: propFirmPhase === opt.value ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step: Account Size */}
        {isAccountSizeStep && (
          <div className="flex flex-col gap-2">
            {ACCOUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAccountSize(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: accountSize === opt.value ? GOLD_BTN : DIM_BTN,
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

        {/* Step: Primary Assets (multi-select) */}
        {isPrimaryAssetsStep && (
          <div className="flex flex-col gap-2">
            {ASSET_OPTIONS.map((opt) => {
              const selected = primaryAssets.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleAsset(opt.value)}
                  className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition flex items-center gap-3"
                  style={{
                    borderColor: selected ? GOLD_BTN : DIM_BTN,
                    background: selected ? "rgba(212,175,55,0.07)" : "transparent",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition"
                    style={{
                      border: selected ? "1.5px solid #D4AF37" : "1.5px solid rgba(255,255,255,0.2)",
                      background: selected ? "rgba(212,175,55,0.15)" : "transparent",
                    }}
                  >
                    {selected && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: selected ? "#D4AF37" : "rgba(255,255,255,0.75)" }}>
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step: Experience */}
        {isExperienceStep && (
          <div className="flex flex-col gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExperienceLevel(opt.value)}
                className="rounded-xl border px-4 py-3 min-h-[52px] text-left transition"
                style={{
                  borderColor: experienceLevel === opt.value ? GOLD_BTN : DIM_BTN,
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
              onClick={handleBack}
              className="text-[12px] text-white/30 hover:text-white/60 transition"
            >
              Retour
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
            {saving ? "Saving…" : step < totalSteps - 1 ? "Suivant" : "Commencer"}
          </button>
        </div>

      </div>
    </div>
  );
}
