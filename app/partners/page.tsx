"use client";

import { useState } from "react";

const CARDS = [
  { title: "RECURRING", desc: "Commission on every paid signup you bring." },
  { title: "TRACKED",   desc: "Custom dashboard with real-time conversion data." },
  { title: "CURATED",   desc: "Selective program. Not everyone is accepted." },
];

const PROCESS = [
  { n: "1", title: "Apply",   desc: "Submit your profile for review." },
  { n: "2", title: "Review",  desc: "We evaluate audience quality, content alignment, and fit." },
  { n: "3", title: "Onboard", desc: "If accepted, you receive your tracking link and terms." },
];

const CRITERIA = [
  "Gold, XAUUSD, or forex creators with a genuinely engaged audience",
  "Consistent, high-quality content (no signal spam, no pump accounts)",
  "Clear trading framework — structure-based, institutional, or SMC preferred",
  "Minimum 5,000 engaged followers on X, Instagram, YouTube, or Telegram",
  "Willingness to integrate Bullion Desk authentically into your content",
];

const BENEFITS = [
  "Competitive recurring commission structure",
  "Access to Bullion Desk to review and test the platform",
  "Dedicated tracking dashboard",
  "Priority support during the partnership",
];

const NOT_FIT = [
  "Accounts focused on signal-selling or pump-and-dump content",
  "Creators with primarily bought or inactive followers",
  "Anyone looking for guaranteed payouts or upfront fees",
  "Those unwilling to actually use the product before promoting it",
];

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "rgba(255,255,255,0.9)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontFamily: "monospace",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.4)",
  marginBottom: "6px",
};

export default function PartnersPage() {
  const [form, setForm] = useState({
    name: "", email: "", platform: "X", handle: "",
    follower_count: "", content_link: "", motivation: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function scrollToForm() {
    document.getElementById("application-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("error"); setErrorMsg(data.error ?? "Something went wrong."); return; }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error — please try again.");
    }
  }

  return (
    <div className="bg-[#07060b] text-white flex flex-col items-center px-4 pt-16 pb-8 animate-fade-in">

      {/* Background blobs */}
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
            Institutional Gold Intelligence
          </p>
        </div>

        {/* ── Badge ── */}
        <div className="text-center mb-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gold)] border-opacity-30 bg-[rgba(212,175,55,0.06)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-pulse shrink-0" />
            <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[color:var(--gold)]">
              Partner Program
            </span>
          </span>
        </div>

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <h1 className="text-[30px] sm:text-[44px] leading-[1.08] tracking-[-0.03em] font-normal mb-5">
            Partner Program{" "}
            <span className="text-[color:var(--gold)] italic">For a select few.</span>
          </h1>
          <p className="text-[16px] text-[color:var(--muted)] leading-[1.7] max-w-[46ch] mx-auto">
            A closed program for trading creators who can move their audience. Apply to be considered.
          </p>
        </div>

        {/* ── 3 cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {CARDS.map((c) => (
            <div key={c.title} className="card rounded-2xl border border-white/10 overflow-hidden">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.35)] to-transparent" />
              <div className="p-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--gold)] mb-2">{c.title}</p>
                <p className="text-xs text-[color:var(--muted)] leading-[1.65]">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── The Process ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-5">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />
          <div className="p-6 sm:p-8">
            <h2 className="text-[18px] tracking-[-0.02em] mb-6">The Process</h2>
            <div className="space-y-5">
              {PROCESS.map((step) => (
                <div key={step.n} className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 text-[13px] font-mono text-[color:var(--gold)]">{step.n}</span>
                  <div>
                    <div className="text-[14px] text-white/90 mb-0.5">{step.title}</div>
                    <div className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── We're Selective ── */}
        <div className="card rounded-3xl border border-white/10 overflow-hidden mb-5">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.3)] to-transparent" />
          <div className="p-6 sm:p-8">
            <h2 className="text-[18px] tracking-[-0.02em] mb-1">We&apos;re selective.</h2>
            <p className="text-[13px] text-[color:var(--muted)] mb-5 leading-[1.6]">
              This program isn&apos;t open to everyone. We work with creators who meet these criteria:
            </p>
            <ul className="space-y-2.5 mb-8">
              {CRITERIA.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--gold)]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{c}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-[15px] text-white/80 mb-3">What accepted partners receive</h3>
            <ul className="space-y-2.5 mb-8">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[color:var(--gold)]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{b}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-[15px] text-white/80 mb-3">This program is not for:</h3>
            <ul className="space-y-2.5">
              {NOT_FIT.map((n, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#ef4444]" />
                  <span className="text-[13px] text-[color:var(--muted)] leading-[1.6]">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Apply Now CTA (scrolls to form) ── */}
        <div className="text-center mb-10">
          <button
            onClick={scrollToForm}
            className="inline-block rounded-xl border border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.08)] px-8 py-3.5 text-[13px] font-medium tracking-[0.05em] text-[color:var(--gold)] hover:bg-[rgba(212,175,55,0.16)] hover:border-[rgba(212,175,55,0.85)] transition"
          >
            Apply Now
          </button>
          <p className="mt-3 text-[12px] text-white/25">Applications reviewed weekly.</p>
        </div>

        {/* ── Application Form ── */}
        <div id="application-form" className="mb-10">
          <div style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "32px",
            border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: "12px",
            background: "rgba(255,255,255,0.02)",
          }}>
            <h2 className="text-[18px] tracking-[-0.02em] mb-6">Application Form</h2>

            {status === "success" ? (
              <div className="text-center py-6">
                <p className="text-[15px] text-[color:var(--gold)] font-medium">
                  Application submitted ✓
                </p>
                <p className="mt-2 text-[13px] text-[color:var(--muted)]">
                  We&apos;ll review your profile and get back to you within a week.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                  {/* Name */}
                  <div>
                    <label style={LABEL_STYLE}>Name *</label>
                    <input
                      type="text" required value={form.name} onChange={set("name")}
                      placeholder="Your full name"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label style={LABEL_STYLE}>Email *</label>
                    <input
                      type="email" required value={form.email} onChange={set("email")}
                      placeholder="your@email.com"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Platform */}
                  <div>
                    <label style={LABEL_STYLE}>Main Platform *</label>
                    <select
                      required value={form.platform} onChange={set("platform")}
                      style={{ ...INPUT_STYLE, cursor: "pointer" }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    >
                      <option value="X">X (Twitter)</option>
                      <option value="Instagram">Instagram</option>
                      <option value="YouTube">YouTube</option>
                      <option value="Telegram">Telegram</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Handle */}
                  <div>
                    <label style={LABEL_STYLE}>Handle / Username *</label>
                    <input
                      type="text" required value={form.handle} onChange={set("handle")}
                      placeholder="@yourhandle"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Follower count */}
                  <div>
                    <label style={LABEL_STYLE}>Follower Count</label>
                    <input
                      type="text" value={form.follower_count} onChange={set("follower_count")}
                      placeholder="e.g. 12,000"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Content link */}
                  <div>
                    <label style={LABEL_STYLE}>Link to your best piece of content</label>
                    <input
                      type="url" value={form.content_link} onChange={set("content_link")}
                      placeholder="https://"
                      style={INPUT_STYLE}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Motivation */}
                  <div>
                    <label style={LABEL_STYLE}>Why you&apos;d be a good fit *</label>
                    <textarea
                      required value={form.motivation} onChange={set("motivation")}
                      placeholder="Tell us about your audience, your content approach, and why Bullion Desk is a natural fit for your community."
                      rows={4}
                      style={{ ...INPUT_STYLE, resize: "vertical", minHeight: "100px" }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(212,175,55,0.5)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  {/* Submit */}
                  <div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full rounded-xl border border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.08)] px-6 py-3 text-[13px] font-medium tracking-[0.05em] text-[color:var(--gold)] hover:bg-[rgba(212,175,55,0.16)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === "loading" ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(212,175,55,0.25)] border-t-[color:var(--gold)] animate-spin" />
                          Submitting…
                        </span>
                      ) : "Submit Application"}
                    </button>

                    {status === "error" && errorMsg && (
                      <p className="mt-2.5 text-xs text-red-400 border border-red-500/20 bg-red-500/[0.05] rounded-lg px-3 py-2">
                        {errorMsg}
                      </p>
                    )}
                  </div>

                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-white/25">
          Bullion Desk © 2026 · Institutional Gold Intelligence
        </p>

      </div>
    </div>
  );
}
