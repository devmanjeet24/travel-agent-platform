import { parseIsoDateString } from '@/utils/date-format';
import {
  createTripNotifications,
  type CreateTripNotificationsParams,
} from '@/services/notifications/notification-api';
import { fetchProfile } from '@/services/profile/profile-api';
import {
  cancelAllTripPushNotifications,
  scheduleTripReminder,
} from '@/lib/notifications-setup';
import { sendRemotePushNotification } from '@/lib/push-notify-edge';
import { addTripScheduledNotificationIds } from '@/lib/scheduled-notifications-storage';

export async function isPushNotificationsEnabled(userId: string): Promise<boolean> {
  const profile = await fetchProfile(userId);
  return profile?.push_notifications_enabled ?? true;
}

/** In-app notification rows + local day-before reminder (remote push sent by plan-trip). */
export async function setupTripPushAndNotifications(
  params: CreateTripNotificationsParams,
): Promise<void> {
  const enabled = await isPushNotificationsEnabled(params.userId);
  if (!enabled) return;

  await createTripNotifications(params);

  if (!params.startDate) return;

  const remind = parseIsoDateString(params.startDate);
  if (!remind) return;

  remind.setDate(remind.getDate() - 1);
  const localId = await scheduleTripReminder({
    title: 'Trip tomorrow',
    body: `Your trip to ${params.destination} starts soon.`,
    triggerDate: remind,
  });

  if (localId) {
    await addTripScheduledNotificationIds(params.tripId, [localId]);
  }
}

export async function sendTripUpdatePush(params: {
  userId: string;
  tripId: string;
  title: string;
  body: string;
}): Promise<void> {
  const enabled = await isPushNotificationsEnabled(params.userId);
  if (!enabled) return;

  await sendRemotePushNotification({
    title: params.title,
    body: params.body,
    data: { tripId: params.tripId, type: 'trip_update' },
  });
}

export { cancelAllTripPushNotifications };
