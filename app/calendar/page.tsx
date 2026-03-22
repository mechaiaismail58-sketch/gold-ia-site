"use client";

import { useEffect, useState } from "react";

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
    glow: "shadow-[0_0_24px_rgba(212,175,55,0.06)]",
    badge: "bg-[rgba(212,175,55,0.10)] text-[#D4AF37] border border-[rgba(212,175,55,0.30)]",
    dot: "bg-[#D4AF37]",
    label: "High Impact",
  },
  medium: {
    border: "border-[rgba(249,115,22,0.35)]",
    glow: "shadow-[0_0_16px_rgba(249,115,22,0.04)]",
    badge: "bg-orange-500/10 text-orange-400 border border-orange-500/25",
    dot: "bg-orange-400",
    label: "Medium",
  },
  low: {
    border: "border-white/[0.08]",
    glow: "",
    badge: "bg-white/5 text-white/35 border border-white/10",
    dot: "bg-white/25",
    label: "Low",
  },
} as const;

function EventCard({ event, now }: { event: CalendarEvent; now: Date }) {
  const target = new Date(event.date);
  const diff = target.getTime() - now.getTime();
  const isPast = diff < 0;
  const isIncoming = diff > 0 && diff < 7_200_000; // < 2 h
  const style = IMPACT[event.impact];
  const countdown = formatCountdown(target, now);

  return (
    <div
      className={cn(
        "card rounded-2xl p-4 border transition-all duration-300",
        style.border,
        style.glow,
        isPast && "opacity-35"
      )}
    >
      {/* INCOMING */}
      {isIncoming && (
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-mono text-red-400 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />
            INCOMING
          </span>
        </div>
      )}

      {/* Title */}
      <div
        className={cn(
          "text-[13px] font-medium leading-snug",
          isPast ? "line-through text-white/35" : "text-white/90"
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
        <div className="text-[12px] font-mono text-white/55">{formatLocalTime(event.date)}</div>
        <div className="text-[10px] font-mono text-white/22">{formatUtcTime(event.date)}</div>
      </div>

      {/* Forecast / Previous */}
      {(event.forecast || event.previous) && (
        <div className="flex gap-5 mt-3">
          {event.forecast && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-white/22">Forecast</div>
              <div className="text-[12px] font-mono text-white/65 mt-0.5">{event.forecast}</div>
            </div>
          )}
          {event.previous && (
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-white/22">Previous</div>
              <div className="text-[12px] font-mono text-white/65 mt-0.5">{event.previous}</div>
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
          <span className="text-white/30">{countdown}</span>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

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
    <main>
      {/* ── High impact warning banner ── */}
      {showBanner && nextHigh && (
        <div className="mb-5 rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.055)] px-5 py-3.5 flex items-start gap-3 shadow-[0_0_32px_rgba(212,175,55,0.05)]">
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
        </div>
      )}

      {/* ── Page header ── */}
      <section className="card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-white/10 shadow-[0_18px_80px_rgba(109,40,217,0.12)] mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.02em]">
              Economic Calendar
            </h1>
            <p className="text-[color:var(--muted)] mt-2 max-w-[54ch] text-[14px] leading-6">
              Gold-relevant macro events filtered for XAUUSD impact — CPI, NFP, FOMC, GDP, PCE and key USD data.
            </p>
            {weekLabel && (
              <div className="mt-3 font-mono text-[11px] text-white/28 tracking-wide">{weekLabel}</div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {(["high", "medium", "low"] as const).map((lvl) => (
              <span
                key={lvl}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide",
                  IMPACT[lvl].badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", IMPACT[lvl].dot)} />
                {IMPACT[lvl].label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      {loading ? (
        <div className="card rounded-2xl p-10 border border-white/10 flex items-center justify-center min-h-[200px]">
          <div className="flex items-center gap-3 text-white/30">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
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
              {days.map((day) => {
                const { weekday, monthDay } = formatDayHeader(day);
                const isToday = isTodayKey(day);
                return (
                  <div key={day}>
                    {/* Day header */}
                    <div
                      className={cn(
                        "text-center pb-3 mb-3 border-b",
                        isToday ? "border-[rgba(212,175,55,0.22)]" : "border-white/[0.07]"
                      )}
                    >
                      <div className="text-[10px] font-mono tracking-[0.22em] text-white/28 uppercase">
                        {weekday}
                      </div>
                      <div
                        className={cn(
                          "text-[16px] font-mono mt-0.5",
                          isToday ? "text-[#D4AF37]" : "text-white/50"
                        )}
                      >
                        {monthDay}
                      </div>
                      {isToday && (
                        <div className="h-[2px] w-5 rounded-full bg-[rgba(212,175,55,0.55)] mx-auto mt-1.5" />
                      )}
                    </div>

                    {/* Event cards */}
                    <div className="flex flex-col gap-3">
                      {grouped[day].map((ev) => (
                        <EventCard key={ev.id} event={ev} now={now} />
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
                        "text-[12px] font-mono font-semibold",
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
                    {grouped[day].map((ev) => (
                      <EventCard key={ev.id} event={ev} now={now} />
                    ))}
                  </div>

                  <div className="h-px bg-white/[0.05] mt-4" />
                </div>
              );
            })}
          </div>
        </>
      )}

      <footer className="mt-8 text-xs text-[color:var(--muted)]">
        © {new Date().getFullYear()} Bullion Desk · Data: Forex Factory
      </footer>
    </main>
  );
}
