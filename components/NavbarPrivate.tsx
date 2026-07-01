"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

export default function NavbarPrivate() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser(session: any) {
      setUserEmail(session?.user?.email ?? null);
      setAvatarUrl(null);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUser(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDropdownOpen(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setDropdownOpen(false);
    setUserEmail(null);
    setAvatarUrl(null);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex-none"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3" style={{}}>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[12px] font-medium text-white/40 tracking-wide">XAUUSD <span className="text-emerald-400/70">Live</span></span>
        </div>

        {/* Account dropdown — desktop */}
        <div className="hidden md:block relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-2.5 py-1.5 text-xs text-white/50 hover:border-white/[0.1] hover:text-white/70 transition max-w-[220px]"
          >
            {loading ? (
              <>
                <div className="h-[22px] w-[22px] rounded-full bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
              </>
            ) : userEmail ? (
              <>
                <Avatar src={avatarUrl} size={22} />
                <span className="truncate">{userEmail}</span>
              </>
            ) : null}
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-50"
                style={{
                  background: "rgba(16,14,24,0.95)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Link
                  href="/profile"
                  className="flex items-center px-4 py-3 text-xs text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition"
                >
                  Profile
                </Link>
                <div className="h-px bg-white/[0.04]" />
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center px-4 py-3 text-xs text-white/40 hover:bg-white/[0.04] hover:text-red-400/80 transition text-left disabled:opacity-40"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile: avatar */}
        <Link href="/profile" className="md:hidden flex items-center justify-center rounded-full border border-white/[0.06] min-h-[36px] min-w-[36px]">
          {loading ? (
            <div className="h-7 w-7 rounded-full bg-white/[0.06] animate-pulse" />
          ) : (
            <Avatar src={avatarUrl} size={28} />
          )}
        </Link>
      </div>
    </motion.header>
  );
}
