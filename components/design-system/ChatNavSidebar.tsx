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
      initial={reducedMotion ? false : { x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="hidden md:flex flex-none w-56 flex-col gap-1 p-4 border-r border-white/[0.06] backdrop-blur-xl bg-gradient-to-b from-[rgba(123,79,212,0.03)] to-transparent"
    >
      <Link href="/chat" className="flex items-center gap-2 px-2 py-3">
        <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
        <span className="text-sm font-semibold text-white">BullionDesk</span>
      </Link>

      {/* Separator between brand and nav */}
      <div className="h-px bg-white/[0.05] mb-2" />

      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
              active
                ? "text-white bg-white/[0.04] shadow-[inset_3px_0_0_#7B4FD4]"
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
