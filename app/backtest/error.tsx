"use client";

import { useEffect } from "react";

export default function BacktestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[BacktestError]", error);
  }, [error]);

  return (
    <div className="card rounded-3xl border border-white/10 p-12 text-center animate-fade-in">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3">
        Backtest
      </div>
      <h2 className="text-[20px] tracking-[-0.02em] mb-3">
        Impossible de charger les données
      </h2>
      <p className="text-sm text-white/40 max-w-[44ch] mx-auto leading-6 mb-8">
        La connexion à Notion a échoué. Vérifiez votre token Notion et l'ID de la base de données.
      </p>
      <button
        onClick={reset}
        className="rounded-xl border border-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.10em] text-white/60 hover:border-white/20 hover:text-white transition"
      >
        Réessayer
      </button>
    </div>
  );
}
