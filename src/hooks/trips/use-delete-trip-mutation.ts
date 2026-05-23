import { useMutation, useQueryClient } from '@tanstack/react-query';

import { profileKeys } from '@/hooks/profile/use-profile-query';
import { journeyStatsKeys } from '@/hooks/profile/use-journey-stats';
import { syncProfileStats } from '@/services/profile/profile-api';
import { tripKeys } from '@/services/trips/trip-keys';
import { deleteTrip } from '@/services/trips/trip-api';
import type { TripRow } from '@/types/database';
import { useAuth } from '@/providers/auth-provider';

export function useDeleteTripMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onMutate: async (tripId) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.list() });
      const previous = queryClient.getQueryData<TripRow[]>(tripKeys.list());
      if (previous) {
        queryClient.setQueryData(
          tripKeys.list(),
          previous.filter((t) => t.id !== tripId),
        );
      }
      return { previous };
    },
    onError: (_err, _tripId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tripKeys.list(), context.previous);
      }
    },
    onSuccess: async (_data, tripId) => {
      queryClient.removeQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.removeQueries({ queryKey: tripKeys.itinerary(tripId) });
      queryClient.removeQueries({ queryKey: tripKeys.budget(tripId) });
      queryClient.removeQueries({ queryKey: tripKeys.hotels(tripId) });
      queryClient.removeQueries({ queryKey: tripKeys.flights(tripId) });
      queryClient.removeQueries({ queryKey: tripKeys.packing(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.all });
      void queryClient.invalidateQueries({
        queryKey: journeyStatsKeys.itineraryTripIds,
      });
      if (user?.id) {
        try {
          await syncProfileStats(user.id);
        } catch (e) {
          console.warn('Profile stats sync after delete failed:', e);
        }
        void queryClient.invalidateQueries({
          queryKey: profileKeys.detail(user.id),
        });
      }
    },
  });
}
