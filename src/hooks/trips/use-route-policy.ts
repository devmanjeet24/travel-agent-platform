import { useQuery } from '@tanstack/react-query'

import { fetchRoutePolicy } from '@/services/travel/travel-api'
import type { TripRow } from '@/types/database'

export function routePolicyKey(trip: TripRow | null | undefined) {
  return [
    'routePolicy',
    trip?.id,
    trip?.origin_city,
    trip?.destination,
    trip?.start_date,
    trip?.end_date,
    trip?.budget_usd,
    trip?.travelers,
  ] as const
}

/** Route-aware transport policy (ground vs flight) from travel-search edge function. */
export function useRoutePolicy(trip: TripRow | null | undefined) {
  return useQuery({
    queryKey: routePolicyKey(trip),
    enabled: Boolean(trip?.origin_city && trip?.destination),
    queryFn: async () => {
      if (!trip?.origin_city || !trip.destination) return null
      return fetchRoutePolicy({
        origin: trip.origin_city,
        destination: trip.destination,
        startDate: trip.start_date ?? undefined,
        endDate: trip.end_date ?? undefined,
        budgetInr: trip.budget_usd ? Number(trip.budget_usd) : undefined,
        travelers: trip.travelers,
      })
    },
    staleTime: 1000 * 60 * 30,
  })
}
