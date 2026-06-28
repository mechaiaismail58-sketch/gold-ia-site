"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { HamburgerIcon, CloseIcon, ChevronIcon } from "@/components/NavIcons";
import { NavShell } from "@/components/design-system/Navbar";
import { PRICING } from "@/lib/pricing";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
];

interface NavbarPublicProps {
  initialEmail: string | null;
  initialAvatarUrl: string | null;
}

export default function NavbarPublic({ initialEmail, initialAvatarUrl }: NavbarPublicProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [hasPaid, setHasPaid] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    function syncPaidStatus(loggedIn: boolean) {
      if (!loggedIn) {
        setHasPaid(false);
        return;
      }
      fetch("/api/auth/payment-status")
        .then((r) => r.json())
        .then((data) => setHasPaid(Boolean(data?.has_paid)))
        .catch(() => setHasPaid(false));
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
      syncPaidStatus(Boolean(session?.user));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      syncPaidStatus(Boolean(session?.user));
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
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setDropdownOpen(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    setDropdownOpen(false);

    const supabase = createClient();
    await supabase.auth.signOut();

    setUserEmail(null);
    setAvatarUrl(null);
    setHasPaid(false);

    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });

    await new Promise(r => setTimeout(r, 100));
    window.location.href = "/";
  }

  const navLinkClass = (href: string) =>
    pathname === href
      ? "rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase border border-[rgba(212,175,55,0.45)] bg-[rgba(212,175,55,0.07)] text-white"
      : "rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase text-white/80 transition hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10";

  // CTA on the right depends on auth/paid status
  const ctaLink = !userEmail
    ? { href: "/signup", label: `Get Early Access — $${PRICING.beta}`, mobileLabel: "Get Access" }
    : !hasPaid
    ? { href: "/upgrade", label: "Upgrade", mobileLabel: "Upgrade" }
    : { href: "/chat", label: "Open Chat →", mobileLabel: "Open Chat" };

  const ctaClassDesktop =
    "rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase font-semibold bg-[color:var(--gold)] text-[#07060b] transition hover:opacity-90 whitespace-nowrap";

  const ctaClassMobile =
    "rounded-lg px-3 py-2 text-xs tracking-[0.08em] uppercase font-semibold bg-[color:var(--gold)] text-[#07060b] whitespace-nowrap";

  return (
    <header className="pt-6">
      {/* Mobile menu backdrop */}
      <div
        className={`fixed inset-0 z-30 lg:hidden transition-opacity duration-300 ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(7,6,11,0.75)", backdropFilter: "blur(4px)" }}
        onClick={() => setMenuOpen(false)}
      />
      <NavShell variant="floating">

        {/* ── Main row ── */}
        <div className="relative flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-baseline gap-3 shrink-0">
            <div className="text-[14px] tracking-[0.20em] uppercase">
              Bullion <span className="text-[color:var(--gold)]">Desk</span>
            </div>
          </Link>

          {/* Desktop nav — absolutely centered in the navbar */}
          <nav className="hidden lg:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right side */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link href={ctaLink.href} className={ctaClassDesktop}>
              {ctaLink.label}
            </Link>
            {userEmail && (
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
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center px-4 py-3 text-xs uppercase tracking-[0.10em] text-white/60 hover:bg-white/[0.04] hover:text-red-400 transition text-left disabled:opacity-40"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {!userEmail && (
              <Link
                href="/login"
                className="rounded-xl px-3 py-1.5 text-xs tracking-[0.08em] uppercase text-white/80 transition hover:text-white hover:bg-white/5 border border-white/10"
              >
                Log in
              </Link>
            )}
          </div>

          {/* Mobile right side */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <Link href={ctaLink.href} className={ctaClassMobile}>
              {ctaLink.mobileLabel}
            </Link>
            {userEmail ? (
              <Link href="/profile" className="flex items-center justify-center rounded-full border border-white/10 min-h-[44px] min-w-[44px]">
                <Avatar src={avatarUrl} size={32} />
              </Link>
            ) : null}
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
        <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden lg:hidden ${menuOpen ? "max-h-[500px]" : "max-h-0"}`}>
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
            {!userEmail && (
              <Link href="/login" className="rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase text-white/80 border border-white/10 hover:border-white/20 hover:text-white transition">
                Log in
              </Link>
            )}
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
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-xl px-4 min-h-[44px] flex items-center text-xs tracking-[0.10em] uppercase text-white/50 border border-white/10 hover:border-red-500/30 hover:text-red-400 transition text-left disabled:opacity-40"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            )}
          </nav>
        </div>
      </NavShell>
    </header>
  );
}
