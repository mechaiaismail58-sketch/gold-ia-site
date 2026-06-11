import type { Metadata } from "next";
import MethodologyContent from "./MethodologyContent";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Our Methodology — How BullionDesk Reads Gold | BullionDesk",
  description:
    "Market structure, macro analysis, risk management, and trading psychology — the four institutional frameworks behind BullionDesk's AI gold trading coach.",
};

export default function MethodologyPage() {
  return <MethodologyContent />;
}
