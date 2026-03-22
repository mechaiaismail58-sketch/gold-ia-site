"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError("Minimum 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07060b] flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-80px] left-[50%] -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[16px] tracking-[0.22em] uppercase text-white">
            Bullion <span className="text-[color:var(--gold)]">Desk</span>
          </div>
        </div>

        <div className="card border border-white/10 rounded-2xl p-8">
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">Security</div>
            <h1 className="text-[22px] tracking-[-0.02em]">New password</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                New password <span className="text-white/30">(min. 8 characters)</span>
              </label>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-sm focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)] mb-2">
                Confirm
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 bg-transparent border border-[color:var(--border)] text-white text-sm focus:outline-none focus:border-[rgba(109,40,217,0.75)] transition placeholder:text-white/25"
              />
            </div>

            {error && (
              <p className="text-[12px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-xs uppercase tracking-[0.14em] border border-[rgba(109,40,217,0.55)] text-white transition hover:border-[rgba(109,40,217,0.95)] hover:bg-[rgba(109,40,217,0.10)] disabled:opacity-50 mt-2"
            >
              {loading ? "Saving…" : "Set password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
