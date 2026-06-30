"use client";

import { ReactLenis } from "lenis/react";
import EconomicCalendar from "@/components/EconomicCalendar";

export const revalidate = 300;

export default function ChatCalendarPage() {
  return (
    <ReactLenis
      className="flex-1 overflow-y-auto px-4 sm:px-6 py-8"
      options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}
    >
      <EconomicCalendar />
    </ReactLenis>
  );
}
