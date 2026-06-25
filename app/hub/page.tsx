"use client";

import { motion } from "framer-motion";
import FlowingMenu from "@/components/ui/FlowingMenu";
import type { MenuItem } from "@/components/ui/FlowingMenu";

export default function HubPage() {
  const items: MenuItem[] = [
    {
      text: "AI Coach",
      link: "/chat",
      marqueeBgColor: "#7B4FD4",
      marqueeTextColor: "#ffffff",
    },
    {
      text: "Live Market",
      link: "/chat/market",
      marqueeBgColor: "#D4A843",
      marqueeTextColor: "#07060b",
    },
    {
      text: "Gold News",
      link: "/chat/news",
      marqueeBgColor: "#7B4FD4",
      marqueeTextColor: "#ffffff",
    },
    {
      text: "Calendar",
      link: "/chat/calendar",
      marqueeBgColor: "#D4A843",
      marqueeTextColor: "#07060b",
    },
  ];

  return (
    <div className="fixed inset-0 bg-[#07060b] flex flex-col items-center justify-center overflow-hidden z-50">
      {/* Ambient purple glow top-left */}
      <div
        className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(123,79,212,0.12) 0%, transparent 65%)",
          animation: "hub-float 10s ease-in-out infinite",
        }}
      />
      {/* Ambient gold glow bottom-right */}
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 65%)",
          animation: "hub-float 12s ease-in-out infinite reverse",
        }}
      />
      {/* Center subtle purple wash */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse, rgba(123,79,212,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A843] opacity-40" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4A843]" />
          </span>
          <span className="text-lg font-semibold text-white/90 tracking-tight">
            Bullion<span className="text-[#D4A843]">Desk</span>
          </span>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#7B4FD4]/50">
          Where to?
        </p>
      </motion.div>

      {/* FlowingMenu — full width, centered */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-4xl px-6"
      >
        <FlowingMenu
          items={items}
          bgColor="transparent"
          borderColor="rgba(123,79,212,0.12)"
          textColor="#ffffff"
        />
      </motion.div>

      {/* Bottom hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="relative z-10 text-[10px] font-mono text-white/10 mt-12 tracking-wider"
      >
        Hover &amp; click to enter
      </motion.p>

      <style>{`
        @keyframes hub-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, -15px) scale(1.03); }
          66% { transform: translate(-15px, 10px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}
