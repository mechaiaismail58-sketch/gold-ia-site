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
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:60px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <span style="color:#D4AF37;font-size:18px;font-weight:300;letter-spacing:0.35em;text-transform:uppercase;">BULLION DESK</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="color:#4b5563;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;">INSTITUTIONAL GOLD INTELLIGENCE</span>
            </td>
          </tr>

          <!-- Divider or -->
          <tr>
            <td style="padding-bottom:40px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,#D4AF37,transparent);"></div>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <span style="color:#f5f0e8;font-size:28px;font-weight:300;letter-spacing:0.02em;">Beta access is now open.</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <span style="color:#9ca3af;font-size:15px;line-height:1.7;">You're one of the first to know. Bullion Desk beta is live.<br>Less than 100 spots available. One-time access — $10.</span>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding-bottom:48px;">
              <a href="https://bulliondesk.pro/upgrade" style="display:inline-block;background:#D4AF37;color:#0a0a0a;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;padding:14px 36px;">
                ACCESS BETA — $10
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding-bottom:32px;">
              <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Features -->
          <tr>
            <td style="padding-bottom:8px;">
              <p style="color:#6b7280;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 16px 0;">WHAT'S INCLUDED</p>
              <p style="color:#9ca3af;font-size:14px;line-height:2.2;margin:0;">
                · Deep Analysis — full institutional breakdown of XAUUSD<br>
                · Quick Brief — concise signal in seconds<br>
                · Trade Only — sniper entry, SL, TP, R/R<br>
                · Real-time macro, COT and order flow data
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:32px 0;">
              <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding-bottom:40px;">
              <p style="color:#6b7280;font-size:13px;line-height:1.8;margin:0;">
                Once the 100 spots are filled, access closes.<br>
                — The Bullion Desk Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center">
              <span style="color:#374151;font-size:11px;letter-spacing:0.05em;">Bullion Desk © 2026 · bulliondesk.pro</span>
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
