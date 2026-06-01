import { createContext, useContext, type ReactNode } from 'react'

import { useEnsureTripPlan } from '@/hooks/trips/use-ensure-trip-plan'

type TripPlanContextValue = ReturnType<typeof useEnsureTripPlan>

const TripPlanContext = createContext<TripPlanContextValue | null>(null)

export function TripPlanProvider({
  tripId,
  children,
}: {
  tripId: string | undefined
  children: ReactNode
}) {
  const value = useEnsureTripPlan(tripId)
  return <TripPlanContext.Provider value={value}>{children}</TripPlanContext.Provider>
}

export function useTripPlan() {
  const ctx = useContext(TripPlanContext)
  if (!ctx) {
    throw new Error('useTripPlan must be used within TripPlanProvider')
  }
  return ctx
}
