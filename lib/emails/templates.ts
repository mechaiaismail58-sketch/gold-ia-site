export const morningBriefTemplate = (email: string, briefingText: string, date: string) => ({
  from: 'Bullion Desk <noreply@bulliondesk.pro>',
  to: email,
  subject: `XAUUSD Morning Brief — ${date}`,
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:60px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:6px;">
              <span style="color:#ffffff;font-size:17px;font-weight:300;letter-spacing:0.22em;text-transform:uppercase;">
                Bullion <span style="color:#D4AF37;">Desk</span>
              </span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="color:#6b7280;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;">Morning Brief · ${date}</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

              <!-- Purple top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:1px;background:linear-gradient(to right,transparent,rgba(139,92,246,0.55),transparent);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px;">

                <!-- Badge -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <span style="display:inline-block;border:1px solid rgba(212,175,55,0.35);background:rgba(212,175,55,0.07);border-radius:999px;padding:5px 16px;">
                      <span style="color:#D4AF37;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;">XAUUSD · Daily Brief</span>
                    </span>
                  </td>
                </tr>

                <!-- Briefing text -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="color:#f5f0e8;font-size:14px;line-height:1.9;margin:0;white-space:pre-wrap;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${briefingText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center">
                    <a href="https://bulliondesk.pro" style="display:inline-block;border:1px solid rgba(212,175,55,0.6);background:rgba(212,175,55,0.1);color:#D4AF37;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;padding:11px 28px;border-radius:10px;">
                      Open Bullion Desk
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <span style="color:#374151;font-size:11px;letter-spacing:0.05em;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bullion Desk © 2026 · bulliondesk.pro · Not investment advice</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
})

export const betaLaunchTemplate = (email: string) => ({
  from: 'Bullion Desk <noreply@bulliondesk.pro>',
  to: email,
  subject: 'Bullion Desk Beta is live — your spot is waiting',
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#07060b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07060b;padding:60px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:6px;">
              <span style="color:#ffffff;font-size:17px;font-weight:300;letter-spacing:0.22em;text-transform:uppercase;">
                Bullion <span style="color:#D4AF37;">Desk</span>
              </span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <span style="color:#6b7280;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;">Institutional Gold Intelligence</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">

              <!-- Purple top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:1px;background:linear-gradient(to right,transparent,rgba(139,92,246,0.55),transparent);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px;">

                <!-- Badge -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <span style="display:inline-block;border:1px solid rgba(212,175,55,0.35);background:rgba(212,175,55,0.07);border-radius:999px;padding:5px 16px;">
                      <span style="color:#D4AF37;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;">Beta Access Open</span>
                    </span>
                  </td>
                </tr>

                <!-- Headline -->
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <span style="color:#f5f0e8;font-size:26px;font-weight:300;letter-spacing:-0.01em;line-height:1.2;">Beta access is now open.</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:36px;">
                    <span style="color:#9ca3af;font-size:15px;line-height:1.7;">You're one of the first to know. Bullion Desk beta is live.<br>Less than 100 spots available. One-time access — $10.</span>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center" style="padding-bottom:40px;">
                    <a href="https://bulliondesk.pro/upgrade" style="display:inline-block;border:1px solid rgba(212,175,55,0.6);background:rgba(212,175,55,0.1);color:#D4AF37;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;padding:13px 36px;border-radius:10px;">
                      Access Beta — $10
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Features -->
                <tr>
                  <td style="padding-bottom:4px;">
                    <p style="color:#6b7280;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 14px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">What's included</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                          <span style="color:#D4AF37;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Deep Analysis</span>
                          <span style="color:#6b7280;font-size:13px;display:block;margin-top:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Full institutional breakdown of XAUUSD</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                          <span style="color:#D4AF37;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Quick Brief</span>
                          <span style="color:#6b7280;font-size:13px;display:block;margin-top:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Concise signal in seconds</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                          <span style="color:#D4AF37;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Trade Only</span>
                          <span style="color:#6b7280;font-size:13px;display:block;margin-top:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Sniper entry, SL, TP, R/R</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:7px 0;">
                          <span style="color:#D4AF37;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Real-time Data</span>
                          <span style="color:#6b7280;font-size:13px;display:block;margin-top:2px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Live macro, COT and order flow</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:28px 0 24px 0;">
                    <div style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>

                <!-- Closing -->
                <tr>
                  <td>
                    <p style="color:#6b7280;font-size:13px;line-height:1.8;margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                      Once the 100 spots are filled, access closes.<br>
                      — The Bullion Desk Team
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:32px;">
              <span style="color:#374151;font-size:11px;letter-spacing:0.05em;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Bullion Desk © 2026 · bulliondesk.pro</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
})
