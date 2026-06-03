import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resend } from "@/lib/resend";

export const runtime = "nodejs";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const FROM = "Bullion Desk <noreply@bulliondesk.pro>";
const NOTIFY_TO = "partners@bulliondesk.pro";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, platform, handle, follower_count, content_link, motivation } = body ?? {};

    if (!name || !email || !platform || !handle || !motivation) {
      return NextResponse.json({ error: "All required fields must be filled." }, { status: 400 });
    }

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Database not configured." }, { status: 500 });
    }

    const { error: dbError } = await db.from("partner_applications").insert({
      name:           String(name).trim(),
      email:          String(email).trim().toLowerCase(),
      platform:       String(platform).trim(),
      handle:         String(handle).trim(),
      follower_count: follower_count ? String(follower_count).trim() : null,
      content_link:   content_link ? String(content_link).trim() : null,
      motivation:     String(motivation).trim(),
      status:         "pending",
    });

    if (dbError) {
      console.error("[partners/apply] db insert error:", dbError.message);
      return NextResponse.json({ error: "Failed to save application. Please try again." }, { status: 500 });
    }

    // Send emails if Resend is configured
    if (resend) {
      // Confirmation to applicant
      await resend.emails.send({
        from: FROM,
        to:   String(email).trim(),
        subject: "Bullion Desk — Partner Program Application Received",
        html: `
          <div style="background:#07060b;color:#f5f0e8;font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:40px 32px;">
            <p style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#D4AF37;margin:0 0 24px;">Bullion Desk · Partner Program</p>
            <h1 style="font-size:24px;font-weight:400;letter-spacing:-0.02em;margin:0 0 20px;line-height:1.2;">Application received.</h1>
            <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 16px;">
              Thank you for applying to the Bullion Desk Partner Program, ${String(name).trim()}.
            </p>
            <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 32px;">
              We review applications weekly and will get back to you shortly. We evaluate audience quality, content alignment, and overall fit — so only a select number of partners are accepted.
            </p>
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;">
              <p style="font-size:12px;color:rgba(255,255,255,0.25);margin:0;">Bullion Desk · Institutional Gold Intelligence</p>
            </div>
          </div>
        `,
      }).catch((e) => console.error("[partners/apply] confirmation email error:", e));

      // Notification to partners@bulliondesk.pro
      await resend.emails.send({
        from: FROM,
        to:   NOTIFY_TO,
        subject: `New Partner Application — ${String(name).trim()} (${String(platform).trim()})`,
        html: `
          <div style="font-family:monospace;font-size:13px;line-height:1.7;">
            <p><strong>Name:</strong> ${escapeHtml(String(name).trim())}</p>
            <p><strong>Email:</strong> ${escapeHtml(String(email).trim())}</p>
            <p><strong>Platform:</strong> ${escapeHtml(String(platform).trim())}</p>
            <p><strong>Handle:</strong> ${escapeHtml(String(handle).trim())}</p>
            <p><strong>Followers:</strong> ${follower_count ? escapeHtml(String(follower_count)) : "—"}</p>
            <p><strong>Content link:</strong> ${content_link ? escapeHtml(String(content_link)) : "—"}</p>
            <p><strong>Motivation:</strong><br>${escapeHtml(String(motivation).trim()).replace(/\n/g, "<br>")}</p>
          </div>
        `,
      }).catch((e) => console.error("[partners/apply] notification email error:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[partners/apply] handler error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
