"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const NAV_ITEMS = [
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
    <nav className="md:hidden flex-none bg-[#060609]/95 backdrop-blur-xl border-t border-white/[0.04] px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-around">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200",
              active ? "text-white" : "text-white/25 hover:text-white/50"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && <span className="h-0.5 w-4 rounded-full bg-[#7B4FD4] mt-0.5" />}
          </Link>
        );
      })}
    </nav>
  );
}
