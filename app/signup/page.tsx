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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
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
              <h1 className="text-2xl font-extrabold text-white">Create your account</h1>
              <p className="mt-1.5 text-sm text-[#A1A1AA]">Join the beta — $14.99 early access</p>
            </div>

            {success ? (
              <div className="text-[13px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06] rounded-xl px-4 py-4 text-center leading-relaxed">
                {success}
                <div className="mt-4">
                  <Link href="/login" className="text-[12px] text-[#A1A1AA] hover:text-white transition underline">
                    Go to Log In
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Email */}
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
                    onChange={(e) => { setEmail(e.target.value); setServerError(""); }}
                    onBlur={() => setEmailTouched(true)}
                    placeholder="your@email.com"
                    className={`auth-input w-full rounded-lg px-4 py-3 bg-white/5 border text-white text-[16px] placeholder-[#666] outline-none transition duration-200 ${
                      emailError ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30"
                    }`}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-[11px] text-red-400">{emailError}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA] mb-2">
                    Password <span className="text-[#A1A1AA]/60">(min. 8 characters)</span>
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
                    className={`auth-input w-full rounded-lg px-4 py-3 bg-white/5 border text-white text-[16px] placeholder-[#666] outline-none transition duration-200 ${
                      passwordError ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30"
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
                  <label htmlFor="confirm" className="block text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA] mb-2">
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
                    className={`auth-input w-full rounded-lg px-4 py-3 bg-white/5 border text-white text-[16px] placeholder-[#666] outline-none transition duration-200 ${
                      confirmError ? "border-red-500/60 focus:border-red-500" : confirm && confirm === password ? "border-emerald-500/40" : "border-white/10 focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30"
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
                  className="w-full rounded-lg py-3 font-bold bg-[#D4A843] text-black hover:brightness-110 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed mt-2 min-h-[44px]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                      Signing up…
                    </span>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
              <span className="text-[12px] text-[#A1A1AA]">Already have an account? </span>
              <Link href="/login" className="text-[12px] text-[#D4A843] hover:underline transition">Log in</Link>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-[#666]">
            🔒 Beta price ends soon. Standard: $39.99/mo
          </p>
        </div>
      </div>
    </div>
  );
}
