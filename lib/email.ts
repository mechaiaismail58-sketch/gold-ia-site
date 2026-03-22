import { Resend } from "resend";

// Lazy-initialize to avoid throwing at module load when key is missing
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// From address — use verified Resend domain until bulliondesk.pro is connected
const FROM = process.env.RESEND_FROM ?? "noreply@bulliondesk.pro";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gold-ia-site.vercel.app";

// ── Shared dark HTML wrapper ──────────────────────────────────────────────────

function htmlWrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bullion Desk</title>
</head>
<body style="margin:0;padding:0;background:#07060b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding:0 0 32px 0;">
        <a href="${SITE_URL}" style="text-decoration:none;">
          <span style="font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:#fff;">Bullion <span style="color:#D4AF37;">Desk</span></span>
        </a>
        <span style="display:block;margin-top:4px;font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:0.14em;text-transform:uppercase;">Institutional Gold Intelligence</span>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:rgba(10,8,18,0.8);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:36px 40px;">
        ${body}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:24px 0 0 0;">
        <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;text-align:center;">
          © ${new Date().getFullYear()} Bullion Desk · Not investment advice. Trade at your own risk.
        </p>
        <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:6px 0 0 0;text-align:center;">
          <a href="${SITE_URL}/profile" style="color:rgba(255,255,255,0.25);text-decoration:none;">Manage notification preferences</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── 1. Welcome email ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string) {
  const resend = getResend();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Welcome to Bullion Desk",
      html: htmlWrap(`
        <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;margin:0 0 8px 0;">Welcome to Bullion Desk</h1>
        <p style="font-size:13px;color:rgba(255,255,255,0.55);margin:0 0 28px 0;line-height:1.7;">Institutional-grade gold analysis, filtered through a disciplined framework.</p>

        <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.20);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
          <p style="font-size:12px;color:rgba(255,255,255,0.50);margin:0 0 12px 0;text-transform:uppercase;letter-spacing:0.12em;">What you have access to</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:rgba(255,255,255,0.75);line-height:2.0;">
            <li>Real-time XAUUSD macro-technical analysis</li>
            <li>3 analysis modes: Deep, Quick Brief, Trade Only</li>
            <li>Automated scalp &amp; swing signal alerts</li>
            <li>Economic calendar with impact scoring</li>
            <li>Institutional positioning (COT, ETF flows, CB reserves)</li>
          </ul>
        </div>

        <a href="${SITE_URL}" style="display:inline-block;background:rgba(109,40,217,0.14);border:1px solid rgba(109,40,217,0.55);color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;padding:12px 28px;border-radius:12px;">Open Bullion Desk</a>

        <p style="font-size:12px;color:rgba(255,255,255,0.30);margin:28px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;line-height:1.8;">
          To get the most out of the platform: select your trading horizon in your profile, enable push alerts, and attach a chart screenshot for more precise analysis.
        </p>
      `),
    });
  } catch (err) {
    console.error("[email] sendWelcomeEmail error:", err);
  }
}

// ── 2. Trade alert email ──────────────────────────────────────────────────────

type TradeAlertPayload = {
  email: string;
  direction: "LONG" | "SHORT";
  mode: "scalp" | "swing";
  entry: string;
  tp1: string;
  tp2: string;
  invalidation: string | null;
  score?: string | null;
};

export async function sendTradeAlertEmail(payload: TradeAlertPayload) {
  const resend = getResend();
  if (!resend) return;
  const { email, direction, mode, entry, tp1, tp2, invalidation, score } = payload;
  const dirColor = direction === "LONG" ? "#4ade80" : "#f87171";
  const modeLabel = mode === "scalp" ? "Scalp Signal" : "Swing Signal";
  const scoreText = score ? ` · Confluence ${score}` : "";

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Bullion Desk — ${direction} XAUUSD ${modeLabel}`,
      html: htmlWrap(`
        <div style="margin-bottom:20px;">
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:rgba(255,255,255,0.35);">${modeLabel}</span>
          <h1 style="font-size:26px;font-weight:700;margin:4px 0 0 0;letter-spacing:-0.02em;">
            <span style="color:${dirColor};">${direction}</span> <span style="color:rgba(255,255,255,0.85);">XAUUSD</span>
          </h1>
          ${scoreText ? `<p style="font-size:12px;color:rgba(255,255,255,0.35);margin:4px 0 0 0;">${scoreText}</p>` : ""}
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          ${[
            ["Entry", entry],
            ["TP1", tp1],
            ["TP2", tp2],
            ["Stop Loss", invalidation ?? "—"],
          ].map(([label, value]) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);width:40%;">${label}</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;font-weight:600;color:#fff;font-family:monospace;">${value}</td>
          </tr>`).join("")}
        </table>

        <a href="${SITE_URL}" style="display:inline-block;background:rgba(212,175,55,0.10);border:1px solid rgba(212,175,55,0.35);color:#D4AF37;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;padding:12px 28px;border-radius:12px;">View Full Analysis</a>

        <p style="font-size:11px;color:rgba(255,255,255,0.20);margin:20px 0 0 0;">This signal was generated automatically. Always validate with current market structure before executing.</p>
      `),
    });
  } catch (err) {
    console.error("[email] sendTradeAlertEmail error:", err);
  }
}

// ── 3. Pre-market brief email (7h00 UTC) ─────────────────────────────────────

type PreMarketPayload = {
  email: string;
  brief: string;        // AI-generated brief text
  goldPrice?: number | null;
  bias?: string;
};

export async function sendPreMarketEmail(payload: PreMarketPayload) {
  const resend = getResend();
  if (!resend) return;
  const { email, brief, goldPrice, bias } = payload;
  const now = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Bullion Desk — Pre-Market Gold Brief · ${now}`,
      html: htmlWrap(`
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:rgba(255,255,255,0.30);margin:0 0 6px 0;">Pre-Market Brief · ${now} UTC</p>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 24px 0;letter-spacing:-0.02em;">
          XAUUSD Market Outlook
          ${goldPrice ? `<span style="font-size:16px;color:rgba(255,255,255,0.45);font-weight:400;margin-left:12px;">$${goldPrice.toFixed(2)}</span>` : ""}
          ${bias ? `<span style="display:block;font-size:12px;color:rgba(212,175,55,0.8);margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;">${bias}</span>` : ""}
        </h1>

        <div style="font-size:13px;color:rgba(255,255,255,0.72);line-height:1.85;white-space:pre-wrap;">${brief.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
          <a href="${SITE_URL}" style="display:inline-block;background:rgba(109,40,217,0.14);border:1px solid rgba(109,40,217,0.55);color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;padding:12px 28px;border-radius:12px;">Open Full Analysis</a>
        </div>
      `),
    });
  } catch (err) {
    console.error("[email] sendPreMarketEmail error:", err);
  }
}

// ── 4. Invalidation alert email ──────────────────────────────────────────────

type InvalidationPayload = {
  email: string;
  currentPrice: number;
  invalidationLevel: number;
  direction: "LONG" | "SHORT";
  distancePct: number;
};

export async function sendInvalidationAlertEmail(payload: InvalidationPayload) {
  const resend = getResend();
  if (!resend) return;
  const { email, currentPrice, invalidationLevel, direction, distancePct } = payload;

  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `⚠️ Bullion Desk — ${direction} invalidation zone approaching`,
      html: htmlWrap(`
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:20px 24px;margin-bottom:24px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:rgba(239,68,68,0.7);margin:0 0 8px 0;">Invalidation Alert</p>
          <h1 style="font-size:22px;font-weight:700;margin:0;color:#fff;">Price approaching ${direction} invalidation</h1>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);width:50%;">Current Price</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;font-weight:600;color:#fff;font-family:monospace;">$${currentPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);">Invalidation Level</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;font-weight:600;color:#f87171;font-family:monospace;">$${invalidationLevel.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);">Distance</td>
            <td style="padding:10px 0;font-size:14px;font-weight:600;color:#fbbf24;font-family:monospace;">${distancePct.toFixed(2)}%</td>
          </tr>
        </table>

        <a href="${SITE_URL}" style="display:inline-block;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.35);color:#f87171;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;padding:12px 28px;border-radius:12px;">Review Position</a>
      `),
    });
  } catch (err) {
    console.error("[email] sendInvalidationAlertEmail error:", err);
  }
}
