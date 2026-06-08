"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("redirectTo") || "/chat";
  // Sanitise: only allow relative paths to prevent open redirect
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") && raw !== "/login" ? raw : "/chat";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ message: string; noAccount?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes("email not confirmed")) {
          setError({ message: "Email not confirmed. Check your inbox." });
        } else if (msg.includes("invalid login credentials") || msg.includes("invalid") || msg.includes("user not found")) {
          setError({ message: "No account found with that email or password.", noAccount: true });
        } else {
          setError({ message: signInError.message });
        }
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error — please try again.";
      setError({ message: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError({ message: "Enter your email above first." }); return; }
    setError(null);
    setForgotLoading(true);
    try {
      const supabase = createClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      });
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <style>{`
        @keyframes auth-form-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-form-in {
          animation: auth-form-in 500ms ease-out both;
        }
        .auth-input:focus-visible {
          outline: none;
        }
      `}</style>

      {/* Background glows — purple/violet + gold counterpoint, matching the landing page */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute -top-28 right-[-180px] h-[520px] w-[520px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[60px] left-[-200px] h-[480px] w-[480px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(109,40,217,0.16) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-220px] left-[18%] h-[520px] w-[520px] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, rgba(212,168,67,0.09) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-md auth-form-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[#D4A843]">Desk</span>
          </Link>
          <p className="mt-2 text-xs text-[#A1A1AA] tracking-[0.12em] uppercase">
            AI Gold Trading Coach
          </p>
        </div>

        <div className="relative">
          {/* Subtle gold glow behind the form card */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="h-[420px] w-[420px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(212,168,67,0.10) 0%, transparent 70%)" }}
            />
          </div>

          <div className="rounded-2xl border border-white/5 bg-[rgba(17,17,17,0.6)] backdrop-blur-xl p-8 max-w-md">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-white">Welcome back</h1>
              <p className="mt-1.5 text-sm text-[#A1A1AA]">Sign in to your AI trading coach</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  placeholder="your@email.com"
                  className="auth-input w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white text-[16px] placeholder-[#666] outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30 transition duration-200"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA] mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  className="auth-input w-full rounded-lg px-4 py-3 bg-white/5 border border-white/10 text-white text-[16px] placeholder-[#666] outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30 transition duration-200"
                />
              </div>

              {error && (
                <div className="text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                  {error.message}
                  {error.noAccount && (
                    <>
                      {" "}
                      <Link href="/signup" className="underline text-red-300 hover:text-white transition">
                        Create account →
                      </Link>
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-lg py-3 font-bold bg-[#D4A843] text-black hover:brightness-110 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2 min-h-[44px]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                    Logging in…
                  </span>
                ) : (
                  "Log in"
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              {forgotSent ? (
                <p className="text-[12px] text-emerald-400">Reset link sent — check your inbox.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="text-[12px] text-[#A1A1AA] hover:text-white transition disabled:opacity-40"
                >
                  {forgotLoading ? "Sending…" : "Forgot password?"}
                </button>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
              <span className="text-[12px] text-[#A1A1AA]">No account? </span>
              <Link href="/signup" className="text-[12px] text-[#D4A843] hover:underline transition">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
