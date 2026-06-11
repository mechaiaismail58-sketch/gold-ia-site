"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CalendarEvent {
  time: string;
  event: string;
  impact: "HIGH" | "MED" | "LOW";
  forecast: string;
}

interface FinnhubEvent {
  event: string;
  time: string;
  country: string;
  impact: string;
  estimate: number | string | null;
  unit?: string;
}

// Static fallback — sorted chronologically (used if FinnHub is unavailable)
const FALLBACK_EVENTS: CalendarEvent[] = [
  { time: "08:30", event: "US Initial Jobless Claims", impact: "MED",  forecast: "215K" },
  { time: "10:00", event: "US PPI (YoY)",              impact: "MED",  forecast: "2.8%" },
  { time: "14:00", event: "FOMC Meeting Minutes",      impact: "HIGH", forecast: "—" },
  { time: "14:30", event: "US CPI (MoM)",              impact: "HIGH", forecast: "3.2%" },
  { time: "16:00", event: "Fed Chair Powell Speech",   impact: "HIGH", forecast: "—" },
];

const IMPACT_BADGE: Record<CalendarEvent["impact"], { background: string; color: string }> = {
  HIGH: { background: "rgba(212,168,67,0.15)", color: "#D4A843" },
  MED:  { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" },
  LOW:  { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" },
};

const IMPACT_BORDER: Record<CalendarEvent["impact"], string> = {
  HIGH: "2px solid #D4A843",
  MED:  "2px solid rgba(212,168,67,0.4)",
  LOW:  "2px solid rgba(255,255,255,0.08)",
};

function mapFinnhubImpact(impact: string): CalendarEvent["impact"] {
  const v = impact.toLowerCase();
  if (v === "high") return "HIGH";
  if (v === "medium") return "MED";
  return "LOW";
}

function toUtcTime(raw: string): string {
  // FinnHub times look like "2026-06-11 14:30:00" (UTC, no offset)
  const d = new Date(raw.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return raw;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ChatCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(FALLBACK_EVENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
      if (!apiKey) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const today = new Date().toISOString().split("T")[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

        const res = await fetch(
          `https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${tomorrow}&token=${apiKey}`
        );
        if (!res.ok) throw new Error("FinnHub request failed");

        const data = await res.json();
        const raw: FinnhubEvent[] = data?.economicCalendar ?? [];

        const mapped: CalendarEvent[] = raw
          .filter((e) => e.country === "US" && (e.impact === "high" || e.impact === "medium"))
          .map((e) => ({
            time: toUtcTime(e.time),
            event: e.event,
            impact: mapFinnhubImpact(e.impact),
            forecast: e.estimate === null || e.estimate === undefined || e.estimate === "" ? "—" : `${e.estimate}${e.unit ?? ""}`,
          }))
          .sort((a, b) => a.time.localeCompare(b.time));

        if (!cancelled && mapped.length > 0) setEvents(mapped);
      } catch {
        // Keep fallback data on any error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] px-6 py-12">
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">Economic Calendar</h1>
          <p className="text-sm text-[#A1A1AA] mb-3">
            Gold-relevant macro events. Know what moves the market before it moves.
          </p>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[#D4A843]">
            <span className="h-2 w-2 rounded-full pulse-dot-gold inline-block shrink-0" />
            Updated daily
          </div>
        </div>

        {/* Table */}
        <div
          className="overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
          }}
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {["Time (UTC)", "Event", "Impact", "Forecast"].map((h) => (
                  <th
                    key={h}
                    className="text-left font-medium px-4 py-3"
                    style={{
                      color: "rgba(212,168,67,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontSize: "11px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      {[0, 1, 2, 3].map((col) => (
                        <td key={col} className="px-4 py-3">
                          <div
                            className="h-4 rounded animate-pulse"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              width: col === 1 ? "70%" : "50%",
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : events.map((ev, i) => (
                    <motion.tr
                      key={`${ev.time}-${ev.event}`}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                      className="transition-colors duration-200 hover:bg-[rgba(123,79,212,0.08)]"
                    >
                      <td
                        className="px-4 py-3 text-white/80 font-mono"
                        style={{ borderLeft: IMPACT_BORDER[ev.impact] }}
                      >
                        {ev.time}
                      </td>
                      <td className="px-4 py-3 text-white/90">{ev.event}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={IMPACT_BADGE[ev.impact]}
                        >
                          {ev.impact}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/70 font-mono">{ev.forecast}</td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <p className="text-xs text-[#52525B] text-center mt-6">
          Full calendar integration launching soon — tracking 40+ gold-relevant macro events weekly.
        </p>
      </div>
    </div>
  );
}
