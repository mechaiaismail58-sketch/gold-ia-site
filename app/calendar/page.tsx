"use client";

import EconomicCalendar from "@/components/EconomicCalendar";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <main className="px-4 sm:px-6 py-8">
      <EconomicCalendar />
    </main>
  );
}
