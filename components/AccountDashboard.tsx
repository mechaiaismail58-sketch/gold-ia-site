"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type SnapshotData = {
  account_balance:   number;
  daily_dd:          number;
  total_dd:          number;
  daily_profit:      number;
  total_profit:      number;
  trade_count_today: number;
  trade_count_month: number;
  trading_days:      number;
  best_day_profit:   number;
};

type AccountProfile = {
  prop_firm:       string | null;
  prop_firm_phase: string | null;
  account_type:    string | null;
};

type Limits = {
  daily_dd_pct:     number | null;
  total_dd_pct:     number | null;
  profit_target_pct: number | null;
  min_trading_days: number | null;
  consistency_pct:  number | null;
};

type DDStatus = "SAFE" | "CAUTION" | "DANGER";
type RuleStatus = "ok" | "warning" | "violation";

// ── Prop firm limits ──────────────────────────────────────────────────────────

const FIRM_LIMITS: Record<string, Record<string, Limits>> = {
  FTMO: {
    challenge_1: { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 10, min_trading_days: 4, consistency_pct: 40 },
    challenge_2: { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 5,  min_trading_days: 4, consistency_pct: 40 },
    funded:      { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 5,  min_trading_days: null, consistency_pct: 40 },
  },
  The5ers: {
    challenge_1: { daily_dd_pct: 4, total_dd_pct: 5, profit_target_pct: 8,  min_trading_days: null, consistency_pct: null },
    challenge_2: { daily_dd_pct: 4, total_dd_pct: 5, profit_target_pct: 8,  min_trading_days: null, consistency_pct: null },
    funded:      { daily_dd_pct: 4, total_dd_pct: 5, profit_target_pct: 8,  min_trading_days: null, consistency_pct: null },
  },
  E8: {
    challenge_1: { daily_dd_pct: 5, total_dd_pct: 8, profit_target_pct: 8,  min_trading_days: null, consistency_pct: 40 },
    challenge_2: { daily_dd_pct: 5, total_dd_pct: 8, profit_target_pct: 5,  min_trading_days: null, consistency_pct: 40 },
    funded:      { daily_dd_pct: 5, total_dd_pct: 8, profit_target_pct: 5,  min_trading_days: null, consistency_pct: 40 },
  },
  FundedNext: {
    challenge_1: { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 10, min_trading_days: null, consistency_pct: null },
    challenge_2: { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 5,  min_trading_days: null, consistency_pct: null },
    funded:      { daily_dd_pct: 5, total_dd_pct: 10, profit_target_pct: 5,  min_trading_days: null, consistency_pct: null },
  },
  BlueGuardian: {
    challenge_1: { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 8,  min_trading_days: null, consistency_pct: 40 },
    challenge_2: { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 8,  min_trading_days: null, consistency_pct: 40 },
    funded:      { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 8,  min_trading_days: null, consistency_pct: 40 },
  },
  AlphaCapital: {
    challenge_1: { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 8,  min_trading_days: 5, consistency_pct: null },
    challenge_2: { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 5,  min_trading_days: 5, consistency_pct: null },
    funded:      { daily_dd_pct: 4, total_dd_pct: 8, profit_target_pct: 5,  min_trading_days: 5, consistency_pct: null },
  },
  Apex: {
    challenge_1: { daily_dd_pct: null, total_dd_pct: null, profit_target_pct: null, min_trading_days: null, consistency_pct: null },
    challenge_2: { daily_dd_pct: null, total_dd_pct: null, profit_target_pct: null, min_trading_days: null, consistency_pct: null },
    funded:      { daily_dd_pct: null, total_dd_pct: null, profit_target_pct: null, min_trading_days: null, consistency_pct: null },
  },
};

const DEFAULT_LIMITS: Limits = { daily_dd_pct: null, total_dd_pct: null, profit_target_pct: null, min_trading_days: null, consistency_pct: null };

function getLimits(firm: string | null, phase: string | null): Limits {
  if (!firm || firm === "Other") return DEFAULT_LIMITS;
  return FIRM_LIMITS[firm]?.[phase ?? "challenge_1"] ?? DEFAULT_LIMITS;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function fmtSign(n: number, decimals = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

function getDDStatus(used: number, limit: number | null): DDStatus {
  if (!limit || limit <= 0) return "SAFE";
  const r = used / limit;
  if (r < 0.4) return "SAFE";
  if (r < 0.7) return "CAUTION";
  return "DANGER";
}

function phaseLabel(phase: string | null): string {
  const map: Record<string, string> = {
    challenge_1: "Challenge P1",
    challenge_2: "Challenge P2",
    funded: "Funded",
    personal: "Personnel",
  };
  return phase ? (map[phase] ?? phase) : "—";
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOLD    = "#C9A84C";
const SAFE_C  = "#4CAF75";
const CAUTION_C = "#F59E0B";
const DANGER_C  = "#E05252";
const MUTED   = "rgba(255,255,255,0.28)";
const STATUS_COLOR: Record<DDStatus, string> = { SAFE: SAFE_C, CAUTION: CAUTION_C, DANGER: DANGER_C };

const cardStyle: React.CSSProperties = {
  background: "rgba(10,8,18,0.8)",
  border: "1px solid rgba(201,162,78,0.10)",
  borderRadius: 12,
  padding: "14px 16px",
};

const metricTitle: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
  color: "rgba(201,162,78,0.55)", fontFamily: "monospace", marginBottom: 6,
};

const metricMain: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 600,
  color: "#F5F0E8", lineHeight: 1.2,
};

const metricSub: React.CSSProperties = {
  fontSize: 10, color: MUTED, fontFamily: "monospace", marginTop: 4,
};

const EMPTY: SnapshotData = {
  account_balance: 0, daily_dd: 0, total_dd: 0,
  daily_profit: 0, total_profit: 0,
  trade_count_today: 0, trade_count_month: 0,
  trading_days: 0, best_day_profit: 0,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

function StatusBadge({ status }: { status: DDStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ fontSize: 9, letterSpacing: "0.15em", fontFamily: "monospace", padding: "3px 8px", borderRadius: 4, background: `${c}20`, color: c, border: `1px solid ${c}44` }}>
      {status}
    </span>
  );
}

function RuleRow({ label, status, note }: { label: string; status: RuleStatus; note: string }) {
  const icon  = { ok: "✓", warning: "⚠", violation: "✗" }[status];
  const color = { ok: SAFE_C, warning: CAUTION_C, violation: DANGER_C }[status];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ color, fontFamily: "monospace", fontSize: 12, flexShrink: 0, lineHeight: 1.4 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 11, color, fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 10, color: MUTED, marginLeft: 6 }}>{note}</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, prefix = "$" }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4, fontFamily: "monospace" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
        <span style={{ padding: "8px 10px", fontSize: 12, color: MUTED, background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.06)", fontFamily: "monospace" }}>
          {prefix}
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#fff", fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AccountDashboard() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [snap, setSnap]       = useState<SnapshotData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/account/snapshot");
      if (!r.ok) return;
      const data = await r.json();
      if (data.profile)  setProfile(data.profile);
      if (data.snapshot) setSnap(data.snapshot);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openModal() {
    setForm({
      account_balance:   String(snap.account_balance),
      daily_dd:          String(snap.daily_dd),
      total_dd:          String(snap.total_dd),
      daily_profit:      String(snap.daily_profit),
      total_profit:      String(snap.total_profit),
      best_day_profit:   String(snap.best_day_profit),
      trade_count_today: String(snap.trade_count_today),
      trade_count_month: String(snap.trade_count_month),
      trading_days:      String(snap.trading_days),
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseFloat(v) || 0]));
      const r = await fetch("/api/account/snapshot", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) { const d = await r.json(); if (d.snapshot) setSnap(d.snapshot); setShowModal(false); }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const limits = getLimits(profile?.prop_firm ?? null, profile?.prop_firm_phase ?? null);
  const bal    = snap.account_balance;

  const dailyDDLimit  = limits.daily_dd_pct  && bal > 0 ? bal * (limits.daily_dd_pct  / 100) : null;
  const totalDDLimit  = limits.total_dd_pct  && bal > 0 ? bal * (limits.total_dd_pct  / 100) : null;
  const profitTarget  = limits.profit_target_pct && bal > 0 ? bal * (limits.profit_target_pct / 100) : null;

  const dailyDDPct   = bal > 0 ? (snap.daily_dd  / bal) * 100 : 0;
  const totalDDPct   = bal > 0 ? (snap.total_dd  / bal) * 100 : 0;
  const profitPct    = bal > 0 ? (snap.total_profit / bal) * 100 : 0;

  const overallStatus = getDDStatus(snap.daily_dd, dailyDDLimit);
  const firmLabel     = profile?.prop_firm === "Other" ? "Other" : profile?.prop_firm ?? "Personal Account";
  const phaseStr      = phaseLabel(profile?.prop_firm_phase ?? null);

  const dailyRemaining = dailyDDLimit !== null ? Math.max(0, dailyDDLimit - snap.daily_dd) : null;

  // ── Rules ───────────────────────────────────────────────────────────────────
  type Rule = { label: string; status: RuleStatus; note: string };
  const rules: Rule[] = [];

  if (limits.daily_dd_pct !== null && dailyDDLimit !== null) {
    const r = (snap.daily_dd / dailyDDLimit) * 100;
    rules.push({ label: "DD journalier", status: r > 100 ? "violation" : r > 70 ? "warning" : "ok", note: `${dailyDDPct.toFixed(2)}% / ${limits.daily_dd_pct}% max` });
  }
  if (limits.total_dd_pct !== null && totalDDLimit !== null) {
    const r = (snap.total_dd / totalDDLimit) * 100;
    rules.push({ label: "DD total", status: r > 100 ? "violation" : r > 70 ? "warning" : "ok", note: `${totalDDPct.toFixed(2)}% / ${limits.total_dd_pct}% max` });
  }
  if (limits.consistency_pct !== null && snap.total_profit > 0 && snap.best_day_profit > 0) {
    const c = (snap.best_day_profit / snap.total_profit) * 100;
    const lim = limits.consistency_pct;
    rules.push({ label: "Cohérence", status: c > lim ? "violation" : c > lim * 0.85 ? "warning" : "ok", note: `meilleur jour = ${c.toFixed(0)}% du profit total (limite ${lim}%)` });
  }
  if (limits.min_trading_days !== null) {
    rules.push({ label: "Jours minimum", status: snap.trading_days >= limits.min_trading_days ? "ok" : "warning", note: `${snap.trading_days}/${limits.min_trading_days} jours` });
  }

  if (loading) {
    return <section className="mt-6"><div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>Chargement…</div></section>;
  }

  return (
    <section className="mt-6">

      {/* ── BLOC 1 — En-tête compte ────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "inline-block", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#F5F0E8", letterSpacing: "-0.01em" }}>
                {firmLabel}
              </div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", marginTop: 2 }}>
                {phaseStr}
                {bal > 0 && <span style={{ marginLeft: 10, color: "rgba(201,162,78,0.6)" }}>{fmtUSD(bal)}</span>}
              </div>
            </div>
          </div>
          <StatusBadge status={overallStatus} />
        </div>
      </div>

      {/* ── BLOC 2 — Métriques (grille 3×2) ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>

        {/* 1. DD Journalier */}
        <div style={cardStyle}>
          <div style={metricTitle}>Daily DD</div>
          <div style={{ ...metricMain, color: STATUS_COLOR[overallStatus] }}>
            {fmtUSD(snap.daily_dd)}
          </div>
          <div style={metricSub}>{dailyDDPct.toFixed(2)}% of capital</div>
          {dailyDDLimit !== null && (
            <>
              <ProgressBar pct={(snap.daily_dd / dailyDDLimit) * 100} color={STATUS_COLOR[overallStatus]} />
              <div style={{ ...metricSub, marginTop: 4, fontSize: 9 }}>Limite : {fmtUSD(dailyDDLimit)} / {limits.daily_dd_pct}%</div>
            </>
          )}
        </div>

        {/* 2. DD Total */}
        <div style={cardStyle}>
          <div style={metricTitle}>Total DD</div>
          <div style={{ ...metricMain, color: totalDDLimit && snap.total_dd / totalDDLimit > 0.7 ? CAUTION_C : "#F5F0E8" }}>
            {fmtUSD(snap.total_dd)}
          </div>
          <div style={metricSub}>{totalDDPct.toFixed(2)}% of capital</div>
          {totalDDLimit !== null && (
            <>
              <ProgressBar pct={(snap.total_dd / totalDDLimit) * 100} color={totalDDLimit && snap.total_dd / totalDDLimit > 0.7 ? CAUTION_C : SAFE_C} />
              <div style={{ ...metricSub, marginTop: 4, fontSize: 9 }}>Limite : {fmtUSD(totalDDLimit)} / {limits.total_dd_pct}%</div>
            </>
          )}
        </div>

        {/* 3. Profit Mois */}
        <div style={cardStyle}>
          <div style={metricTitle}>Monthly P&amp;L</div>
          <div style={{ ...metricMain, color: snap.total_profit >= 0 ? SAFE_C : DANGER_C }}>
            {fmtUSD(snap.total_profit)}
          </div>
          <div style={metricSub}>
            {fmtSign(profitPct)}
            {snap.daily_profit !== 0 && <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.2)" }}>· Jour: {fmtUSD(snap.daily_profit)}</span>}
          </div>
          {profitTarget !== null && profitTarget > 0 && (
            <>
              <ProgressBar pct={Math.max(0, (snap.total_profit / profitTarget) * 100)} color={GOLD} />
              <div style={{ ...metricSub, marginTop: 4, fontSize: 9 }}>Objectif : {fmtUSD(profitTarget)} / +{limits.profit_target_pct}%</div>
            </>
          )}
        </div>

        {/* 4. Trades */}
        <div style={cardStyle}>
          <div style={metricTitle}>Trades</div>
          <div style={metricMain}>{snap.trade_count_today}</div>
          <div style={metricSub}>today</div>
          {snap.trade_count_month > 0 && <div style={{ ...metricSub, marginTop: 2 }}>{snap.trade_count_month} this month</div>}
        </div>

        {/* 5. Jours tradés */}
        <div style={cardStyle}>
          <div style={metricTitle}>Trading Days</div>
          <div style={{ ...metricMain, color: limits.min_trading_days && snap.trading_days >= limits.min_trading_days ? SAFE_C : "#F5F0E8" }}>
            {snap.trading_days}
          </div>
          {limits.min_trading_days !== null ? (
            <div style={{ ...metricSub, color: snap.trading_days >= limits.min_trading_days ? SAFE_C : CAUTION_C }}>
              / {limits.min_trading_days} min {snap.trading_days >= limits.min_trading_days ? "✓" : "⚠"}
            </div>
          ) : (
            <div style={metricSub}>this month</div>
          )}
        </div>

        {/* 6. Marge journalière */}
        <div style={cardStyle}>
          <div style={metricTitle}>Daily Margin</div>
          {dailyDDLimit !== null && dailyRemaining !== null ? (
            <>
              <div style={{ ...metricMain, color: STATUS_COLOR[overallStatus] }}>
                {fmtUSD(dailyRemaining)}
              </div>
              <div style={{ ...metricSub, color: STATUS_COLOR[overallStatus] }}>
                {dailyDDLimit > 0 ? `${((dailyRemaining / dailyDDLimit) * 100).toFixed(1)}% restant` : "—"}
              </div>
            </>
          ) : (
            <>
              <div style={metricMain}>—</div>
              <div style={metricSub}>Set your balance</div>
            </>
          )}
        </div>

      </div>

      {/* ── BLOC 3 — Règles prop firm ─────────────────────────── */}
      {rules.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 8 }}>
          <div style={{ ...metricTitle, marginBottom: 10 }}>Règles {firmLabel}</div>
          {rules.map((r) => (
            <RuleRow key={r.label} label={r.label} status={r.status} note={r.note} />
          ))}
        </div>
      )}

      {/* ── BLOC 4 — Bouton mise à jour ───────────────────────── */}
      <button
        type="button"
        onClick={openModal}
        style={{
          width: "100%", padding: "10px 16px", borderRadius: 10,
          border: "1px solid rgba(201,162,78,0.22)", background: "rgba(201,162,78,0.03)",
          color: "rgba(201,162,78,0.75)", fontSize: 11, letterSpacing: "0.12em",
          textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(201,162,78,0.5)"; e.currentTarget.style.background = "rgba(201,162,78,0.07)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(201,162,78,0.22)"; e.currentTarget.style.background = "rgba(201,162,78,0.03)"; }}
      >
        Update My Account
      </button>

      {/* ── MODAL ────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(7,6,11,0.90)", backdropFilter: "blur(14px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ width: "100%", maxWidth: 480, borderRadius: 16, border: "1px solid rgba(201,162,78,0.18)", background: "rgba(10,8,18,0.97)", padding: "24px 28px", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,162,78,0.6)", fontFamily: "monospace", marginBottom: 4 }}>Mise à jour compte</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#F5F0E8" }}>{firmLabel} · {phaseStr}</div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>

            {/* Form grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Solde compte ($)"      value={form.account_balance ?? "0"} onChange={(v) => setForm((f) => ({ ...f, account_balance: v }))} />
              <Field label="DD journalier ($)"     value={form.daily_dd ?? "0"} onChange={(v) => setForm((f) => ({ ...f, daily_dd: v }))} />
              <Field label="DD total ($)"          value={form.total_dd ?? "0"} onChange={(v) => setForm((f) => ({ ...f, total_dd: v }))} />
              <Field label="P&L du jour ($)"       value={form.daily_profit ?? "0"} onChange={(v) => setForm((f) => ({ ...f, daily_profit: v }))} />
              <Field label="Profit total mois ($)" value={form.total_profit ?? "0"} onChange={(v) => setForm((f) => ({ ...f, total_profit: v }))} />
              <Field label="Meilleur jour ($)"     value={form.best_day_profit ?? "0"} onChange={(v) => setForm((f) => ({ ...f, best_day_profit: v }))} />
              <Field label="Trades aujourd'hui"    value={form.trade_count_today ?? "0"} onChange={(v) => setForm((f) => ({ ...f, trade_count_today: v }))} prefix="#" />
              <Field label="Trades ce mois"        value={form.trade_count_month ?? "0"} onChange={(v) => setForm((f) => ({ ...f, trade_count_month: v }))} prefix="#" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Jours tradés ce mois" value={form.trading_days ?? "0"} onChange={(v) => setForm((f) => ({ ...f, trading_days: v }))} prefix="#" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{ width: "100%", marginTop: 20, padding: "12px", borderRadius: 10, border: "1px solid rgba(201,162,78,0.5)", background: "rgba(201,162,78,0.06)", color: "#C9A84C", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.08em", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
