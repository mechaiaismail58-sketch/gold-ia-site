import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect server-side so the cleared-cookie Set-Cookie headers travel
  // with the 303 response even if client JS fails.
  const origin = request.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/login`, { status: 303 });

  // Explicitly expire any remaining Supabase session cookies on the response
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      res.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
  }

  return res;
}
