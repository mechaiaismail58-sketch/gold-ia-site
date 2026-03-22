"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/methodology", label: "Methodology" },
  { href: "/backtest", label: "Backtest" },
  { href: "/market", label: "Market" },
  { href: "/calendar", label: "Calendar" },
  { href: "/about", label: "About" },
];

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect y="3.5" width="18" height="1.5" rx="0.75" fill="currentColor" />
      <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor" />
      <rect y="13" width="18" height="1.5" rx="0.75" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 3L15 15M15 3L3 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface HeaderProps {
  initialEmail: string | null;
  initialAvatarUrl: string | null;
}

export default function Header({ initialEmail, initialAvatarUrl }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Initialise avec les valeurs serveur → zéro flash
  const [userEmail, setUserEmail] = useState<string | null>(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialise depuis le client + écoute les changements d'auth en temps réel
  useEffect(() => {
    const supabase = createClient();

    // Sync initial state from browser session (covers page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) {
        const { data } = await supabase.from("users").select("avatar_url").eq("id", session.user.id).single();
        setAvatarUrl(data?.avatar_url ?? null);
      } else {
        setAvatarUrl(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUserEmail(null);
    setAvatarUrl(null);
    setDropdownOpen(false);
    router.push("/login");
    router.refresh(); // flush Next.js cache so middleware re-evaluates
  }

  const navLinkClass = (href: string) =>
    pathname === href
      ? "rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase border border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.07)] text-white"
      : "rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase text-white/80 transition hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10";

  return (
    <header className="pt-6">
      {/* Mobile menu backdrop */}
      <div
        className={`fixed inset-0 z-30 md:hidden transition-opacity duration-300 ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(7,6,11,0.75)", backdropFilter: "blur(4px)" }}
        onClick={() => setMenuOpen(false)}
      />
      <div className="card border border-white/10 rounded-2xl px-5 py-4 shadow-[0_12px_50px_rgba(0,0,0,0.28)] relative z-40">

        {/* ── Main row ── */}
        <div className="flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-baseline gap-3 shrink-0">
            <div className="text-[15px] tracking-[0.20em] uppercase">
              Bullion <span className="text-[color:var(--gold)]">Desk</span>
            </div>
            <div className="hidden lg:block text-xs text-[color:var(--muted)]">
              Institutional Gold Intelligence
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {userEmail ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-2 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white transition max-w-[220px]"
                >
                  <Avatar src={avatarUrl} size={22} />
                  <span className="truncate">{userEmail}</span>
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
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-3 text-xs uppercase tracking-[0.10em] text-white/60 hover:bg-white/[0.04] hover:text-red-400 transition text-left"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase text-white/80 transition hover:text-white hover:bg-white/5 border border-white/10"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase border border-[rgba(212,175,55,0.55)] text-[color:var(--gold)] transition hover:border-[rgba(212,175,55,0.95)] hover:bg-[rgba(212,175,55,0.08)]"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile right side */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            {userEmail ? (
              <Link href="/profile" className="rounded-full border border-white/10">
                <Avatar src={avatarUrl} size={32} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-xs tracking-[0.08em] uppercase text-white/80 border border-white/10">
                  Login
                </Link>
                <Link href="/signup" className="rounded-lg px-3 py-2 text-xs tracking-[0.08em] uppercase border border-[rgba(212,175,55,0.55)] text-[color:var(--gold)]">
                  Sign Up
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 text-white/80 hover:border-white/20 hover:text-white transition"
            >
              {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown nav — animated ── */}
        <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden md:hidden ${menuOpen ? "max-h-[500px]" : "max-h-0"}`}>
          <nav className="mt-4 flex flex-col gap-1.5 pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href
                    ? "rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase border border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.07)] text-white"
                    : "rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase text-white/80 border border-white/10 hover:border-white/20 hover:text-white transition"
                }
              >
                {item.label}
              </Link>
            ))}
            {userEmail && (
              <>
                <div className="h-px bg-white/[0.06] my-1" />
                <Link
                  href="/profile"
                  className="rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase text-white/70 border border-white/10 hover:border-white/20 transition"
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase text-white/50 border border-white/10 hover:border-red-500/30 hover:text-red-400 transition text-left"
                >
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
