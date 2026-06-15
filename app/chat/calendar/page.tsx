"use client";

import EconomicCalendar from "@/components/EconomicCalendar";

export const dynamic = "force-dynamic";

export default function ChatCalendarPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] px-4 sm:px-6 py-8">
      <EconomicCalendar />
    </div>
  );
}
