import webpush from "web-push";

// Lazy init — only configure VAPID when actually sending a push.
// Prevents build crash when VAPID env vars are absent (e.g. local dev, CI).
let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn("[push] VAPID env vars missing — push notifications disabled");
    return;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  try {
    ensureVapid();
    if (!vapidConfigured) return false;
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    // 410 = subscription expired/invalid
    if (err?.statusCode === 410 || err?.statusCode === 404) return false;
    console.error("Push send error:", err?.statusCode, err?.message);
    return false;
  }
}

export { webpush };
