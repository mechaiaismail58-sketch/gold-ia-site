import type { Metadata } from "next";
import WaitlistLanding from "@/components/WaitlistLanding";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "BullionDesk — AI Gold Trading Coach for Prop Firm Traders",
  description:
    "BullionDesk watches your XAUUSD trading in real time and warns you before the drawdown hits. Structure, macro, and risk analysis built for prop firm traders.",
};

export default function Home() {
  return <WaitlistLanding />;
}
