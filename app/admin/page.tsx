import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Admin portal — only accessible with a valid admin_bypass cookie.
 * To activate: visit /admin?secret=YOUR_ADMIN_SECRET
 * The middleware sets the cookie and renders this page.
 */
export default async function AdminPage() {
  const cookieStore = await cookies();
  const bypass = cookieStore.get("admin_bypass")?.value;
  const adminSecret = process.env.ADMIN_SECRET;

  // Double-check: if cookie is missing or invalid, bounce to landing
  if (!adminSecret || bypass !== adminSecret) {
    redirect("/");
  }

  const links = [
    { href: "/",            label: "Landing (Waitlist)" },
    { href: "/chat",        label: "Chat — AI Console" },
    { href: "/market",      label: "Market" },
    { href: "/backtest",    label: "Backtest" },
    { href: "/calendar",    label: "Calendar" },
    { href: "/methodology", label: "Methodology" },
    { href: "/about",       label: "About" },
    { href: "/profile",     label: "Profile" },
    { href: "/upgrade",     label: "Upgrade" },
    { href: "/login",       label: "Login" },
    { href: "/signup",      label: "Sign up" },
  ];

  return (
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[15px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </div>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Admin Portal
          </p>
        </div>

        <div className="card border border-white/10 rounded-2xl overflow-hidden">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.40)] to-transparent" />
          <div className="p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/30 mb-3">
              Site Navigation
            </div>
            <nav className="flex flex-col gap-1">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl px-4 py-2.5 text-[13px] text-white/65 border border-white/[0.06] hover:border-white/15 hover:text-white/90 transition"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/20">
          Admin bypass active · 24 h session
        </p>
      </div>
    </div>
  );
}
