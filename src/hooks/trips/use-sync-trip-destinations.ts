import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { syncTripDestination } from '@/services/travel/travel-api'
import { tripKeys } from '@/services/trips/trip-keys'
import type { TripRow } from '@/types/database'
import { needsTripDestinationSync } from '@/utils/trip-display'

export function useSyncTripDestinations(trips: TripRow[] | undefined) {
  const queryClient = useQueryClient()
  const destinationSyncAttempted = useRef(new Set<string>())

  useEffect(() => {
    if (!trips?.length) return

    let cancelled = false
    const candidates = trips
      .filter((trip) => needsTripDestinationSync(trip))
      .filter((trip) => !destinationSyncAttempted.current.has(trip.id))
      .slice(0, 5)

    if (!candidates.length) return

    for (const trip of candidates) {
      destinationSyncAttempted.current.add(trip.id)
      void syncTripDestination({ tripId: trip.id, destination: trip.destination })
        .then(() => {
          if (!cancelled) {
            void queryClient.invalidateQueries({ queryKey: tripKeys.all })
          }
        })
        .catch((error) => {
          console.warn('[useSyncTripDestinations] destination image sync failed', {
            tripId: trip.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })
    }

    return () => {
      cancelled = true
    }
  }, [queryClient, trips])
}
