import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { profileKeys } from '@/hooks/profile/use-profile-query';
import { useAuth } from '@/providers/auth-provider';
import { useTripsQuery } from '@/hooks/trips/use-trips-query';
import { syncProfileStats } from '@/services/profile/profile-api';

/**
 * Keeps `profiles` counters aligned with real trips/itinerary data (e.g. after legacy trips).
 */
export function useSyncProfileStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: trips } = useTripsQuery();
  const lastSyncKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || trips === undefined) return;

    const syncKey = `${user.id}:${trips.length}:${trips.map((t) => t.updated_at).join(',')}`;
    if (lastSyncKey.current === syncKey) return;
    lastSyncKey.current = syncKey;

    void syncProfileStats(user.id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) });
      })
      .catch((e) => {
        console.warn('Profile stats sync failed:', e);
      });
  }, [user?.id, trips, queryClient]);
}
