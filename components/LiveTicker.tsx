"use client";

import { useEffect, useState } from "react";
import type { TickerItem } from "@/app/api/ticker/route";

/* ── One cell in the ticker strip ─────────────────────────── */
function TickerCell({ item }: { item: TickerItem }) {
  const up     = item.changePercent >= 0;
  const noData = item.price === 0;

  const priceStr = noData
    ? "—"
    : `${item.prefix ?? ""}${item.price.toFixed(item.decimals)}${item.suffix ?? ""}`;

  const pctStr = noData
    ? ""
    : `${up ? "+" : ""}${item.changePercent.toFixed(2)}%`;

  return (
    <span className="inline-flex items-center gap-2.5 px-5 shrink-0 select-none font-mono">
      {/* Violet dot separator */}
      <span
        aria-hidden
        className="h-[4px] w-[4px] rounded-full shrink-0 bg-[rgba(139,92,246,0.45)]"
      />

      {/* Symbol */}
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/45">
        {item.name}
      </span>

      {/* Price */}
      <span className="text-[12px] text-white tabular-nums">
        {priceStr}
      </span>

      {/* % change */}
      {!noData && (
        <span
          className={[
            "text-[11px] tabular-nums font-medium",
            up ? "text-emerald-400" : "text-red-400",
          ].join(" ")}
        >
          {pctStr}
        </span>
      )}
    </span>
  );
}

/* ── Placeholder cells while loading ──────────────────────── */
function TickerSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <span key={i} className="inline-flex items-center gap-2.5 px-5 shrink-0 font-mono">
          <span className="h-[4px] w-[4px] rounded-full bg-[rgba(139,92,246,0.25)]" />
          <span className="skeleton h-3 w-14 rounded" />
          <span className="skeleton h-3 w-18 rounded" />
          <span className="skeleton h-3 w-10 rounded" />
        </span>
      ))}
    </>
  );
}

/* ── Main ticker ───────────────────────────────────────────── */
export default function LiveTicker() {
  const [items, setItems]   = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetch_() {
    try {
      const res  = await fetch("/api/ticker", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items);
      }
    } catch {
      /* keep current items */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Quadruple the items so the seamless loop is invisible */
  const looped = [...items, ...items, ...items, ...items];

  return (
    <div className="relative overflow-hidden w-full py-1">
      {/* Left fade mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10"
        style={{
          background:
            "linear-gradient(to right, rgba(10,8,18,0.92) 0%, transparent 100%)",
        }}
      />
      {/* Right fade mask */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10"
        style={{
          background:
            "linear-gradient(to left, rgba(10,8,18,0.92) 0%, transparent 100%)",
        }}
      />

      <div
        className="flex items-center whitespace-nowrap"
        style={{
          animation: loading || items.length === 0
            ? undefined
            : "ticker-scroll 22s linear infinite",
          willChange: "transform",
        }}
      >
        {loading || items.length === 0 ? (
          <TickerSkeleton />
        ) : (
          looped.map((item, i) => (
            <TickerCell key={`${item.symbol}-${i}`} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
