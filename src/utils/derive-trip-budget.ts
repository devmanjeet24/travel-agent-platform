import type {
  BudgetCategoryRow,
  ItineraryActivityRow,
  ItineraryDayRow,
  TripFlightRow,
  TripHotelRow,
  TripRow,
} from '@/types/database'
import { resolveActivityCostInr } from '@/utils/activity-cost'

export type BudgetChartCategory = { label: string; amount: number; color: string }

const DEFAULT_COLORS: Record<string, string> = {
  Flights: '#EAB308',
  Hotels: '#000000',
  Food: '#16A34A',
  Activities: '#FACC15',
  Transport: '#CA8A04',
  Misc: '#737373',
}

type ItineraryDay = ItineraryDayRow & { activities: ItineraryActivityRow[] }

function nightsBetween(start: string | null, end: string | null): number {
  if (!start) return 1
  const s = new Date(start)
  const e = end ? new Date(end) : s
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff || 1)
}

function activityBucket(name: string, transport?: string | null): keyof typeof DEFAULT_COLORS {
  const text = `${name} ${transport ?? ''}`.toLowerCase()
  if (/\b(flight|airport|fly|airline)\b/.test(text)) return 'Flights'
  if (/\b(hotel|check-?in|check-?out|stay|resort|hostel|lodge)\b/.test(text)) return 'Hotels'
  if (/\b(train|bus|metro|taxi|cab|ferry|transfer|transport|ride)\b/.test(text)) return 'Transport'
  if (/\b(breakfast|brunch|lunch|dinner|meal|restaurant|cafe|food|dining)\b/.test(text)) return 'Food'
  if (/\b(museum|temple|trek|tour|sightseeing|activity|entry|beach|park)\b/.test(text)) {
    return 'Activities'
  }
  return 'Activities'
}

/** Build budget chart rows from saved itinerary, hotels, and flights when DB categories are empty. */
export function deriveBudgetCategoriesFromTripData(params: {
  trip: TripRow
  itinerary?: ItineraryDay[]
  hotels?: TripHotelRow[]
  flights?: TripFlightRow[]
}): BudgetChartCategory[] {
  const totals = new Map<string, number>()
  const add = (label: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    totals.set(label, (totals.get(label) ?? 0) + Math.round(amount))
  }

  const travelers = Math.max(1, params.trip.travelers ?? 1)
  const nights = nightsBetween(params.trip.start_date, params.trip.end_date)

  for (const day of params.itinerary ?? []) {
    for (const activity of day.activities) {
      const amount = resolveActivityCostInr({
        cost: activity.cost_usd,
        name: activity.name,
        transport: activity.transport,
        travelers,
      })
      add(activityBucket(activity.name, activity.transport), amount)
    }
  }

  for (const hotel of params.hotels ?? []) {
    const perNight = Number(hotel.price_per_night_usd ?? 0)
    if (perNight > 0) add('Hotels', perNight * nights)
  }

  for (const flight of params.flights ?? []) {
    const price = Number(flight.price_usd ?? 0)
    if (price > 0) add('Flights', price * travelers)
  }

  const tripBudget = params.trip.budget_usd ? Number(params.trip.budget_usd) : 0
  const summed = [...totals.values()].reduce((s, n) => s + n, 0)

  if (summed === 0 && tripBudget > 0) {
    const splits: Array<[string, number]> = [
      ['Flights', 0.35],
      ['Hotels', 0.3],
      ['Food', 0.15],
      ['Activities', 0.12],
      ['Transport', 0.05],
      ['Misc', 0.03],
    ]
    let allocated = 0
    for (let i = 0; i < splits.length; i++) {
      const [label, ratio] = splits[i]
      const amount =
        i === splits.length - 1
          ? Math.round(tripBudget - allocated)
          : Math.round(tripBudget * ratio)
      allocated += amount
      totals.set(label, amount)
    }
  } else if (tripBudget > 0 && summed > 0 && summed < tripBudget * 0.85) {
    add('Misc', Math.round(tripBudget - summed))
  }

  const order = ['Flights', 'Hotels', 'Food', 'Activities', 'Transport', 'Misc']
  const rows: BudgetChartCategory[] = order
    .filter((label) => (totals.get(label) ?? 0) > 0)
    .map((label) => ({
      label,
      amount: totals.get(label)!,
      color: DEFAULT_COLORS[label] ?? '#737373',
    }))

  const extras = [...totals.keys()].filter((k) => !order.includes(k))
  for (const label of extras) {
    rows.push({
      label,
      amount: totals.get(label)!,
      color: DEFAULT_COLORS[label] ?? '#737373',
    })
  }

  return rows
}

export function budgetRowsToChartCategories(
  rows: BudgetCategoryRow[],
): BudgetChartCategory[] {
  return rows.map((c) => ({
    label: c.label,
    amount: Number(c.amount_usd),
    color: c.color ?? DEFAULT_COLORS[c.label] ?? '#737373',
  }))
}
