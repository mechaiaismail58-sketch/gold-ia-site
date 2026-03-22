"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetCodePage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (accessCode !== confirmCode) {
      setError("Les codes ne correspondent pas.");
      return;
    }
    if (accessCode.length < 3) {
      setError("Code trop court (min. 3 caractères).");
      return;
    }
    if (!/[a-zA-Z]/.test(accessCode)) {
      setError("Le code doit contenir au moins une lettre.");
      return;
    }
    if (!/[0-9]/.test(accessCode)) {
      setError("Le code doit contenir au moins un chiffre.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(accessCode)) {
      setError("Le code doit contenir au moins un caractère spécial.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode, confirmCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la mise à jour.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07060b] flex flex-col items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-80px] left-[50%] -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
      </div>

      <div className="w-full max-w-[340px]">
        <div className="text-center mb-10">
          <div className="text-[16px] tracking-[0.24em] uppercase text-white mb-1">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </div>
        </div>

        <div className="card border border-white/10 rounded-2xl p-8">
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">Sécurité</div>
            <h1 className="text-[20px] tracking-[-0.02em]">Nouveau code d'accès</h1>
            <p className="mt-1 text-[12px] text-[color:var(--muted)]">
              Choisissez un nouveau code personnel.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                Nouveau code <span className="text-white/30">(lettre + chiffre + spécial)</span>
              </label>
              <input
                type="password"
                required
                autoFocus
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Votre nouveau code"
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-sm focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                Confirmer le code
              </label>
              <input
                type="password"
                required
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="Répétez le code"
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-sm focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
              />
            </div>

            {error && (
              <p className="text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-xs uppercase tracking-[0.14em] border border-[rgba(109,40,217,0.55)] text-white transition hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-50 mt-2"
            >
              {loading ? "Enregistrement…" : "Définir ce code"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
            <Link href="/access" className="text-[12px] text-[color:var(--muted)] hover:text-white transition">
              Retour
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
