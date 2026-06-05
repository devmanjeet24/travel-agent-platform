import { useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'

import { BudgetChart } from '@/components/ui/BudgetChart'
import { TripPlanPending } from '@/components/trip/TripPlanPending'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useTripPlan } from '@/providers/trip-plan-provider'
import {
  useTripBudgetQuery,
  useTripFlightsQuery,
  useTripHotelsQuery,
  useTripItineraryQuery,
} from '@/hooks/trips/use-trip-query'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { resolveBudgetChartCategories } from '@/utils/derive-trip-budget'

export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const { data: categories, isLoading: budgetLoading } = useTripBudgetQuery(id)
  const { data: itinerary, isLoading: itineraryLoading } = useTripItineraryQuery(id)
  const { data: hotels, isLoading: hotelsLoading } = useTripHotelsQuery(id)
  const { data: flights, isLoading: flightsLoading } = useTripFlightsQuery(id)
  const { trip, needsPlan, isPlanning, queriesLoading, planError, retryPlan } = useTripPlan()

  const chartCategories = useMemo(
    () =>
      resolveBudgetChartCategories({
        rows: categories,
        trip,
        itinerary,
        hotels,
        flights,
      }),
    [categories, trip, itinerary, hotels, flights],
  )

  const total = chartCategories.reduce((s, c) => s + c.amount, 0)
  const dataLoading =
    budgetLoading || itineraryLoading || hotelsLoading || flightsLoading || queriesLoading

  if (dataLoading || (needsPlan && isPlanning)) {
    return <TripPlanPending />
  }

  if (needsPlan && planError) {
    return <TripPlanPending error={planError} onRetry={retryPlan} />
  }

  if (!chartCategories.length) {
    return <TripPlanPending onRetry={retryPlan} />
  }

  return (
    <TripScreenWrapper className={theme.bg}>
      <BudgetChart categories={chartCategories} total={total} />
    </TripScreenWrapper>
  )
}
