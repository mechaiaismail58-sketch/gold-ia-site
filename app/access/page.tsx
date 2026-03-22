"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GoldKeyIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8">
      <circle cx="14" cy="16" r="7" stroke="currentColor" strokeWidth="1.4" opacity="0.7" />
      <circle cx="14" cy="16" r="3" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="21" y1="16" x2="36" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <line x1="30" y1="16" x2="30" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <line x1="34" y1="16" x2="34" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function AccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  // Normal verify state
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup profile state (when no profile row exists)
  const [showSetup, setShowSetup] = useState(false);
  const [setupCode, setSetupCode] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  // Forgot code state
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.profileNotFound) {
          setShowSetup(true);
          setError("");
          return;
        }
        setError(data.error || "Code incorrect.");
        setCode("");
        inputRef.current?.focus();
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupProfile(e: React.FormEvent) {
    e.preventDefault();
    setSetupError("");

    if (setupCode !== setupConfirm) { setSetupError("Les codes ne correspondent pas."); return; }
    if (setupCode.length < 3) { setSetupError("Min. 3 caractères."); return; }
    if (!/[a-zA-Z]/.test(setupCode)) { setSetupError("Doit contenir une lettre."); return; }
    if (!/[0-9]/.test(setupCode)) { setSetupError("Doit contenir un chiffre."); return; }
    if (!/[^a-zA-Z0-9]/.test(setupCode)) { setSetupError("Doit contenir un caractère spécial."); return; }

    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/setup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: setupCode, confirmCode: setupConfirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || "Erreur lors de la configuration.");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setSetupError("Erreur réseau.");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleForgotCode() {
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || "Erreur lors de l'envoi.");
        return;
      }
      setForgotSent(true);
    } catch {
      setForgotError("Erreur réseau.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07060b] flex flex-col items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-80px] left-[50%] -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
        <div className="absolute bottom-[-100px] left-[30%] h-[400px] w-[400px] rounded-full bg-[rgba(200,162,74,0.06)] blur-[130px]" />
      </div>

      <div className="w-full max-w-[340px] flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="text-[16px] tracking-[0.24em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </div>
        </div>

        {/* Icon */}
        <div className="mb-8 text-[color:var(--gold)] opacity-70">
          <GoldKeyIcon />
        </div>

        {/* ── SETUP PROFILE MODE ── */}
        {showSetup ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-[20px] tracking-[-0.02em]">Configurer votre accès</h1>
              <p className="mt-2 text-[13px] text-[color:var(--muted)] leading-relaxed">
                Votre profil n'est pas encore configuré.<br />
                Choisissez un code d'accès personnel.
              </p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.4)] to-transparent mb-8" />

            <form onSubmit={handleSetupProfile} className="w-full space-y-4">
              <input
                type="password"
                required
                autoFocus
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                placeholder="Nouveau code (lettre + chiffre + spécial)"
                className="w-full rounded-2xl px-5 py-4 bg-transparent border border-[color:var(--border)] text-white text-[14px] focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/20"
              />
              <input
                type="password"
                required
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                placeholder="Confirmer le code"
                className="w-full rounded-2xl px-5 py-4 bg-transparent border border-[color:var(--border)] text-white text-[14px] focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/20"
              />

              {setupError && (
                <p className="text-[12px] text-red-400 text-center border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                  {setupError}
                </p>
              )}

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full rounded-2xl py-4 text-xs uppercase tracking-[0.18em] border border-[rgba(109,40,217,0.55)] text-white transition hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-40"
              >
                {setupLoading ? "Enregistrement…" : "Définir ce code"}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* ── NORMAL VERIFY MODE ── */}
            <div className="text-center mb-8">
              <h1 className="text-[20px] tracking-[-0.02em]">Accès sécurisé</h1>
              <p className="mt-2 text-[13px] text-[color:var(--muted)] leading-relaxed">
                Entrez votre code d'accès personnel pour continuer.
              </p>
            </div>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.4)] to-transparent mb-8" />

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <input
                ref={inputRef}
                type="password"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Code d'accès"
                className="w-full rounded-2xl px-5 py-4 bg-transparent border border-[color:var(--border)] text-white text-center text-[16px] tracking-[0.18em] focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/20 placeholder:tracking-normal"
              />

              {error && (
                <p className="text-[12px] text-red-400 text-center border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full rounded-2xl py-4 text-xs uppercase tracking-[0.18em] border border-[rgba(109,40,217,0.55)] text-white transition hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Vérification…" : "Confirmer"}
              </button>
            </form>

            {/* Forgot code */}
            <div className="mt-6 text-center">
              {forgotSent ? (
                <p className="text-[12px] text-emerald-400">
                  Lien envoyé à votre adresse email. Vérifiez votre boîte.
                </p>
              ) : (
                <>
                  <button
                    onClick={handleForgotCode}
                    disabled={forgotLoading}
                    className="text-[12px] text-white/30 hover:text-white/60 transition disabled:opacity-40"
                  >
                    {forgotLoading ? "Envoi…" : "Code oublié ?"}
                  </button>
                  {forgotError && (
                    <p className="mt-2 text-[11px] text-red-400">{forgotError}</p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <p className="mt-10 text-[11px] text-white/20 tracking-[0.08em] text-center">
          Ce code est demandé à chaque nouvelle session.
        </p>
      </div>
    </div>
  );
}

export default function AccessPage() {
  return (
    <Suspense>
      <AccessForm />
    </Suspense>
  );
}
