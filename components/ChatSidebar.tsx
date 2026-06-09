"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
  {
    href: "/chat",
    label: "AI Coach",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M2 4a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 3V4z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/chat/market",
    label: "Live Market",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="12" width="2.5" height="4" rx="0.5" fill="currentColor" />
        <rect x="6" y="8" width="2.5" height="8" rx="0.5" fill="currentColor" />
        <rect x="10" y="5" width="2.5" height="11" rx="0.5" fill="currentColor" />
        <rect x="14" y="2" width="2.5" height="14" rx="0.5" fill="currentColor" />
        <path
          d="M3.25 12L7.25 7L11.25 9.5L15.25 3"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/chat/news",
    label: "Gold News",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M5 6h8M5 9h8M5 12h5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/chat/calendar",
    label: "Calendar",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M5 2v3M13 2v3M2 8h14"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function DesktopChatSidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/chat") return pathname === "/chat";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col flex-none h-full bg-white/[0.02] border-r border-white/[0.06] transition-[width] duration-300 ease-in-out overflow-hidden relative z-10",
        expanded ? "w-56" : "w-16"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Nav items */}
      <nav className="flex-1 flex flex-col pt-4 gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "text-[#D4A843] bg-[#D4A843]/[0.06]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#D4A843] rounded-full" />
              )}
              <span className="shrink-0 pl-0.5">{item.icon}</span>
              {expanded && (
                <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: logo + settings */}
      <div className="flex flex-col gap-1 pb-5 px-2">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            expanded ? "justify-start" : "justify-center"
          )}
        >
          <div className="w-6 h-6 rounded-md bg-[#D4A843]/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#D4A843]">BD</span>
          </div>
          {expanded && (
            <span className="text-[12px] text-white/30 font-medium whitespace-nowrap">
              BullionDesk
            </span>
          )}
        </div>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-2 w-full rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-all",
            expanded ? "justify-start" : "justify-center"
          )}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {expanded && <span className="text-[13px] whitespace-nowrap">Settings</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileChatTabs() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/chat") return pathname === "/chat";
    return pathname.startsWith(href);
  }

  return (
    <nav className="md:hidden flex-none bg-[#0A0A0A] border-t border-white/[0.06] px-4 py-2 flex items-center justify-around">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors",
              active ? "text-[#D4A843]" : "text-white/30 hover:text-white/60"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
