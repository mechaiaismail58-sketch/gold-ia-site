"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

type Props = {
  email: string;
  tradingHorizon: string;
  avatarUrl: string | null;
};

const HORIZONS = [
  { value: "scalp",    label: "Scalp" },
  { value: "daytrade", label: "Daytrade" },
  { value: "swing",    label: "Swing" },
] as const;

export default function ProfileClient({ email, tradingHorizon, avatarUrl }: Props) {
  const router = useRouter();
  const [horizon, setHorizon] = useState(tradingHorizon);
  const [savingHorizon, setSavingHorizon] = useState(false);
  const [horizonSaved, setHorizonSaved] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [scalpAlerts, setScalpAlerts] = useState<boolean | null>(null);
  const [swingAlerts, setSwingAlerts] = useState<boolean | null>(null);
  const [alertsSaved, setAlertsSaved] = useState(false);

  // Load actual push preferences from DB on mount
  useEffect(() => {
    fetch("/api/push/subscribe")
      .then((r) => r.json())
      .then((data) => {
        if (data.scalp_alerts !== null && data.scalp_alerts !== undefined) setScalpAlerts(data.scalp_alerts);
        if (data.swing_alerts !== null && data.swing_alerts !== undefined) setSwingAlerts(data.swing_alerts);
      })
      .catch(() => {});
  }, []);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveHorizon(val: string) {
    setHorizon(val);
    setSavingHorizon(true);
    setHorizonSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trading_horizon: val }),
      });
      setHorizonSaved(true);
      setTimeout(() => setHorizonSaved(false), 2000);
    } finally {
      setSavingHorizon(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function saveAlerts(scalp: boolean, swing: boolean) {
    setScalpAlerts(scalp ?? false);
    setSwingAlerts(swing ?? false);
    await fetch("/api/push/subscribe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scalp_alerts: scalp, swing_alerts: swing }),
    });
    setAlertsSaved(true);
    setTimeout(() => setAlertsSaved(false), 2000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error || "Upload failed.");
        return;
      }
      setCurrentAvatar(data.avatarUrl);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("Permanently delete your account? This action cannot be undone.")) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Account deletion failed.");
        return;
      }
      router.push("/signup");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <main className="text-white space-y-6">

      {/* ── Profile hero ── */}
      <section className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />
        <div className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              {/* Avatar with upload */}
              <div className="relative group shrink-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="block rounded-full focus:outline-none"
                  title="Change photo"
                >
                  <Avatar src={currentAvatar} size={72} />
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5 opacity-80">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">
                  Profile
                </div>
                <h1 className="text-[24px] sm:text-[30px] leading-[1.1] tracking-[-0.02em]">
                  My account
                </h1>
                <p className="mt-1 text-[color:var(--muted)] text-sm">{email}</p>
                {avatarError && <p className="mt-1 text-[11px] text-red-400">{avatarError}</p>}
              </div>
            </div>
            <div className="flex flex-row sm:flex-col items-end gap-2">
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/10 px-4 min-h-[44px] text-xs uppercase tracking-[0.10em] text-[color:var(--muted)] hover:border-red-500/30 hover:text-red-400 transition"
              >
                Sign out
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="rounded-xl border border-red-500/20 px-4 min-h-[44px] text-xs uppercase tracking-[0.10em] text-red-500/60 hover:border-red-500/50 hover:text-red-400 transition disabled:opacity-40"
              >
                {deletingAccount ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trading horizon ── */}
      <section className="card rounded-3xl border border-white/10 p-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">
          Preference
        </div>
        <h2 className="text-[20px] tracking-[-0.02em] mb-5">Trading horizon</h2>

        <div className="flex gap-3 flex-wrap">
          {HORIZONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => saveHorizon(value)}
              disabled={savingHorizon}
              className={
                horizon === value
                  ? "rounded-xl border border-[rgba(109,40,217,0.65)] bg-[rgba(109,40,217,0.14)] px-5 min-h-[44px] text-xs uppercase tracking-[0.12em] text-white transition"
                  : "rounded-xl border border-white/10 px-5 min-h-[44px] text-xs uppercase tracking-[0.12em] text-[color:var(--muted)] hover:border-white/20 hover:text-white transition"
              }
            >
              {label}
            </button>
          ))}
          {horizonSaved && (
            <span className="self-center text-[11px] text-emerald-400 tracking-[0.08em]">
              Saved
            </span>
          )}
        </div>
      </section>

      {/* ── Push alerts ── */}
      <section className="card rounded-3xl border border-white/10 p-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)] mb-1">Notifications</div>
        <h2 className="text-[20px] tracking-[-0.02em] mb-5">Automated alerts</h2>
        <div className="flex gap-4 flex-wrap items-center">
          {[
            { key: "scalp", label: "Scalp alerts", val: scalpAlerts, set: (v: boolean) => saveAlerts(v, swingAlerts ?? true) },
            { key: "swing", label: "Swing alerts", val: swingAlerts, set: (v: boolean) => saveAlerts(scalpAlerts ?? true, v) },
          ].map(({ key, label, val, set }) => (
            <button
              key={key}
              disabled={val === null}
              onClick={() => set(!(val ?? true))}
              className={`flex items-center gap-2 rounded-xl border px-4 min-h-[44px] text-xs uppercase tracking-[0.12em] transition disabled:opacity-40 ${
                val
                  ? "border-[rgba(109,40,217,0.65)] bg-[rgba(109,40,217,0.14)] text-white"
                  : "border-white/10 text-[color:var(--muted)] hover:border-white/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${val ? "bg-[rgba(139,92,246,1)]" : "bg-white/20"}`} />
              {label}
            </button>
          ))}
          {alertsSaved && <span className="text-[11px] text-emerald-400 tracking-[0.08em]">Saved</span>}
        </div>
        <p className="mt-3 text-[11px] text-white/30">
          Receive a push notification when the AI detects a valid signal.
        </p>
      </section>

    </main>
  );
}
