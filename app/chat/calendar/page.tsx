"use client";

import { motion } from "framer-motion";

interface CalendarEvent {
  time: string;
  event: string;
  impact: "HIGH" | "MED";
  forecast: string;
}

const EVENTS: CalendarEvent[] = [
  { time: "14:30", event: "US CPI (MoM)",              impact: "HIGH", forecast: "3.2%" },
  { time: "16:00", event: "Fed Chair Powell Speech",   impact: "HIGH", forecast: "—" },
  { time: "08:30", event: "US Initial Jobless Claims", impact: "MED",  forecast: "215K" },
  { time: "10:00", event: "US PPI (YoY)",              impact: "MED",  forecast: "2.8%" },
  { time: "14:00", event: "FOMC Meeting Minutes",      impact: "HIGH", forecast: "—" },
];

export default function ChatCalendarPage() {
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
              {EVENTS.map((ev, i) => (
                <motion.tr
                  key={`${ev.time}-${ev.event}`}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                  className="transition-colors duration-200 hover:bg-[rgba(123,79,212,0.08)]"
                >
                  <td
                    className="px-4 py-3 text-white/80 font-mono"
                    style={{
                      borderLeft: ev.impact === "HIGH"
                        ? "2px solid #D4A843"
                        : "2px solid rgba(212,168,67,0.4)",
                    }}
                  >
                    {ev.time}
                  </td>
                  <td className="px-4 py-3 text-white/90">{ev.event}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={
                        ev.impact === "HIGH"
                          ? { background: "rgba(212,168,67,0.15)", color: "#D4A843" }
                          : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }
                      }
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
