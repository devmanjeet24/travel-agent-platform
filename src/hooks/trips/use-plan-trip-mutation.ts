import { useMutation, useQueryClient } from '@tanstack/react-query';

import { planTrip } from '@/services/travel/travel-api';
import { tripKeys } from '@/services/trips/trip-keys';

export function usePlanTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => planTrip(tripId),
    onSuccess: (_data, tripId) => {
      void queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.itinerary(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.budget(tripId) });
      void queryClient.invalidateQueries({ queryKey: tripKeys.packing(tripId) });
    },
  });
}
