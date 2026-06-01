import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';

import { useProfileQuery } from '@/hooks/profile/use-profile-query';
import {
  applyOfflineSyncPreference,
  subscribeToNetworkResync,
} from '@/lib/offline-sync';
import { isOfflineSyncEnabled, setOfflineSyncEnabled } from '@/lib/offline-sync-state';
import { useAuth } from '@/providers/auth-provider';

/**
 * Applies offline_sync_enabled from profile and refetches trips/chat data when back online.
 */
export function useOfflineSync() {
  const { user } = useAuth();
  const { data: profile } = useProfileQuery();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile === undefined) return;
    const enabled = profile?.offline_sync_enabled ?? true;
    void applyOfflineSyncPreference(enabled, user?.id);
  }, [profile?.offline_sync_enabled, profile, user?.id]);

  useEffect(() => {
    if (!user?.id || !isOfflineSyncEnabled()) return;

    return subscribeToNetworkResync(user.id, () => {
      void queryClient.refetchQueries({ type: 'active' });
    });
  }, [user?.id, queryClient, profile?.offline_sync_enabled]);
}

export function useIsOffline(): boolean {
  const { data: profile } = useProfileQuery();
  const netInfo = NetInfo.useNetInfo();
  const syncEnabled = profile?.offline_sync_enabled ?? true;
  if (!syncEnabled) return false;
  return netInfo.isConnected === false || netInfo.isInternetReachable === false;
}
