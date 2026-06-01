import { useEffect, useRef } from 'react'

import { usePlanTripMutation } from '@/hooks/trips/use-plan-trip-mutation'
import {
  useTripBudgetQuery,
  useTripItineraryQuery,
  useTripPackingQuery,
  useTripQuery,
} from '@/hooks/trips/use-trip-query'
import { tripNeedsPlan } from '@/utils/trip-plan-status'

/** Auto-runs plan-trip when saved trip context exists but itinerary/budget/packing are missing. */
export function useEnsureTripPlan(tripId: string | undefined) {
  const { data: trip, isLoading: tripLoading } = useTripQuery(tripId)
  const { data: itinerary, isLoading: itineraryLoading } = useTripItineraryQuery(tripId)
  const { data: budget, isLoading: budgetLoading } = useTripBudgetQuery(tripId)
  const { data: packing, isLoading: packingLoading } = useTripPackingQuery(tripId)
  const planTrip = usePlanTripMutation()
  const attemptedForTrip = useRef<string | null>(null)

  const queriesLoading =
    tripLoading || itineraryLoading || budgetLoading || packingLoading
  const needsPlan = Boolean(trip && !queriesLoading && tripNeedsPlan(trip, itinerary, budget, packing))
  const isPlanning = planTrip.isPending

  useEffect(() => {
    if (!tripId || !trip || queriesLoading || !needsPlan || isPlanning) return
    if (attemptedForTrip.current === tripId) return

    attemptedForTrip.current = tripId
    planTrip.mutate(tripId, {
      onError: () => {
        attemptedForTrip.current = null
      },
    })
  }, [tripId, trip, queriesLoading, needsPlan, isPlanning, planTrip])

  useEffect(() => {
    if (tripId && attemptedForTrip.current && attemptedForTrip.current !== tripId) {
      attemptedForTrip.current = null
    }
  }, [tripId])

  const retryPlan = () => {
    if (!tripId) return
    attemptedForTrip.current = null
    planTrip.mutate(tripId)
  }

  return {
    trip,
    needsPlan,
    isPlanning,
    queriesLoading,
    planError: planTrip.error,
    retryPlan,
  }
}
