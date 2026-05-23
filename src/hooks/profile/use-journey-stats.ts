import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTripsQuery } from '@/hooks/trips/use-trips-query';
import { fetchTripIdsWithItinerary } from '@/services/trips/trip-api';
import { computeJourneyStats } from '@/utils/journey-stats';

export const journeyStatsKeys = {
  itineraryTripIds: ['journey-stats', 'itinerary-trip-ids'] as const,
};

export function useJourneyStats() {
  const { data: trips, isLoading: tripsLoading } = useTripsQuery();
  const { data: itineraryTripIds, isLoading: itineraryLoading } = useQuery({
    queryKey: journeyStatsKeys.itineraryTripIds,
    queryFn: fetchTripIdsWithItinerary,
  });

  const stats = useMemo(
    () => computeJourneyStats(trips ?? [], itineraryTripIds ?? new Set()),
    [trips, itineraryTripIds],
  );

  return {
    stats,
    isLoading: tripsLoading || itineraryLoading,
  };
}
