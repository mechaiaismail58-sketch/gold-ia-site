import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// BullionDesk middleware
//
// Public:     /, /about, /methodology, /terms, /privacy
// Auth pages: /login, /signup  → redirect when already logged in
// Paid:       /chat, /calendar, /market, /backtest, /dashboard
//             → requires auth + has_paid; unpaid → /upgrade
// Upgrade:    /upgrade → requires auth; already paid → /chat
// Protected:  everything else → requires auth
// Bypass:     admin_bypass cookie or /admin?secret=ADMIN_SECRET
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_PATHS  = ["/", "/about", "/methodology", "/terms", "/privacy"];
const AUTH_PATHS    = ["/login", "/signup"];
const PAID_PREFIXES = ["/chat", "/calendar", "/market", "/backtest", "/dashboard"];

async function getHasPaid(userId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return false;

    const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=has_paid&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey:        serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = await res.json() as Array<{ has_paid: boolean | null }>;
    return rows[0]?.has_paid === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Static assets ─────────────────────────────────────────────────────────
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // ── API routes ────────────────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ── Public pages ──────────────────────────────────────────────────────────
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // ── /admin bypass ─────────────────────────────────────────────────────────
  const adminSecret  = process.env.ADMIN_SECRET;
  const bypassCookie = request.cookies.get("admin_bypass")?.value;

  if (pathname.startsWith("/admin")) {
    const secret = request.nextUrl.searchParams.get("secret");
    if (adminSecret && secret === adminSecret) {
      const res = NextResponse.next({ request });
      res.cookies.set("admin_bypass", adminSecret, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        maxAge:   60 * 60 * 24,
        path:     "/",
        sameSite: "lax",
      });
      return res;
    }
    if (adminSecret && bypassCookie === adminSecret) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search   = "";
    return NextResponse.redirect(url);
  }

  if (adminSecret && bypassCookie === adminSecret) return NextResponse.next({ request });

  // ── Supabase auth — official SSR pattern ──────────────────────────────────
  // CRITICAL: supabaseResponse must be initialised with { request } and
  // reassigned inside setAll so refreshed session cookies are forwarded.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward cookies onto the request for downstream middleware
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild response so Set-Cookie headers reach the browser
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase — do NOT replace with getSession()
  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }

  // Helper: redirect while preserving refreshed cookies
  function redirect(toPath: string, search = ""): NextResponse {
    const url = request.nextUrl.clone();
    url.pathname = toPath;
    url.search   = search;
    const res = NextResponse.redirect(url);
    // Copy any refreshed session cookies so they survive the redirect
    supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
      res.cookies.set(name, value)
    );
    return res;
  }

  // ── Auth pages (/login, /signup) ──────────────────────────────────────────
  if (AUTH_PATHS.includes(pathname)) {
    if (user) {
      const hasPaid = await getHasPaid(user.id);
      return redirect(hasPaid ? "/chat" : "/upgrade");
    }
    return supabaseResponse;
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!user) {
    return redirect("/login", `?redirectTo=${encodeURIComponent(pathname)}`);
  }

  // ── /upgrade ──────────────────────────────────────────────────────────────
  if (pathname === "/upgrade") {
    const hasPaid = await getHasPaid(user.id);
    return hasPaid ? redirect("/chat") : supabaseResponse;
  }

  // ── Paid routes ───────────────────────────────────────────────────────────
  if (PAID_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasPaid = await getHasPaid(user.id);
    if (!hasPaid) return redirect("/upgrade");
    return supabaseResponse;
  }

  // ── Other protected pages ─────────────────────────────────────────────────
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match every path EXCEPT:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico   (browser requests automatically)
     * /chat IS matched. This regex is intentionally broad.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
