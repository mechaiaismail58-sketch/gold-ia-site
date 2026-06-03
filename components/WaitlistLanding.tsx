"use client";

import { useEffect } from "react";
import Link from "next/link";
import DemoChat from "@/components/DemoChat";


export default function WaitlistLanding() {
  useEffect(() => {
    setTimeout(() => {
      if (window.location.hash) {
        const el = document.querySelector(window.location.hash);
        if (el) { el.scrollIntoView({ behavior: "smooth" }); return; }
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 0);
  }, []);

  return (
    <div className="bg-[#07060b] text-white flex flex-col items-center px-4 pt-10 animate-fade-in">

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
        <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
      </div>

      <div className="w-full max-w-lg">

        {/* ── Logo ── */}
        <div className="text-center mb-12">
          <p className="text-[17px] tracking-[0.22em] uppercase text-white font-light">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </p>
          <p className="mt-2 text-[10px] tracking-[0.18em] uppercase text-[color:var(--muted)]">
            AI Gold Trading Coach
          </p>
        </div>

        {/* ── Secondary nav links ── */}
        <div className="flex justify-center gap-3 mb-7">
          <a
            href="/methodology"
            className="rounded-xl px-4 py-2.5 text-[11px] tracking-[0.10em] uppercase border border-[rgba(212,175,55,0.45)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.9)] hover:bg-[rgba(212,175,55,0.07)]"
          >
            Our Methodology →
          </a>
          <a
            href="/about"
            className="rounded-xl px-4 py-2.5 text-[11px] tracking-[0.10em] uppercase border border-[rgba(212,175,55,0.45)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.9)] hover:bg-[rgba(212,175,55,0.07)]"
          >
            About Us →
          </a>
        </div>

        {/* ── Badge ── */}
        <div className="text-center mb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] border-opacity-30 bg-[rgba(212,175,55,0.06)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse shrink-0" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[color:var(--gold)]">
              Beta — Limited Spots
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] font-normal mb-5">
            Your AI Gold Trading Coach.{" "}
            <span className="text-[color:var(--gold)] italic">Always on.</span>
          </h1>
          <p className="text-[16px] text-[color:var(--muted)] leading-[1.7] max-w-[46ch] mx-auto">
            Institutional-grade gold analysis. Structure, macro, risk — everything you need to trade XAUUSD with clarity. Built for serious gold traders and prop firm candidates.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
            {[
              { value: "431", label: "Research trades" },
              { value: "7",   label: "Prop firms supported" },
              { value: "24/7", label: "Market coverage" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-[22px] font-light tracking-[-0.02em] text-[color:var(--gold)]">{s.value}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/30 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
          <button
            onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full sm:w-auto rounded-xl px-7 py-3.5 text-[13px] tracking-[0.06em] font-medium border border-[rgba(212,175,55,0.85)] bg-[rgba(212,175,55,0.15)] text-[color:var(--gold)] hover:bg-[rgba(212,175,55,0.26)] hover:border-[rgba(212,175,55,1)] transition min-h-[48px]"
          >
            Try the AI Coach — Free
          </button>
          <Link
            href="/signup"
            className="w-full sm:w-auto rounded-xl px-7 py-3.5 text-[13px] tracking-[0.06em] border border-white/15 text-white/70 hover:border-white/30 hover:text-white transition min-h-[48px] flex items-center justify-center"
          >
            Get Started — $10
          </Link>
        </div>
        <p className="text-center text-[11px] text-white/25 mb-10">
          No signals · No BS · Just clarity
        </p>

        {/* ── Demo chat — front and centre ── */}
        <div id="demo" className="mb-8">
          <div className="text-center mb-4">
            <h2 className="text-[18px] font-normal tracking-[-0.01em] text-white mb-1">
              Try it now
            </h2>
            <p className="text-[12px] text-white/35 tracking-[0.04em]">
              3 free messages. No signup required.
            </p>
          </div>
          <DemoChat />
        </div>

        {/* ── Track Record ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.45)] to-transparent" />
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.20em] text-[color:var(--gold)] mb-2">
                Research Track Record
              </p>
              <p className="text-[13px] text-white/40 leading-relaxed">
                Exposed analysis on XAUUSD — backtested, documented, transparent.
              </p>
            </div>
            <div className="flex items-start justify-center gap-8 sm:gap-12 flex-wrap mb-6">
              {[
                { value: "431",  label: "Research Trades" },
                { value: "76%",  label: "Win Rate" },
                { value: "7:1",  label: "Best R:R" },
                { value: "3 mo.", label: "Track Record" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-[28px] sm:text-[32px] font-light tracking-[-0.02em] text-[color:var(--gold)]">
                    {s.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-white/30 mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-white/20 leading-relaxed">
              Based on backtested research trades on XAUUSD. Past performance does not guarantee future results.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/25 mb-6">
          Bullion Desk © 2026 · AI Gold Trading Coach · Not investment advice
        </p>

      </div>
    </div>
  );
}
