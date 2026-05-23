/** App currency: amounts in DB columns named *_usd are stored as INR. */

export const CURRENCY_CODE = 'INR' as const
export const CURRENCY_SYMBOL = '₹'

/** Per-person per-day below this → low budget tier (aligned with edge transport-guidance). */
export const LOW_BUDGET_PER_DAY_INR = 2_500
export const LOW_BUDGET_TOTAL_INR = 20_000
export const MEDIUM_BUDGET_PER_DAY_INR = 5_000
export const MEDIUM_BUDGET_TOTAL_INR = 50_000

export function formatInr(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return '—'
  return `${CURRENCY_SYMBOL}${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatInrPerNight(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  return `${formatInr(amount)}/night`
}

/** Parse budget from natural language (INR-first; legacy USD converted at ~83). */
export function parseBudgetFromText(text: string): number | undefined {
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lac)\b/i)
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100_000)

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i)
  if (kMatch) return Math.round(Number(kMatch[1]) * 1_000)

  const inrMatch = text.match(
    /(?:₹|rs\.?\s*|inr\s*)(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  )
  if (inrMatch) return Number(inrMatch[1].replace(/,/g, ''))

  const plainMatch = text.match(
    /(?:budget|under|around|max|total)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\s*(?:inr|rupees?|rs\.?|budget)?/i,
  )
  if (plainMatch) return Number(plainMatch[1].replace(/,/g, ''))

  const usdMatch = text.match(/\$\s*(\d{3,6})\s*(?:usd|dollars?)?/i)
  if (usdMatch) return Math.round(Number(usdMatch[1]) * 83)

  return undefined
}

export function isLowTripBudget(
  budgetInr: number | null | undefined,
  travelers = 1,
  tripDays = 7,
): boolean {
  if (!budgetInr || budgetInr <= 0) return false
  const pax = Math.max(1, travelers)
  const days = Math.max(1, tripDays)
  const perDay = budgetInr / pax / days
  return perDay < LOW_BUDGET_PER_DAY_INR || budgetInr < LOW_BUDGET_TOTAL_INR
}
