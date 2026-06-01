import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  clearAllScheduledNotificationIds,
  getAllScheduledNotificationIds,
} from '@/lib/scheduled-notifications-storage';

const TRIP_REMINDER_CHANNEL_ID = 'trip-reminders';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let notificationHandlerConfigured = false;

function isExpoGoRuntime() {
  return (
    Platform.OS === 'android' &&
    (Constants as { appOwnership?: string }).appOwnership === 'expo'
  );
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGoRuntime()) return null;
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((mod) => mod)
      .catch((error) => {
        console.warn('[notifications]', error instanceof Error ? error.message : error);
        return null;
      });
  }
  return notificationsModulePromise;
}

async function ensureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  await ensureNotificationHandler();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TRIP_REMINDER_CHANNEL_ID, {
      name: 'Trip reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted =
    existing.granted ||
    existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted =
      requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  return granted;
}

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const projectId = resolveExpoProjectId();
  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenResult.data;
}

export async function scheduleTripReminder(params: {
  title: string;
  body: string;
  triggerDate: Date;
}): Promise<string | null> {
  if (params.triggerDate.getTime() <= Date.now()) return null;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: { type: 'trip_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.triggerDate,
      channelId: TRIP_REMINDER_CHANNEL_ID,
    },
  });
  return id;
}

/** Cancel locally scheduled trip reminders and clear stored IDs. */
export async function cancelAllTripPushNotifications(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  const storedIds = await getAllScheduledNotificationIds();
  await Promise.all(
    storedIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
  await Notifications.cancelAllScheduledNotificationsAsync();
  await clearAllScheduledNotificationIds();
}
