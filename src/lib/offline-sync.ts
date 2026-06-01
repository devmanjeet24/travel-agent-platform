import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { OFFLINE_CACHE_STORAGE_KEY } from '@/lib/query-persist';
import { clearChatOfflineCache } from '@/lib/chat-offline-cache';
import { setOfflineSyncEnabled } from '@/lib/offline-sync-state';
import { queryClient } from '@/lib/query-client';
import { notificationKeys } from '@/hooks/notifications/use-notifications-query';
import { profileKeys } from '@/hooks/profile/use-profile-query';
import { tripKeys } from '@/services/trips/trip-keys';

export async function applyOfflineSyncPreference(enabled: boolean, userId?: string): Promise<void> {
  setOfflineSyncEnabled(enabled);

  if (!enabled) {
    await clearOfflinePersistedCache();
    if (userId) {
      queryClient.removeQueries({ queryKey: profileKeys.detail(userId) });
    }
  }
}

export async function clearOfflinePersistedCache(): Promise<void> {
  await clearChatOfflineCache();
  await AsyncStorage.removeItem(OFFLINE_CACHE_STORAGE_KEY);
}

export function subscribeToNetworkResync(
  userId: string | undefined,
  onOnline?: () => void,
): () => void {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = Boolean(state.isConnected && state.isInternetReachable !== false);

    if (!online) {
      wasOffline = true;
      return;
    }

    if (!wasOffline) return;
    wasOffline = false;

    if (!userId) return;

    void queryClient.invalidateQueries({ queryKey: tripKeys.all });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) });
    }

    onOnline?.();
  });

  return unsubscribe;
}
