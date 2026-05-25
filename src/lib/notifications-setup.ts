import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TRIP_REMINDER_CHANNEL_ID = 'trip-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

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

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  return (await Notifications.getExpoPushTokenAsync()).data;
}

export async function scheduleTripReminder(params: {
  title: string;
  body: string;
  triggerDate: Date;
}): Promise<string | null> {
  if (params.triggerDate.getTime() <= Date.now()) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.triggerDate,
      channelId: TRIP_REMINDER_CHANNEL_ID,
    },
  });
  return id;
}
