"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { ChevronIcon } from "@/components/NavIcons";

const chatNavItems = [
  { href: "/chat", label: "Chat" },
  { href: "/chat/market", label: "Market" },
  { href: "/chat/news", label: "News" },
  { href: "/chat/calendar", label: "Calendar" },
];

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) {
        const { data } = await supabase.from("users").select("avatar_url").eq("id", session.user.id).single();
        setAvatarUrl(data?.avatar_url ?? null);
      } else {
        setAvatarUrl(null);
      }
      setLoading(false);
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

  const isActive = (href: string) =>
    href === "/chat" ? pathname === "/chat" : pathname.startsWith(href);

  const navLinkClass = (href: string) =>
    `text-xs uppercase tracking-wider transition-colors ${
      isActive(href) ? "text-[#D4A843]" : "text-[#A1A1AA] hover:text-white"
    }`;

  return (
    <motion.header
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex-none bg-white/[0.02] border-b border-white/[0.06]"
    >
      <div className="px-4 sm:px-6 md:px-10 py-3 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/chat" className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse inline-block shrink-0" />
          <span className="text-sm font-semibold text-white">BullionDesk</span>
        </Link>

        {/* Center nav — desktop only */}
        <nav className="hidden md:flex items-center gap-6">
          {chatNavItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
              {item.label.toUpperCase()}
            </Link>
          ))}
        </nav>

        {/* Account dropdown — desktop */}
        <div className="hidden md:block relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-2 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white transition max-w-[220px]"
          >
            {loading ? (
              <>
                <div className="h-[22px] w-[22px] rounded-full bg-white/10 animate-pulse" />
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
              </>
            ) : userEmail ? (
              <>
                <Avatar src={avatarUrl} size={22} />
                <span className="truncate">{userEmail}</span>
              </>
            ) : null}
            <ChevronIcon open={dropdownOpen} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 card border border-white/10 rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] z-50">
              <Link
                href="/profile"
                className="flex items-center px-4 py-3 text-xs uppercase tracking-[0.10em] text-white/80 hover:bg-white/[0.04] hover:text-white transition"
              >
                Profile
              </Link>
              <div className="h-px bg-white/[0.06]" />
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center px-4 py-3 text-xs uppercase tracking-[0.10em] text-white/60 hover:bg-white/[0.04] hover:text-red-400 transition text-left disabled:opacity-40"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>

        {/* Mobile: avatar links to profile — bottom tabs handle navigation */}
        <Link href="/profile" className="md:hidden flex items-center justify-center rounded-full border border-white/10 min-h-[36px] min-w-[36px]">
          {loading ? (
            <div className="h-7 w-7 rounded-full bg-white/10 animate-pulse" />
          ) : (
            <Avatar src={avatarUrl} size={28} />
          )}
        </Link>
      </div>
    </motion.header>
  );
}
