import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@travel/scheduled_notification_ids';

type StoredSchedules = Record<string, string[]>;

async function readAll(): Promise<StoredSchedules> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredSchedules;
  } catch {
    return {};
  }
}

async function writeAll(data: StoredSchedules): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function addTripScheduledNotificationIds(
  tripId: string,
  notificationIds: string[],
): Promise<void> {
  if (!notificationIds.length) return;
  const all = await readAll();
  const existing = all[tripId] ?? [];
  all[tripId] = [...new Set([...existing, ...notificationIds])];
  await writeAll(all);
}

export async function getAllScheduledNotificationIds(): Promise<string[]> {
  const all = await readAll();
  return [...new Set(Object.values(all).flat())];
}

export async function clearTripScheduledNotificationIds(tripId: string): Promise<void> {
  const all = await readAll();
  delete all[tripId];
  await writeAll(all);
}

export async function clearAllScheduledNotificationIds(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
