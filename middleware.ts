import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/upgrade",
  "/payment-success",
  "/about",
  "/methodology",
  "/auth/callback",
  "/api/stripe/webhook",
  "/api/auth",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Always pass through static assets and public routes
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
  ) {
    return res;
  }

  // Use service role key to bypass RLS when reading has_paid
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: (n) => req.cookies.get(n)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  // getSession reads the JWT from cookie — no network call
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not authenticated → /login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated → check has_paid (service role bypasses RLS)
  const { data: profile } = await supabase
    .from("users")
    .select("has_paid")
    .eq("id", session.user.id)
    .single();

  // Not paid → /upgrade
  if (!profile?.has_paid) {
    return NextResponse.redirect(new URL("/upgrade", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
