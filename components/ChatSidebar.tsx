"use client";

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
