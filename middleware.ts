import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// BullionDesk routing
//
// Public:  /  (waitlist landing)
// Bypass:  /admin?secret=ADMIN_SECRET  → sets cookie + redirects to /chat
// Private: everything else — requires admin_bypass cookie
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── API routes + static assets — always pass through ─────────────────────
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (pathname.includes(".") || pathname.startsWith("/_next")) return NextResponse.next();

  const adminSecret = process.env.ADMIN_SECRET;

  // Check for valid admin bypass cookie
  const bypassValue = req.cookies.get("admin_bypass")?.value;
  const hasBypass = Boolean(adminSecret && bypassValue === adminSecret);

  // ── /admin — bypass entry point ───────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (adminSecret && secret === adminSecret) {
      // Valid secret → set cookie, show admin portal
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
    // Public — no auth required
    return NextResponse.next();
  }

  // ── Public pages — no auth required ──────────────────────────────────────
  const PUBLIC_PATHS = ["/", "/about", "/methodology", "/login", "/signup", "/admin", "/chat"];
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  // ── Bypassed users — full access ─────────────────────────────────────────
  if (hasBypass) return NextResponse.next();

  // ── Everyone else → back to landing ─────────────────────────────────────
  const dest = req.nextUrl.clone();
  dest.pathname = "/";
  dest.search = "";
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
