import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/api/auth",
  "/upgrade",
  "/payment-success",
  "/api/stripe",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ── Paywall check — only when PAYWALL_ENABLED=true ───────────────────────
  if (process.env.PAYWALL_ENABLED === "true") {
    // Only protect these specific pages (not API routes handled separately)
    const PAYWALLED_PAGES = ["/", "/market", "/backtest", "/calendar", "/profile", "/methodology"];
    const isPaywalledPage = PAYWALLED_PAGES.some((p) =>
      p === "/" ? pathname === "/" : pathname.startsWith(p)
    );

    if (isPaywalledPage) {
      const { data: profile } = await supabase
        .from("users")
        .select("has_paid, free_analyses_used")
        .eq("id", user.id)
        .single();

      const hasPaid = profile?.has_paid ?? false;
      const freeUsed = profile?.free_analyses_used ?? 0;

      if (!hasPaid && freeUsed >= 2) {
        const url = request.nextUrl.clone();
        url.pathname = "/upgrade";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
