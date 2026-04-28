import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// WAITLIST MODE — controlled by WAITLIST_MODE=true env var in Vercel
// Flip to false (or remove the var) to restore the full site with no redeploy.
// ─────────────────────────────────────────────────────────────────────────────

// ── Normal-mode public prefixes (auth / stripe / static) ────────────────────
const NORMAL_PUBLIC_PREFIXES = [
  "/_next",
  "/api/stripe",
  "/api/auth",
  "/auth/callback",
  "/login",
  "/signup",
  "/upgrade",
  "/payment-success",
  "/about",
  "/methodology",
  "/partners",
];

function isNormalPublic(pathname: string): boolean {
  return (
    pathname.includes(".") ||
    NORMAL_PUBLIC_PREFIXES.some(
      (p) =>
        pathname === p ||
        pathname.startsWith(p + "/") ||
        pathname.startsWith(p + "?")
    )
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Diagnostic — visible in Vercel Function Logs
  const waitlistRaw = process.env.WAITLIST_MODE;
  console.log(`[middleware] WAITLIST_MODE="${waitlistRaw}" pathname="${pathname}"`);

  // ── API routes — ALWAYS pass through, they have their own auth ──────────
  // This MUST be the very first check, before any other logic.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Static files — always pass (both modes)
  if (pathname.includes(".") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WAITLIST MODE — trim() guards against trailing newlines from CLI input
  // ══════════════════════════════════════════════════════════════════════════
  if (waitlistRaw?.trim() === "true") {
    const adminSecret = process.env.ADMIN_SECRET;

    // ── Admin bypass cookie → full access ───────────────────────────────────
    if (adminSecret) {
      const bypassCookie = req.cookies.get("admin_bypass")?.value;
      if (bypassCookie === adminSecret) {
        return NextResponse.next();
      }
    }

    // ── /admin + correct secret → set bypass cookie ──────────────────────────
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
      // /admin without valid secret → redirect to landing
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // ── Auth routes — always accessible (admin needs to log in) ─────────────
    if (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname.startsWith("/auth/")
    ) {
      return NextResponse.next();
    }

    // ── Landing page + public pages ─────────────────────────────────────────
    if (pathname === "/" || pathname === "/partners") {
      return NextResponse.next();
    }

    // ── Everything else → waitlist landing ──────────────────────────────────
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NORMAL MODE — existing auth + paywall logic (unchanged)
  // ══════════════════════════════════════════════════════════════════════════

  if (isNormalPublic(pathname)) return NextResponse.next();

  // Service role key bypasses RLS so .from('users').has_paid is always readable.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  // getSession decodes the JWT from the cookie — no network round-trip
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // TEMP BYPASS — paywall disabled. Re-enable by uncommenting the block below.
  return NextResponse.next();

  /* PAYWALL — re-enable when ready
  const { data: profile } = await supabase
    .from("users")
    .select("has_paid")
    .eq("id", session.user.id)
    .single();

  const hasPaid = profile?.has_paid === true;

  if (!hasPaid) {
    const url = req.nextUrl.clone();
    url.pathname = "/upgrade";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
  */
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
