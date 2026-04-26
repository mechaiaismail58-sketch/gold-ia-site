"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.2" />
      <rect x="11" y="2" width="7" height="7" rx="1.2" />
      <rect x="2" y="11" width="7" height="7" rx="1.2" />
      <rect x="11" y="11" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 13a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 5.5V10l3 2" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,14 7.5,9 11,12 17,5" />
      <polyline points="14,5 17,5 17,8" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <line x1="3" y1="8.5" x2="17" y2="8.5" />
      <line x1="7" y1="2" x2="7" y2="5.5" />
      <line x1="13" y1="2" x2="13" y2="5.5" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a6 6 0 0 1 6 6v3.5l1.5 2.5H2.5L4 11.5V8a6 6 0 0 1 6-6z" />
      <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  chatOpen:      boolean;
  onChatToggle:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppRail({ chatOpen, onChatToggle }: Props) {
  const pathname = usePathname();

  // Keyboard shortcut: 'C' toggles chat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && chatOpen) { onChatToggle(); return; }
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
      if (e.key === "c" || e.key === "C") onChatToggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, onChatToggle]);

  function railBtn(
    icon: React.ReactNode,
    label: string,
    active: boolean,
    onClick?: () => void,
    href?: string,
  ) {
    const cls = [
      "flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-150",
      active
        ? "border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.08)] text-[#D4AF37]"
        : "border-transparent text-white/25 hover:bg-white/[0.03] hover:text-white/45",
    ].join(" ");

    const inner = (
      <div title={label} className={cls} style={{ cursor: "pointer" }}>
        {icon}
      </div>
    );

    if (onClick) return <button key={label} type="button" onClick={onClick} className="focus:outline-none">{inner}</button>;
    return <Link key={label} href={href!}>{inner}</Link>;
  }

  return (
    <div
      className="flex flex-col items-center border-r border-white/[0.06]"
      style={{ background: "#07050F", padding: "18px 0", gap: "6px" }}
    >
      {/* Logo */}
      <div style={{
        width: 32, height: 32, borderRadius: 6, marginBottom: 20,
        border: "1px solid rgba(212,175,55,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#D4AF37", fontSize: 18, lineHeight: 1 }}>
          b
        </span>
      </div>

      {/* Nav items */}
      {railBtn(<IconGrid />, "Dashboard", pathname === "/dashboard", undefined, "/dashboard")}
      {railBtn(<IconChat />, "Console (C)", chatOpen, onChatToggle)}
      {railBtn(<IconClock />, "History", false, undefined, "/history")}
      {railBtn(<IconTrending />, "Market", pathname === "/market", undefined, "/market")}
      {railBtn(<IconCalendar />, "Calendar", pathname === "/calendar", undefined, "/calendar")}
      {railBtn(<IconBell />, "Alerts", false, undefined, "/alerts")}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {railBtn(<IconSettings />, "Settings", pathname === "/profile", undefined, "/profile")}
    </div>
  );
}
