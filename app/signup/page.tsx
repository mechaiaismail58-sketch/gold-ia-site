import type { Metadata } from "next";
import SignupContent from "./SignupContent";
import { PRICING } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Sign Up — BullionDesk",
  description: `Create your BullionDesk account and get beta access to the AI gold trading coach for $${PRICING.beta}/mo at the current beta rate.`,
};

export default function SignupPage() {
  return <SignupContent />;
}
