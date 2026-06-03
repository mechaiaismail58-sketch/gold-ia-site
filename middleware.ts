import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// BullionDesk routing
//
// Public:  /, /about, /methodology, /login, /signup, /api/demo-chat
// Bypass:  /admin?secret=ADMIN_SECRET  → sets cookie + redirects to /chat
//          admin_bypass cookie          → full access
// Auth:    Supabase session via supabase.auth.getUser()
// Private: everything else — redirect to /login
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/", "/about", "/methodology", "/login", "/signup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Static assets — always pass through ──────────────────────────────────
  if (pathname.includes(".") || pathname.startsWith("/_next")) return NextResponse.next();

  // ── API routes — always pass through (except specific protected ones) ─────
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // ── Public pages — no auth required ──────────────────────────────────────
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

  if (user) return res;

  // ── Not authenticated → redirect to /login ────────────────────────────────
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
