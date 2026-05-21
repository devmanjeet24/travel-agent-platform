import { useMutation, useQueryClient } from '@tanstack/react-query';

import { tripKeys } from '@/services/trips/trip-keys';
import { createTrip, type CreateTripInput } from '@/services/trips/trip-api';

export function useCreateTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}
