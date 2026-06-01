import {
  cancelAllTripPushNotifications,
  registerForPushNotifications,
} from '@/lib/notifications-setup';
import { removeAllDevicePushTokens, upsertDevicePushToken } from '@/services/push/push-token-api';

export async function enablePushNotificationsForUser(userId: string): Promise<void> {
  const token = await registerForPushNotifications();
  if (token) {
    await upsertDevicePushToken(userId, token);
  }
}

export async function disablePushNotificationsForUser(userId: string): Promise<void> {
  await removeAllDevicePushTokens(userId);
  await cancelAllTripPushNotifications();
}
