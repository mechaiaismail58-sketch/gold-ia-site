"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

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

      // 10 s hard timeout — prevents infinite "Signing in…" state
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      );

      const { error: signInError } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeoutPromise,
      ]);

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

      // onAuthStateChange fires → Header updates immediately
      router.push(from === "/login" ? "/" : from);
      router.refresh();
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      setError({ message: isTimeout ? "Request timed out — please try again." : "Network error — please try again." });
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
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 animate-fade-in">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.18)] blur-[110px]" />
        <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.10)] blur-[120px]" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </Link>
          <p className="mt-2 text-xs text-[color:var(--muted)] tracking-[0.12em] uppercase">
            AI Gold Trading Coach
          </p>
        </div>

        <div className="card border border-white/10 rounded-2xl p-8">
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">Log In</div>
            <h1 className="text-[22px] tracking-[-0.02em]">Access your account</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
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
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-[16px] focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
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
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-[16px] focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
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
              className="btn-primary w-full rounded-xl py-3 text-xs uppercase tracking-[0.14em] border border-[rgba(109,40,217,0.55)] text-white hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-40 disabled:cursor-not-allowed mt-2 min-h-[44px]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
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
                className="text-[12px] text-white/30 hover:text-white/60 transition disabled:opacity-40"
              >
                {forgotLoading ? "Sending…" : "Forgot password?"}
              </button>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
            <span className="text-[12px] text-[color:var(--muted)]">No account? </span>
            <Link href="/signup" className="text-[12px] text-white hover:text-[color:var(--gold)] transition">
              Sign in
            </Link>
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
