import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationKeys } from '@/hooks/notifications/use-notifications-query';
import { profileKeys } from '@/hooks/profile/use-profile-query';
import { journeyStatsKeys } from '@/hooks/profile/use-journey-stats';
import { planTrip } from '@/services/travel/travel-api';
import { tripKeys } from '@/services/trips/trip-keys';
import { useAuth } from '@/providers/auth-provider';
export function usePlanTripMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (tripId: string) => planTrip(tripId),
    onSuccess: (_data, tripId) => {
      void queryClient.invalidateQueries({ queryKey: tripKeys.all });
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.itinerary(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.budget(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.hotels(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.flights(tripId) });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: journeyStatsKeys.itineraryTripIds });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) });
      }
    },
  });
}
