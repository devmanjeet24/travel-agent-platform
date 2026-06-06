import type { ParsedTripContext } from '@/utils/trip-context-parse'

function resolveTripDates(ctx: ParsedTripContext): {
  startDate?: string
  endDate?: string
} {
  const startDate = ctx.startDate?.trim()
  let endDate = ctx.endDate?.trim()
  if (startDate && !endDate && ctx.tripDurationDays != null && ctx.tripDurationDays >= 1) {
    const start = new Date(`${startDate}T00:00:00Z`)
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(
        start.getTime() + (Math.max(1, Math.round(ctx.tripDurationDays)) - 1) * 86_400_000,
      )
      endDate = end.toISOString().slice(0, 10)
    }
  }
  return { startDate, endDate }
}

export function assessTripRequirementsFromContext(ctx: ParsedTripContext): {
  complete: boolean
  missing: string[]
} {
  const dates = resolveTripDates(ctx)
  const missing: string[] = []
  if (!ctx.destination?.trim()) missing.push('destination')
  if (!ctx.origin?.trim()) missing.push('origin city')
  if (!dates.startDate) missing.push('start date')
  if (!dates.endDate) {
    missing.push(
      dates.startDate ? 'end date or trip duration' : 'travel dates or trip duration',
    )
  }
  if (ctx.budgetInr == null || !Number.isFinite(ctx.budgetInr) || ctx.budgetInr <= 0) {
    missing.push('INR budget')
  }
  if (ctx.travelers == null || !Number.isFinite(ctx.travelers) || ctx.travelers < 1) {
    missing.push('traveler count')
  }
  return { complete: missing.length === 0, missing }
}
