import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Always public — no auth or paywall check at all
const ALWAYS_PUBLIC = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
  "/api/auth",
  "/payment-success",
  "/api/stripe",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    ALWAYS_PUBLIC.some((p) => pathname.startsWith(p)) ||
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

  // Not authenticated → /login
  // If trying to reach /upgrade without auth, send to / after login (middleware will re-route)
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname === "/upgrade" ? "/" : pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated — check has_paid using service role key (bypasses RLS)
  let hasPaid = false;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin
      .from("users")
      .select("has_paid")
      .eq("id", user.id)
      .single();
    hasPaid = profile?.has_paid ?? false;
  }

  // Authenticated + paid → redirect away from /upgrade to /
  if (pathname === "/upgrade" && hasPaid) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Authenticated + not paid + not on /upgrade → redirect to /upgrade
  if (!hasPaid && pathname !== "/upgrade") {
    const url = request.nextUrl.clone();
    url.pathname = "/upgrade";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
