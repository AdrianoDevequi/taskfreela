import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Ensure keys exist in environment
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:suporte@taskfreela.com.br',
        publicVapidKey,
        privateVapidKey
    );
}

export const pushService = {
    /**
     * Sends a push notification to all devices registered for a specific user
     */
    async sendToUser(userId: string, payload: { title: string; body: string; url?: string }) {
        if (!publicVapidKey || !privateVapidKey) {
            console.warn('[Push] VAPID keys missing, skipping push notification.');
            return { success: false, message: 'Keys missing' };
        }

        try {
            const subscriptions = await (prisma as any).pushSubscription.findMany({
                where: { userId },
            });

            if (subscriptions.length === 0) {
                return { success: true, message: 'No devices registered for push' };
            }

            const stringifiedPayload = JSON.stringify({
                title: payload.title,
                body: payload.body,
                url: payload.url || 'https://www.taskfreela.com.br/dashboard',
            });

            const sendPromises = subscriptions.map(async (sub: any) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                try {
                    await webpush.sendNotification(pushSubscription, stringifiedPayload);
                } catch (error: any) {
                    // If the subscription is no longer valid (e.g. user revoked permission), delete it
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        await (prisma as any).pushSubscription.delete({
                            where: { id: sub.id },
                        });
                    } else {
                        console.error('[Push] Failed to send notification to device:', error);
                    }
                }
            });

            await Promise.all(sendPromises);

            return { success: true, count: subscriptions.length };
        } catch (error) {
            console.error('[Push] Overall push service error:', error);
            return { success: false, error: String(error) };
        }
    }
};
