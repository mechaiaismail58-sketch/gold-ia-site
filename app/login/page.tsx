import type { Metadata } from "next";
import LoginContent from "./LoginContent";

export const metadata: Metadata = {
  title: "Log In — BullionDesk",
  description:
    "Log in to BullionDesk to access your AI gold trading coach — real-time XAUUSD analysis, prop firm coaching, and risk management.",
};

export default function LoginPage() {
  return <LoginContent />;
}
