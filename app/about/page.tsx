import type { Metadata } from "next";
import AboutContent from "./AboutContent";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About BullionDesk — Built by Traders Who Got Tired of Losing",
  description:
    "BullionDesk was built by traders who lost funded accounts to noise and indicators. Now an AI coach reads 22+ data sources with institutional discipline.",
};

export default function AboutPage() {
  return <AboutContent />;
}
