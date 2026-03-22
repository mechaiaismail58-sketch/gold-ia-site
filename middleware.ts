import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Completely bypass — no auth check, no paywall
const SKIP_PATHS = [
  "/api/auth",
  "/api/stripe",
  "/auth/callback",
  "/payment-success",
  "/reset-password",
];

async function getHasPaid(userId: string): Promise<boolean> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return false;
  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data } = await admin
    .from("users")
    .select("has_paid")
    .eq("id", userId)
    .single();
  return data?.has_paid ?? false;
}

// Copy refreshed session cookies onto any response we return.
// CRITICAL: if setAll() ran during getUser() (token refresh), the new cookies
// must travel on EVERY response — including redirects — or the next request
// will look unauthenticated and trigger an infinite /login loop.
function withCookies(redirect: NextResponse, base: NextResponse): NextResponse {
  base.cookies.getAll().forEach(({ name, value, ...opts }) => {
    redirect.cookies.set(name, value, opts as Parameters<typeof redirect.cookies.set>[2]);
  });
  return redirect;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets — skip immediately
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Completely bypass paths (no session needed)
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
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

  // /login and /signup: redirect authenticated users to the right destination
  if (pathname === "/login" || pathname === "/signup") {
    if (!user) return response; // Not logged in — show page (carry any refreshed cookies)
    const hasPaid = await getHasPaid(user.id);
    const url = request.nextUrl.clone();
    url.pathname = hasPaid ? "/" : "/upgrade";
    return withCookies(NextResponse.redirect(url), response);
  }

  // All protected paths — require authentication
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname === "/upgrade" ? "/" : pathname);
    return withCookies(NextResponse.redirect(url), response);
  }

  // Authenticated — check has_paid
  const hasPaid = await getHasPaid(user.id);

  // Paid + on /upgrade → redirect to /
  if (pathname === "/upgrade" && hasPaid) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withCookies(NextResponse.redirect(url), response);
  }

  // Not paid + not on /upgrade → redirect to /upgrade
  if (!hasPaid && pathname !== "/upgrade") {
    const url = request.nextUrl.clone();
    url.pathname = "/upgrade";
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
