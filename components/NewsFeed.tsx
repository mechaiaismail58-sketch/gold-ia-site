"use client";

import { useEffect, useState, useCallback } from "react";

type SentimentTag = "Bullish" | "Bearish" | "Neutral";

type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  tag: SentimentTag;
};

function fmtUtcTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m} UTC`;
}

// Sentiment reuses the brief's three-tier palette (red / gold / white-30) —
// the feed only computes directional sentiment server-side, not a separate
// impact score, so bearish/bullish/neutral map onto that palette directly.
const TAG_CONFIG: Record<SentimentTag, { label: string; color: string }> = {
  Bearish: { label: "BEARISH", color: "text-red-400/70" },
  Bullish: { label: "BULLISH", color: "text-[#D4A843]/80" },
  Neutral: { label: "NEUTRAL", color: "text-white/30" },
};

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 border-b border-white/[0.05] py-4">
      <div className="mt-1 h-3 w-14 shrink-0 animate-pulse rounded bg-white/[0.06]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export default function NewsFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setLastUpdate(new Date());
        setStatus("ready");
      } else {
        setError(data.error ?? "No items returned");
        setStatus("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Derived counts for the tag summary bar
  const counts = items.reduce(
    (acc, item) => {
      acc[item.tag] = (acc[item.tag] ?? 0) + 1;
      return acc;
    },
    {} as Record<SentimentTag, number>
  );

  const statusDotColor =
    status === "loading" ? "bg-white/25" : status === "error" ? "bg-red-400" : "bg-emerald-400";
  const statusLabel = status === "loading" ? "Loading" : status === "error" ? "Error" : "Live";

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
            Macro Intelligence Feed
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`}
              style={status === "ready" ? { boxShadow: "0 0 0 3px rgba(52,211,153,0.15)" } : undefined}
            />
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/25">
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="hidden text-[10px] font-mono text-white/20 sm:block">
              {fmtUtcTime(lastUpdate.toISOString())}
            </span>
          )}
          <button
            onClick={fetchNews}
            className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/30 transition-opacity hover:opacity-100 opacity-70 hover:text-white/70"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tag summary bar (only when items loaded) ── */}
      {status === "ready" && items.length > 0 && (
        <div className="flex items-center gap-4 border-b border-white/[0.04] py-2.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/20">
            Sentiment
          </span>
          {(["Bullish", "Bearish", "Neutral"] as SentimentTag[]).map((tag) => {
            const cfg = TAG_CONFIG[tag];
            const count = counts[tag] ?? 0;
            return (
              <div key={tag} className="flex items-center gap-1.5">
                <span className={`text-[11px] font-mono ${cfg.color}`}>{count}</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.10em] text-white/20">
                  {tag}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Feed body ── */}
      <div>
        {status === "loading" && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-white/50">Feed unavailable</p>
            {error && <p className="text-xs font-mono text-white/25">{error}</p>}
            <button
              onClick={fetchNews}
              className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.08em] text-white/60 transition-opacity hover:opacity-100 opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-white/35">No news available</p>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <div className="divide-y divide-white/[0.05]">
            {items.map((item) => {
              const cfg = TAG_CONFIG[item.tag];
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 py-4 text-left opacity-80 transition-opacity hover:opacity-100"
                >
                  <span className={`mt-1.5 shrink-0 text-[9px] font-mono uppercase tracking-[0.1em] ${cfg.color}`}>
                    {cfg.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[16px] leading-snug text-white/85">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-[11px] font-mono text-white/30">
                      <span className="text-white/45">{item.source}</span>
                      {" · "}
                      {fmtUtcTime(item.publishedAt)}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
