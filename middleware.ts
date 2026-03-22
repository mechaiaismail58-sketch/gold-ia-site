import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routes that bypass ALL checks — no session, no paywall.
 * NOTE: /api/stripe (all sub-routes) must be public so that
 *   - /api/stripe/create-checkout is reachable before payment
 *   - /api/stripe/webhook is reachable from Stripe servers (no cookie)
 */
const PUBLIC_PREFIXES = [
  "/_next",
  "/api/stripe",   // ALL stripe API routes (create-checkout + webhook)
  "/api/auth",     // signup, login, logout, etc.
  "/auth/callback",
  "/login",
  "/signup",
  "/upgrade",
  "/payment-success",
  "/about",
  "/methodology",
];

function isPublic(pathname: string): boolean {
  return (
    pathname.includes(".") || // static files (.ico, .png, .js …)
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"))
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // ── Auth + paywall check ────────────────────────────────────────────────
  // Service role key bypasses RLS so .from('users').has_paid is always readable.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        // Read-only — middleware never needs to write refreshed tokens
        // (Next.js parses chunked Supabase cookies by full name automatically)
        get: (name) => req.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  // getSession decodes the JWT from the cookie — no network round-trip
  const { data: { session } } = await supabase.auth.getSession();

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Authenticated — check has_paid ───────────────────────────────────────
  const { data: profile } = await supabase
    .from("users")
    .select("has_paid")
    .eq("id", session.user.id)
    .single();

  const hasPaid = profile?.has_paid === true;

  if (!hasPaid) {
    // Paid check failed — send to /upgrade (already public, no loop)
    const url = req.nextUrl.clone();
    url.pathname = "/upgrade";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
