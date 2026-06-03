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

const PUBLIC_PATHS  = ["/", "/about", "/methodology", "/terms", "/privacy"];
const AUTH_PATHS    = ["/login", "/signup"];
const PAID_PREFIXES = ["/chat", "/calendar", "/market", "/backtest", "/dashboard"];

// Query has_paid via Supabase REST (Edge-compatible, bypasses RLS).
// Fails CLOSED (returns false) so an unauthenticated/unverified user is always
// sent to /upgrade rather than getting free access to paid routes.
async function getHasPaid(userId: string): Promise<boolean> {
  try {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return false; // config missing → deny

    const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=has_paid&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return false; // fail closed for payment check
    const rows = await res.json() as Array<{ has_paid: boolean | null }>;
    return rows[0]?.has_paid === true;
  } catch {
    return false; // fail closed — better to send to /upgrade than give free access
  }
}

function redirectTo(req: NextRequest, pathname: string, search = ""): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search   = search;
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Static assets & Next.js internals — always pass through ─────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── API routes — each route handles its own auth ─────────────────────────
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ── Purely public pages ──────────────────────────────────────────────────
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // ── /admin — bypass cookie or secret query param ─────────────────────────
  const adminSecret  = process.env.ADMIN_SECRET;
  const bypassCookie = req.cookies.get("admin_bypass")?.value;

  if (pathname.startsWith("/admin")) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (adminSecret && secret === adminSecret) {
      const res = NextResponse.next();
      res.cookies.set("admin_bypass", adminSecret, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        maxAge:   60 * 60 * 24,
        path:     "/",
        sameSite: "lax",
      });
      return res;
    }
    if (adminSecret && bypassCookie === adminSecret) return NextResponse.next();
    return redirectTo(req, "/login");
  }

  // ── admin_bypass cookie — full access ────────────────────────────────────
  if (adminSecret && bypassCookie === adminSecret) return NextResponse.next();

  // ── Supabase auth check ───────────────────────────────────────────────────
  // Wrapped in try/catch: if Supabase is unreachable, deny access (fail closed).
  let user: { id: string } | null = null;

  try {
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
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    // Supabase unreachable → treat as unauthenticated
    user = null;
  }

  // ── Auth pages: public when logged out, /chat when logged in ─────────────
  if (AUTH_PATHS.includes(pathname)) {
    if (user) {
      // Check payment status before deciding where to redirect logged-in users
      const hasPaid = await getHasPaid(user.id);
      return redirectTo(req, hasPaid ? "/chat" : "/upgrade");
    }
    return NextResponse.next();
  }

  // ── Not authenticated → /login ────────────────────────────────────────────
  if (!user) {
    return redirectTo(
      req,
      "/login",
      `?redirectTo=${encodeURIComponent(pathname)}`
    );
  }

  // ── /upgrade: requires auth; redirect to /chat if already paid ────────────
  if (pathname === "/upgrade") {
    const hasPaid = await getHasPaid(user.id);
    return hasPaid ? redirectTo(req, "/chat") : NextResponse.next();
  }

  // ── Paid routes: requires auth + has_paid ────────────────────────────────
  if (PAID_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasPaid = await getHasPaid(user.id);
    return hasPaid ? NextResponse.next() : redirectTo(req, "/upgrade");
  }

  // ── All other protected pages: auth is sufficient ────────────────────────
  return NextResponse.next();
}

export const config = {
  // Matches every path except Next.js static files and image optimization.
  // /chat IS matched. Explicitly keep this broad.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
