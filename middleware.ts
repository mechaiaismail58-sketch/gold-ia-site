import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Always pass through — no auth check whatsoever
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
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

  // Static assets
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return res;
  }

  // Fully public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return res;
  }

  // Use service role key — bypasses RLS when reading has_paid
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

  // Read session from cookie (no network call)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // /upgrade: accessible to everyone; paid users get sent to /
  if (pathname.startsWith("/upgrade")) {
    if (session) {
      const { data: profile } = await supabase
        .from("users")
        .select("has_paid")
        .eq("id", session.user.id)
        .single();
      if (profile?.has_paid) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return res; // unauthenticated or unpaid → show /upgrade
  }

  // All other routes — require authentication
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Authenticated — check has_paid
  const { data: profile } = await supabase
    .from("users")
    .select("has_paid")
    .eq("id", session.user.id)
    .single();

  if (!profile?.has_paid) {
    return NextResponse.redirect(new URL("/upgrade", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
