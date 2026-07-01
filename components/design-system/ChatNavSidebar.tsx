"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_ITEMS } from "@/components/ChatSidebar";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function ChatNavSidebar() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  function isActive(href: string) {
    if (href === "/chat") return pathname === "/chat";
    return pathname.startsWith(href);
  }

  return (
    <motion.aside
      initial={reducedMotion ? false : { x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="hidden md:flex flex-none w-[220px] flex-col p-4 relative overflow-hidden h-full"
      style={{
        borderRight: "none",
        background: "linear-gradient(180deg, rgba(123,79,212,0.04) 0%, rgba(7,6,13,0.95) 40%, rgba(7,6,13,0.98) 100%)",
      }}
    >
      {/* Subtle purple glow at top of sidebar */}
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: "radial-gradient(ellipse 120% 100% at 50% -20%, rgba(123,79,212,0.08) 0%, transparent 70%)" }} />

      {/* Brand */}
      <Link href="/chat" className="relative flex items-center gap-2.5 px-3 py-3.5 mb-1 group">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A843] opacity-40" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4A843]" />
        </span>
        <span className="text-sm font-semibold text-white/90 tracking-tight group-hover:text-white transition">BullionDesk</span>
      </Link>

      {/* Separator — purple gradient */}
      <div className="h-px mx-2 mb-3" style={{ background: "linear-gradient(90deg, rgba(123,79,212,0.15), rgba(123,79,212,0.04), transparent)" }} />

      {/* Nav items */}
      <div className="flex flex-col gap-2 mt-6 p-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.05)" }}>
        {NAV_ITEMS.map((item, index) => {
          const active = isActive(item.href);
          return (
            <motion.div
              key={item.href}
              initial={reducedMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition-all duration-200 relative",
                  active
                    ? "text-white"
                    : "text-white/35 hover:text-white/70 hover:bg-[rgba(124,58,237,0.05)]"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "rgba(124, 58, 237, 0.08)",
                      border: "none",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {active && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full"
                    style={{ background: "rgba(124, 58, 237, 0.5)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={cn("relative z-10 transition", active ? "text-[#9B7DE8]" : "text-white/25")}>{item.icon}</span>
                <span className="relative z-10">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="h-px bg-white/[0.06] mx-1 mb-3" />
        <div className="flex items-center gap-2 px-2 py-1.5 text-white/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>AI Coach Online</span>
        </div>
        <div className="text-[10px] text-white/15 px-2 mt-1 tracking-wider uppercase">
          Beta v1.0
        </div>
      </div>
    </motion.aside>
  );
}
