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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TAG_CONFIG: Record<
  SentimentTag,
  { label: string; pill: string; dot: string }
> = {
  Bullish: {
    label: "BULLISH",
    pill: "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400",
    dot: "bg-emerald-400",
  },
  Bearish: {
    label: "BEARISH",
    pill: "bg-red-500/10 border border-red-500/30 text-red-400",
    dot: "bg-red-400",
  },
  Neutral: {
    label: "NEUTRAL",
    pill: "bg-white/5 border border-white/10 text-white/40",
    dot: "bg-white/30",
  },
};

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 border-b border-white/5 px-5 py-3 sm:px-6">
      <div className="mt-0.5 h-4 w-14 shrink-0 animate-pulse rounded-md bg-white/8" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-full animate-pulse rounded bg-white/8" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-white/6" />
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
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

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] shadow-[0_18px_80px_rgba(109,40,217,0.15)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.18em] text-white/60">
            Macro Intelligence Feed
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "loading"
                  ? "bg-white/25"
                  : status === "error"
                  ? "bg-red-400"
                  : "animate-pulse bg-emerald-400"
              }`}
            />
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">
              {status === "loading" ? "Loading" : status === "error" ? "Error" : "Live"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="hidden text-[10px] text-white/25 sm:block">
              {timeAgo(lastUpdate.toISOString())}
            </span>
          )}
          <button
            onClick={fetchNews}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/45 transition hover:border-white/20 hover:text-white/80"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tag summary bar (only when items loaded) ── */}
      {status === "ready" && items.length > 0 && (
        <div className="flex items-center gap-4 border-b border-white/5 bg-white/[0.015] px-5 py-2 sm:px-6">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/30">
            Sentiment
          </span>
          {(["Bullish", "Bearish", "Neutral"] as SentimentTag[]).map((tag) => {
            const cfg = TAG_CONFIG[tag];
            const count = counts[tag] ?? 0;
            return (
              <div key={tag} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                <span className="text-[11px] text-white/50">
                  {count}
                </span>
                <span className="text-[10px] uppercase tracking-[0.10em] text-white/25">
                  {tag}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Feed body ── */}
      <div className="h-[288px] overflow-y-auto">
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
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm text-white/50">Feed unavailable</p>
            {error && <p className="text-xs text-white/25">{error}</p>}
            <button
              onClick={fetchNews}
              className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.08em] text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-white/35">No news available</p>
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <div className="divide-y divide-white/5">
            {items.map((item) => {
              const cfg = TAG_CONFIG[item.tag];
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-5 py-3 transition hover:bg-white/[0.025] sm:px-6"
                >
                  <span
                    className={`mt-[3px] shrink-0 rounded-md px-1.5 py-[3px] text-[9px] font-semibold uppercase tracking-[0.10em] ${cfg.pill}`}
                  >
                    {cfg.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] leading-5 text-white/80 transition group-hover:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-white/30">
                      <span className="text-white/45">{item.source}</span>
                      {" · "}
                      {timeAgo(item.publishedAt)}
                    </p>
                  </div>

                  <svg
                    className="mt-1 h-3 w-3 shrink-0 text-white/15 transition group-hover:text-white/40"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
