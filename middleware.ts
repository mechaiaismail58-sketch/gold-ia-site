import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// BullionDesk routing
//
// Public:     /, /about, /methodology, /terms, /privacy
// Auth pages: /login, /signup  → redirect to /chat if already logged in
// Paid:       /chat, /calendar, /market, /backtest, /dashboard
//             → requires auth + has_paid; unpaid → /upgrade
// Upgrade:    /upgrade → requires auth; already paid → /chat
// Protected:  everything else → requires auth only
// Bypass:     admin_bypass cookie or /admin?secret=ADMIN_SECRET
// ─────────────────────────────────────────────────────────────────────────────

// Pages that never require a session
const PUBLIC_PATHS = ["/", "/about", "/methodology", "/terms", "/privacy"];
// Auth pages: public when logged out, redirect to /chat when logged in
const AUTH_PATHS = ["/login", "/signup"];
// Routes that require auth AND has_paid = true
const PAID_PREFIXES = ["/chat", "/calendar", "/market", "/backtest", "/dashboard"];

// Query has_paid directly via Supabase REST (Edge-compatible, bypasses RLS).
// Fails open (returns true) so paid users are never wrongly blocked if the DB
// is temporarily unreachable.
async function getHasPaid(userId: string): Promise<boolean> {
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=has_paid&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return true; // fail open
    const [row] = await res.json() as Array<{ has_paid: boolean | null }>;
    return row?.has_paid === true;
  } catch {
    return true; // fail open — don't block paid users if DB is unreachable
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Static assets — always pass through ──────────────────────────────────
  if (pathname.includes(".") || pathname.startsWith("/_next")) return NextResponse.next();

  // ── API routes — always pass through (each route handles its own auth) ────
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ── Purely public pages — no auth check needed ───────────────────────────
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const adminSecret = process.env.ADMIN_SECRET;

  // ── /admin — cookie-only access (Supabase session not sufficient) ──────────
  if (pathname.startsWith("/admin")) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (adminSecret && secret === adminSecret) {
      const res = NextResponse.next();
      res.cookies.set("admin_bypass", adminSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 24 h
        path: "/",
        sameSite: "lax",
      });
      return res;
    }
    const bypassValue = req.cookies.get("admin_bypass")?.value;
    if (adminSecret && bypassValue === adminSecret) return NextResponse.next();
    // No valid secret or cookie — deny even authenticated Supabase users
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // ── admin_bypass cookie — full access to other protected routes ───────────
  const bypassValue = req.cookies.get("admin_bypass")?.value;
  if (adminSecret && bypassValue === adminSecret) return NextResponse.next();

  // ── Supabase session check ────────────────────────────────────────────────
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── Auth pages (/login, /signup) — redirect to /chat if already logged in ─
  if (AUTH_PATHS.includes(pathname)) {
    if (user) {
      const chatUrl = req.nextUrl.clone();
      chatUrl.pathname = "/chat";
      chatUrl.search = "";
      return NextResponse.redirect(chatUrl);
    }
    return res;
  }

  // ── Not authenticated → redirect to /login with return destination ─────────
  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?redirectTo=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  // ── /upgrade — authenticated only; redirect to /chat if already paid ───────
  if (pathname === "/upgrade") {
    const hasPaid = await getHasPaid(user.id);
    if (hasPaid) {
      const chatUrl = req.nextUrl.clone();
      chatUrl.pathname = "/chat";
      chatUrl.search = "";
      return NextResponse.redirect(chatUrl);
    }
    return res;
  }

  // ── Paid routes — require has_paid; unpaid users go to /upgrade ───────────
  if (PAID_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasPaid = await getHasPaid(user.id);
    if (!hasPaid) {
      const upgradeUrl = req.nextUrl.clone();
      upgradeUrl.pathname = "/upgrade";
      upgradeUrl.search = "";
      return NextResponse.redirect(upgradeUrl);
    }
    return res;
  }

  // ── All other protected pages — auth sufficient ────────────────────────────
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
