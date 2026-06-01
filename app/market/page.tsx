"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GoldTradingViewChart from "../../components/GoldTradingViewChart";

type TickerItem = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  decimals:      number;
  prefix?:       string;
  suffix?:       string;
};

type NewsItem = {
  id:          string;
  title:       string;
  source:      string;
  url:         string;
  publishedAt: string;
  tag:         "Bullish" | "Bearish" | "Neutral";
};

type CalendarEvent = {
  id:       string;
  title:    string;
  country:  string;
  date:     string;
  impact:   "high" | "medium" | "low";
  forecast: string | null;
  previous: string | null;
};

function categorizeNews(title: string): "FED" | "TRUMP" | "GEO" | "DATA" | "GOLD" {
  const t = title.toLowerCase();
  if (/\bfed\b|powell|fomc|hawkish|dovish|rate hike|rate cut|monetary policy|fed chair|warsh|jerome|boe|ecb|central bank rate/.test(t)) return "FED";
  if (/trump|tariff|trade war|maga|white house|executive order/.test(t)) return "TRUMP";
  if (/\bwar\b|conflict|sanction|geopolit|middle east|russia|ukraine|iran|israel|gaza|nato|military/.test(t)) return "GEO";
  if (/\bcpi\b|\bnfp\b|\bgdp\b|\bpce\b|\bppi\b|payroll|jobs report|unemployment|retail sales|\bism\b|\bpmi\b|inflation data/.test(t)) return "DATA";
  return "GOLD";
}

const NEWS_TAG_STYLES: Record<string, string> = {
  FED:   "text-[color:var(--gold)] bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]",
  TRUMP: "text-red-400 bg-red-500/10 border border-red-500/20",
  GEO:   "text-orange-400 bg-orange-500/10 border border-orange-500/20",
  DATA:  "text-blue-400 bg-blue-500/10 border border-blue-500/20",
  GOLD:  "text-[color:var(--gold)] bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUtc(dateStr: string): string {
  const d = new Date(dateStr);
  const wd  = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "2-digit", month: "short", timeZone: "UTC" });
  const t   = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${wd} ${day} ${t} UTC`;
}

export default function MarketPage() {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [news,    setNews]    = useState<NewsItem[]>([]);
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now48h = Date.now() + 48 * 60 * 60 * 1_000;

    Promise.all([
      fetch("/api/ticker").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/news").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/calendar").then((r) => r.json()).catch(() => ({ events: [] })),
    ]).then(([tickerData, newsData, calData]) => {
      setTickers(tickerData.items ?? []);
      setNews((newsData.items ?? []).slice(0, 10));
      const filtered = (calData.events ?? []).filter((e: CalendarEvent) => {
        const t = new Date(e.date).getTime();
        return t >= Date.now() && t <= now48h;
      });
      setEvents(filtered);
      setLoading(false);
    });
  }, []);

  const xau = tickers.find((t) => t.symbol === "XAUUSD");
  const dxy = tickers.find((t) => t.symbol === "DXY");
  const y10 = tickers.find((t) => t.symbol === "US10Y");
  const xag = tickers.find((t) => t.symbol === "XAGUSD");
  const vix = tickers.find((t) => t.symbol === "VIX");

  const gsRatio =
    xau && xag && xag.price > 0
      ? (xau.price / xag.price).toFixed(1)
      : "—";

  function fmtPrice(item?: TickerItem) {
    if (!item) return loading ? "..." : "—";
    const val = item.price.toFixed(item.decimals);
    return `${item.prefix ?? ""}${val}${item.suffix ?? ""}`;
  }

  function fmtChg(item?: TickerItem) {
    if (!item) return { text: "", up: true };
    const up = item.changePercent >= 0;
    return { text: `${up ? "+" : ""}${item.changePercent.toFixed(2)}%`, up };
  }

  const sortedEvents = [...events].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    const impact = order[a.impact] - order[b.impact];
    if (impact !== 0) return impact;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <main className="text-white space-y-6">

      {/* ── Section 1 — Price & Metrics ── */}
      <section className="card rounded-3xl p-6 sm:p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-5">
          Live Market
        </div>

        {/* XAUUSD big price */}
        <div className="flex items-end gap-4 mb-6">
          <div className="text-[44px] sm:text-[58px] leading-none tracking-[-0.04em] font-light text-[color:var(--gold)]">
            {fmtPrice(xau)}
          </div>
          {xau && (
            <div
              className={`mb-2 text-[15px] font-medium ${
                fmtChg(xau).up ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {fmtChg(xau).text}
            </div>
          )}
        </div>

        {/* 4 metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "DXY",          value: fmtPrice(dxy), chg: fmtChg(dxy), hasItem: !!dxy },
            { label: "10Y Yield",    value: fmtPrice(y10), chg: fmtChg(y10), hasItem: !!y10 },
            { label: "VIX",          value: fmtPrice(vix), chg: fmtChg(vix), hasItem: !!vix },
            // TODO: réactiver quand l'API est branchée
            // { label: "Gold / Silver", value: gsRatio, chg: null, hasItem: !!xau && !!xag },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 mb-1.5">
                {m.label}
              </div>
              <div className="text-[17px] tracking-[-0.02em]">
                {m.hasItem || m.label === "Gold / Silver" ? m.value : loading ? "..." : "—"}
              </div>
              {m.chg && m.hasItem && (
                <div
                  className={`mt-0.5 text-[11px] ${
                    m.chg.up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {m.chg.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2 — TradingView Chart ── */}
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#07060b] shadow-[0_18px_90px_rgba(109,40,217,0.18)]">
        <GoldTradingViewChart />
      </section>

      {/* TODO: réactiver quand l'API est branchée */}
      {/* Section 3 — News (masquée temporairement — API /api/news non branchée)
      <section className="card rounded-3xl p-6 sm:p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-5">
          Recent News
        </div>

        {loading ? (
          <p className="text-[12px] font-mono text-white/30">
            News feed loading... Check back shortly.
          </p>
        ) : news.length === 0 ? (
          <p className="text-[12px] font-mono text-white/30">
            News feed loading... Check back shortly.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {news.map((item) => {
              const cat = categorizeNews(item.title);
              return (
                <li key={item.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono tracking-[0.08em] uppercase font-medium ${NEWS_TAG_STYLES[cat]}`}
                  >
                    {cat}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-[12px] font-mono text-[color:var(--muted)] hover:text-white/70 leading-4 transition-colors line-clamp-2"
                  >
                    {item.title}
                  </a>
                  <span className="shrink-0 text-[10px] font-mono text-white/20 whitespace-nowrap">
                    {timeAgo(item.publishedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      */}

      {/* ── Section 4 — Economic Calendar ── */}
      <section className="card rounded-3xl p-6 sm:p-8 border border-white/10">
        <div className="text-xs tracking-[0.18em] uppercase text-[color:var(--muted)] mb-5">
          Economic Calendar — Next 48h
        </div>

        {loading ? (
          <p className="text-[12px] font-mono text-white/30">Loading calendar...</p>
        ) : sortedEvents.length === 0 ? (
          <p className="text-[12px] font-mono text-white/30">
            No major USD events in the next 48 hours.
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedEvents.map((evt) => (
              <li
                key={evt.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-medium ${
                    evt.impact === "high"
                      ? "bg-red-500/15 text-red-400 border border-red-500/25"
                      : evt.impact === "medium"
                      ? "bg-[rgba(212,175,55,0.12)] text-[color:var(--gold)] border border-[rgba(212,175,55,0.25)]"
                      : "bg-white/5 text-white/35 border border-white/10"
                  }`}
                >
                  {evt.impact}
                </span>
                <span className="flex-1 text-[13px] text-white/80 truncate">{evt.title}</span>
                <span className="shrink-0 text-[11px] font-mono text-white/30 whitespace-nowrap">
                  {fmtUtc(evt.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Section 5 — CTA ── */}
      <section className="pb-4 text-center">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.07)] px-6 py-3 text-[13px] text-[color:var(--gold)] transition-colors hover:bg-[rgba(212,175,55,0.12)]"
        >
          Get AI Analysis →
        </Link>
      </section>

    </main>
  );
}
