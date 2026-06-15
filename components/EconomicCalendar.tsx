"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type CalendarEvent = {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: "high" | "medium" | "low";
  forecast: string | null;
  previous: string | null;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isTodayKey(key: string): boolean {
  const n = new Date();
  const today = [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, "0"),
    String(n.getDate()).padStart(2, "0"),
  ].join("-");
  return key === today;
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function formatDayHeader(key: string): { weekday: string; monthDay: string } {
  // key is "YYYY-MM-DD" — parse at local noon to avoid DST edge cases
  const d = new Date(`${key}T12:00:00`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function formatDayLong(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatCountdown(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

const IMPACT = {
  high: {
    border: "border-[rgba(212,175,55,0.40)]",
    borderHover: "hover:border-[rgba(212,175,55,0.75)]",
    glow: "shadow-[0_0_24px_rgba(212,175,55,0.06)]",
    badge: "bg-[rgba(212,175,55,0.10)] text-[#D4AF37] border border-[rgba(212,175,55,0.30)]",
    dot: "bg-[#D4AF37]",
    label: "High Impact",
  },
  medium: {
    border: "border-[rgba(249,115,22,0.35)]",
    borderHover: "hover:border-[rgba(249,115,22,0.65)]",
    glow: "shadow-[0_0_16px_rgba(249,115,22,0.04)]",
    badge: "bg-orange-500/10 text-orange-400 border border-orange-500/25",
    dot: "bg-orange-400",
    label: "Medium",
  },
  low: {
    border: "border-white/[0.08]",
    borderHover: "hover:border-white/[0.12]",
    glow: "",
    badge: "bg-white/5 text-white/35 border border-white/10",
    dot: "bg-white/25",
    label: "Low",
  },
} as const;

function EventCard({ event, now, index, reduce }: { event: CalendarEvent; now: Date; index: number; reduce: boolean }) {
  const target = new Date(event.date);
  const diff = target.getTime() - now.getTime();
  const isPast = diff < 0;
  const isIncoming = diff > 0 && diff < 7_200_000; // < 2 h
  const style = IMPACT[event.impact];
  const countdown = formatCountdown(target, now);

  return (
    <motion.div
      initial={reduce ? false : { y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: reduce ? 0 : index * 0.06 }}
      whileHover={reduce ? undefined : { scale: 1.015, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
      className={cn(
        "group border transition-all duration-300 ease-out bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)]",
        style.border,
        style.borderHover,
        isPast && "opacity-35"
      )}
      style={{
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      {/* INCOMING */}
      {isIncoming && (
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-mono text-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.2)]">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />
            INCOMING
          </span>
        </div>
      )}

      {/* Title — sans-serif, not mono */}
      <div
        className={cn(
          "text-[14px] font-medium leading-snug",
          isPast ? "line-through text-white/35" : "text-white/85"
        )}
      >
        {event.title}
      </div>

      {/* Impact badge */}
      <div className="flex items-center gap-2 mt-2.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
            style.badge
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
          {style.label}
        </span>
      </div>

      {/* Time */}
      <div className="mt-3 space-y-0.5">
        <div className="text-[11px] font-mono text-white/55">{formatLocalTime(event.date)}</div>
        <div className="text-[10px] font-mono text-white/22">{formatUtcTime(event.date)}</div>
      </div>

      {/* Forecast / Previous */}
      {(event.forecast || event.previous) && (
        <div className="flex gap-5 mt-3">
          {event.forecast && (
            <div>
              <div className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/20">Forecast</div>
              <div className="text-[13px] font-mono text-white/60 mt-0.5">{event.forecast}</div>
            </div>
          )}
          {event.previous && (
            <div>
              <div className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/20">Previous</div>
              <div className="text-[13px] font-mono text-white/60 mt-0.5">{event.previous}</div>
            </div>
          )}
        </div>
      )}

      {/* Countdown */}
      <div className="mt-3 text-[11px] font-mono">
        {isPast ? (
          <span className="text-white/18">Passed</span>
        ) : isIncoming ? (
          <span className="text-red-400">{countdown} remaining</span>
        ) : (
          <span className="text-white/25">{countdown}</span>
        )}
      </div>
    </motion.div>
  );
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEvents(data.events);
        else setError(data.error ?? "Failed to load calendar.");
      })
      .catch(() => setError("Unable to fetch calendar data."))
      .finally(() => setLoading(false));
  }, []);

  // Tick every second for live countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Group events by local date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const key = getLocalDateKey(ev.date);
    (grouped[key] ??= []).push(ev);
  }
  const days = Object.keys(grouped).sort();

  // Chronological order index → drives the cascade (stagger) of card mounts
  const orderIndex = new Map(events.map((e, i) => [e.id, i]));

  // Warning banner: next High Impact event within 24 h
  const nextHigh = events
    .filter((e) => e.impact === "high" && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const hoursUntilHigh = nextHigh
    ? (new Date(nextHigh.date).getTime() - now.getTime()) / 3_600_000
    : null;
  const showBanner = hoursUntilHigh !== null && hoursUntilHigh <= 24;

  // Week range label
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const weekLabel =
    firstDay && lastDay
      ? `${new Date(`${firstDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(`${lastDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : "";

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* ── High impact warning banner ── */}
      <AnimatePresence>
        {showBanner && nextHigh && (
          <motion.div
            initial={reduce ? false : { y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="mb-5 rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.055)] backdrop-blur-sm px-5 py-3.5 flex items-start gap-3 shadow-[0_0_32px_rgba(212,175,55,0.05)]"
          >
            <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse shrink-0 mt-0.5" />
            <div className="text-[13px] leading-snug">
              <span className="text-[#D4AF37] font-medium">
                High Impact Event {hoursUntilHigh! < 1 ? "Imminent" : hoursUntilHigh! < 6 ? "Soon" : "Today"} —
              </span>
              <span className="text-white/55 ml-1.5">
                {nextHigh.title} at {formatLocalTime(nextHigh.date)}
                {" · "}{formatCountdown(new Date(nextHigh.date), now)} away — Trade with caution.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header ── */}
      <section className="card relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.12)] mb-6">
        {/* Decorative purple blob */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: "-20px",
            right: "-20px",
            width: "200px",
            height: "200px",
            background: "radial-gradient(circle, rgba(123,79,212,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
              Economic Calendar
            </h1>
            <p className="text-[14px] leading-relaxed text-white/40 mt-2 max-w-[54ch]">
              Gold-relevant macro events filtered for XAUUSD impact — CPI, NFP, FOMC, GDP, PCE and key USD data.
            </p>
            {weekLabel && (
              <div className="mt-3 font-mono text-[11px] text-white/28 tracking-[0.04em]">{weekLabel}</div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {(["high", "medium", "low"] as const).map((lvl) => (
              <span
                key={lvl}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em]",
                  IMPACT[lvl].badge
                )}
              >
                <span className={cn("h-1 w-1 rounded-full shrink-0", IMPACT[lvl].dot)} />
                {IMPACT[lvl].label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Divider between header and the day grid */}
      <div className="h-px bg-white/5 mb-6" />

      {/* ── Content ── */}
      {loading ? (
        <div className="card rounded-2xl p-10 border border-white/10 flex items-center justify-center min-h-[200px]">
          <div className="flex items-center gap-1.5 text-white/30">
            {[0, 0.2, 0.4].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]"
                style={{ animation: "dot-bounce 1.2s ease-in-out infinite", animationDelay: `${delay}s` }}
              />
            ))}
            <span className="text-sm ml-2 font-mono">Loading calendar…</span>
          </div>
        </div>
      ) : error ? (
        <div className="card rounded-2xl p-10 border border-white/10 text-center">
          <p className="text-[color:var(--muted)] text-sm">{error}</p>
          <p className="text-white/20 text-xs mt-2 font-mono">Source: nfs.faireconomy.media</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card rounded-2xl p-10 border border-white/10 text-center">
          <p className="text-[color:var(--muted)] text-sm">No gold-relevant events found for this week.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop: week columns ── */}
          <div className="hidden md:block">
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day, colIndex) => {
                const { weekday, monthDay } = formatDayHeader(day);
                const isToday = isTodayKey(day);
                return (
                  <div key={day}>
                    {/* Day header — fades in left to right */}
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut", delay: reduce ? 0 : colIndex * 0.08 }}
                      className={cn(
                        "text-center pb-3 mb-4 border-b",
                        isToday ? "border-[rgba(212,175,55,0.22)]" : "border-white/[0.07]"
                      )}
                    >
                      <div className="text-[11px] font-mono tracking-[0.2em] text-white/25 uppercase">
                        {weekday}
                      </div>
                      <div
                        className={cn(
                          "text-[18px] font-semibold mt-0.5",
                          isToday ? "text-[#D4AF37]" : "text-white/50"
                        )}
                      >
                        {monthDay}
                      </div>
                      {isToday && (
                        <div className="h-[2px] w-5 rounded-full bg-[rgba(212,175,55,0.55)] mx-auto mt-1.5" />
                      )}
                    </motion.div>

                    {/* Event cards */}
                    <div className="flex flex-col gap-3">
                      {grouped[day].map((ev, ci) => (
                        <div key={ev.id}>
                          {ci > 0 && <div className="h-px bg-white/[0.04] mx-4 mb-3" />}
                          <EventCard event={ev} now={now} index={orderIndex.get(ev.id) ?? 0} reduce={reduce} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Mobile: chronological list ── */}
          <div className="md:hidden flex flex-col gap-1">
            {days.map((day) => {
              const isToday = isTodayKey(day);
              return (
                <div key={day} className="mb-2">
                  {/* Day label */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span
                      className={cn(
                        "text-[13px] font-semibold tracking-[-0.01em]",
                        isToday ? "text-[#D4AF37]" : "text-white/38"
                      )}
                    >
                      {formatDayLong(day)}
                    </span>
                    {isToday && (
                      <span className="rounded-full border border-[rgba(212,175,55,0.28)] px-1.5 py-0.5 text-[9px] font-mono uppercase text-[rgba(212,175,55,0.6)]">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {grouped[day].map((ev, ci) => (
                      <div key={ev.id}>
                        {ci > 0 && <div className="h-px bg-white/[0.04] mx-4 mb-3" />}
                        <EventCard event={ev} now={now} index={orderIndex.get(ev.id) ?? 0} reduce={reduce} />
                      </div>
                    ))}
                  </div>

                  <div className="h-px bg-white/[0.05] mt-4" />
                </div>
              );
            })}
          </div>
        </>
      )}

      <footer className="mt-12 text-[10px] font-mono text-white/10">
        © {new Date().getFullYear()} Bullion Desk · Data: Forex Factory
      </footer>
    </div>
  );
}
