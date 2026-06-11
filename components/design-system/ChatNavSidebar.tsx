"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_ITEMS } from "@/components/ChatSidebar";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Desktop-only glass sidebar for /chat/* routes — slides in from the left on mount. */
export default function ChatNavSidebar() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  function isActive(href: string) {
    if (href === "/chat") return pathname === "/chat";
    return pathname.startsWith(href);
  }

  return (
    <motion.aside
      initial={reducedMotion ? false : { x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 16 }}
      className="hidden md:flex flex-none w-56 flex-col gap-1 p-4 bg-white/[0.02] border-r border-white/[0.06] backdrop-blur-xl"
    >
      <Link href="/chat" className="flex items-center gap-2 px-2 py-3 mb-2">
        <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
        <span className="text-sm font-semibold text-white">BullionDesk</span>
      </Link>

      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
              active
                ? "bg-gradient-to-r from-[#7B4FD4] to-[#9B6FE8] text-white shadow-[0_0_20px_rgba(123,79,212,0.35)]"
                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </motion.aside>
  );
}
