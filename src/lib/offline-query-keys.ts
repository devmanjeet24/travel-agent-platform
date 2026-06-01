import { profileKeys } from '@/hooks/profile/use-profile-query';
import { notificationKeys } from '@/hooks/notifications/use-notifications-query';
import { tripKeys } from '@/services/trips/trip-keys';
import { authKeys } from '@/services/auth/auth-keys';

/** React Query keys persisted for offline read access. */
const OFFLINE_PREFIXES: readonly (readonly string[])[] = [
  tripKeys.all,
  profileKeys.detail('').slice(0, 1),
  notificationKeys.all,
  authKeys.all,
];

export function isOfflinePersistedQueryKey(queryKey: readonly unknown[]): boolean {
  if (!queryKey.length) return false;
  const head = String(queryKey[0]);
  return OFFLINE_PREFIXES.some((prefix) => head === String(prefix[0]));
}
