import webpush from 'web-push';
import prisma from '@/lib/prisma';

// Configured on first use to allow tests to inject environment variables
let isConfigured = false;

function ensureVapidConfig() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@business-action.com';

  if (!isConfigured && publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
  }
  return isConfigured;
}

export type PushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Sends a push notification to all stored subscriptions.
 * Safe to call: will not throw errors to the caller, and will remove expired subscriptions.
 */
export async function sendPushNotificationSafe(payload: PushNotificationPayload): Promise<boolean> {
  if (!ensureVapidConfig()) {
    console.warn('Web push VAPID keys are not configured. Push notification skipped.');
    return false;
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) return true;

    const pushPayload = JSON.stringify(payload);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            pushPayload
          );
        } catch (error: unknown) {
          const err = error as { statusCode?: number };
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription has expired or is no longer valid
            console.log('Subscription expired, removing:', sub.endpoint);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.error('Error sending push notification:', error);
          }
        }
      })
    );
    return true;
  } catch (err) {
    console.error('Failed to process push notifications:', err);
    return false;
  }
}
