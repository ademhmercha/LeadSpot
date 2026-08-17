import webpush from "web-push";

/**
 * Notifications push (Web Push) — 100 % gratuit, sans service tiers : le
 * navigateur abonné reçoit la notification directement via le service worker.
 * Les clés VAPID (publique + privée) sont générées localement avec
 * `npx web-push generate-vapid-keys`.
 */

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

function getWebPush(): typeof webpush {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return webpush;
}

/**
 * Envoie une notification à un abonnement. Retourne `expired: true` quand le
 * fournisseur répond 404/410 (abonnement révoqué) — l'appelant peut alors
 * supprimer la ligne en base.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
): Promise<{ ok: boolean; expired: boolean }> {
  if (!isPushConfigured()) return { ok: false, expired: false };

  try {
    await getWebPush().sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, expired: false };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return { ok: false, expired: true };
    return { ok: false, expired: false };
  }
}
