"use client";

import EconomicCalendar from "@/components/EconomicCalendar";

export default function ChatCalendarPage() {
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8" data-lenis-prevent>
      <EconomicCalendar />
    </div>
  );
}
