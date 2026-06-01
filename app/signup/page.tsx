"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getPasswordStrength(pwd: string): { bars: number; label: string; color: string } {
  if (pwd.length === 0) return { bars: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  if (score <= 1) return { bars: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { bars: 2, label: "Medium", color: "bg-yellow-400" };
  return { bars: 3, label: "Strong", color: "bg-emerald-400" };
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // Per-field touched state + errors
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [serverError, setServerError] = useState("");

  const emailError = emailTouched && email && !isValidEmail(email) ? "Enter a valid email address." : "";
  const passwordError = passwordTouched && password.length > 0 && password.length < 8 ? "Minimum 8 characters." : "";
  const confirmError = confirmTouched && confirm && confirm !== password ? "Passwords do not match." : "";

  const strength = getPasswordStrength(password);

  const canSubmit =
    !loading &&
    isValidEmail(email) &&
    password.length >= 8 &&
    confirm === password;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setServerError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || "Account creation failed.");
        return;
      }
      if (data.needsEmailConfirmation) {
        setSuccess("Account created. Check your email to confirm, then sign in.");
        return;
      }
      // Auto-login via browser client so onAuthStateChange fires and Header updates
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        router.push("/login");
        return;
      }
      router.push("/upgrade");
      router.refresh();
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4 py-12 animate-fade-in">
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">Sign In</div>
            <h1 className="text-[22px] tracking-[-0.02em]">Create your account</h1>
          </div>

          {success ? (
            <div className="text-[13px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06] rounded-xl px-4 py-4 text-center leading-relaxed">
              {success}
              <div className="mt-4">
                <Link href="/login" className="text-[12px] text-white/60 hover:text-white transition underline">
                  Go to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
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
                  onChange={(e) => { setEmail(e.target.value); setServerError(""); }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="your@email.com"
                  className={`w-full rounded-xl px-4 py-3 bg-transparent border text-white text-[16px] focus:outline-none transition placeholder:text-white/25 ${
                    emailError ? "border-red-500/60 focus:border-red-500" : "border-[color:var(--border)] focus:border-[rgba(109,40,217,0.75)]"
                  }`}
                />
                {emailError && (
                  <p className="mt-1.5 text-[11px] text-red-400">{emailError}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                  Password <span className="text-white/30">(min. 8 characters)</span>
                </label>
                <input
                  id="password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setServerError(""); }}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl px-4 py-3 bg-transparent border text-white text-[16px] focus:outline-none transition placeholder:text-white/25 ${
                    passwordError ? "border-red-500/60 focus:border-red-500" : "border-[color:var(--border)] focus:border-[rgba(109,40,217,0.75)]"
                  }`}
                />
                {/* Password strength bars */}
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            bar <= strength.bars ? strength.color : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[10px] font-mono tracking-wide ${
                      strength.bars === 1 ? "text-red-400" : strength.bars === 2 ? "text-yellow-400" : "text-emerald-400"
                    }`}>
                      {strength.label}
                    </span>
                  </div>
                )}
                {passwordError && (
                  <p className="mt-1.5 text-[11px] text-red-400">{passwordError}</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm" className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setServerError(""); }}
                  onBlur={() => setConfirmTouched(true)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl px-4 py-3 bg-transparent border text-white text-[16px] focus:outline-none transition placeholder:text-white/25 ${
                    confirmError ? "border-red-500/60 focus:border-red-500" : confirm && confirm === password ? "border-emerald-500/40" : "border-[color:var(--border)] focus:border-[rgba(109,40,217,0.75)]"
                  }`}
                />
                {confirmError && (
                  <p className="mt-1.5 text-[11px] text-red-400">{confirmError}</p>
                )}
                {confirm && confirm === password && !confirmError && (
                  <p className="mt-1.5 text-[11px] text-emerald-400">Passwords match ✓</p>
                )}
              </div>

              {serverError && (
                <p className="text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary w-full rounded-xl py-3 text-xs uppercase tracking-[0.14em] border border-[rgba(109,40,217,0.55)] text-white hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-40 disabled:cursor-not-allowed mt-2 min-h-[44px]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
            <span className="text-[12px] text-[color:var(--muted)]">Already have an account? </span>
            <Link href="/login" className="text-[12px] text-white hover:text-[color:var(--gold)] transition">Log in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
