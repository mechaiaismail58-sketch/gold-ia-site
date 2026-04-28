"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4 animate-fade-in">
      <div className="mb-6 h-12 w-12 rounded-2xl border border-red-500/20 bg-red-500/[0.06] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 6v5M10 14h.01M3 10a7 7 0 1 0 14 0 7 7 0 0 0-14 0Z"
            stroke="rgba(248,113,113,0.9)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>

      <div className="text-[11px] uppercase tracking-[0.18em] text-red-400/70 mb-2">
        System Error
      </div>
      <h2 className="text-[22px] tracking-[-0.02em] mb-3">
        Something went wrong
      </h2>
      <p className="text-sm text-white/45 max-w-[40ch] leading-6 mb-4">
        An unexpected error occurred. Your data is intact.
      </p>
      {error?.message && (
        <pre className="text-xs text-red-400/80 bg-red-500/5 border border-red-500/15 rounded-lg px-4 py-3 max-w-[80ch] text-left overflow-x-auto mb-8 whitespace-pre-wrap break-words">
          {error.message}{error.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      )}

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={reset}
          className="rounded-xl border border-[rgba(109,40,217,0.55)] px-6 py-3 text-xs uppercase tracking-[0.12em] text-white transition hover:border-[rgba(109,40,217,0.9)] hover:bg-[rgba(109,40,217,0.10)] min-h-[44px]"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-xl border border-white/10 px-6 py-3 text-xs uppercase tracking-[0.12em] text-white/50 transition hover:border-white/20 hover:text-white/70 min-h-[44px] flex items-center"
        >
          ← Back to home
        </a>
      </div>
    </div>
  );
}
