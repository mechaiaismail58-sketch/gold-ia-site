import Link from "next/link";
import { PRICING } from "@/lib/pricing";

/** Shared bottom-of-page CTA — unifies the About/Methodology duplicates. */
export default function CTABlock() {
  return (
    <section className="min-h-[50vh] flex items-center justify-center flex-col px-6 py-24 relative z-10">
      <div className="text-center">
        <h2 className="text-4xl font-bold text-white mb-8">See it for yourself.</h2>
        <Link
          href="/#demo"
          className="inline-block rounded-xl px-8 py-4 text-sm font-bold tracking-[0.04em] bg-[#D4A843] text-black transition hover:brightness-110"
          style={{ boxShadow: "0 0 28px rgba(212,168,67,0.35)" }}
        >
          Try the AI Coach — Free
        </Link>
        <p className="text-sm mt-4" style={{ color: "#D4A843" }}>
          🔒 {PRICING.betaLine}
        </p>
      </div>
    </section>
  );
}
