import { useMutation, useQueryClient } from '@tanstack/react-query';

import { profileKeys } from '@/hooks/profile/use-profile-query';
import { journeyStatsKeys } from '@/hooks/profile/use-journey-stats';
import { tripKeys } from '@/services/trips/trip-keys';
import { createTrip, type CreateTripInput } from '@/services/trips/trip-api';
import { useAuth } from '@/providers/auth-provider';

export function useCreateTripMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripKeys.all });
      void queryClient.invalidateQueries({ queryKey: journeyStatsKeys.itineraryTripIds });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: profileKeys.detail(user.id) });
      }
    },
  });
}
