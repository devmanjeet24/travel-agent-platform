import { useQuery } from '@tanstack/react-query';

import { tripKeys } from '@/services/trips/trip-keys';
import { fetchTrips } from '@/services/trips/trip-api';

export function useTripsQuery() {
  return useQuery({
    queryKey: tripKeys.list(),
    queryFn: fetchTrips,
  });
}
