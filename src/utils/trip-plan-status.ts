import type { BudgetCategoryRow, ItineraryDayRow, ItineraryActivityRow, PackingItemRow, TripRow } from '@/types/database'

export type ItineraryWithActivities = ItineraryDayRow & { activities: ItineraryActivityRow[] }

/** True when core AI plan data is missing but the trip has enough context to plan. */
export function tripNeedsPlan(
  trip: TripRow | null | undefined,
  itinerary: ItineraryWithActivities[] | undefined,
  budget: BudgetCategoryRow[] | undefined,
  packing: PackingItemRow[] | undefined,
): boolean {
  if (!trip?.destination?.trim()) return false
  const hasItinerary = (itinerary?.length ?? 0) > 0
  const hasBudget = (budget?.length ?? 0) > 0
  const hasPacking = (packing?.length ?? 0) > 0
  return !hasItinerary || !hasBudget || !hasPacking
}

export function tripHasPlanData(
  itinerary: ItineraryWithActivities[] | undefined,
  budget: BudgetCategoryRow[] | undefined,
  packing: PackingItemRow[] | undefined,
): boolean {
  return (
    (itinerary?.length ?? 0) > 0 &&
    (budget?.length ?? 0) > 0 &&
    (packing?.length ?? 0) > 0
  )
}
