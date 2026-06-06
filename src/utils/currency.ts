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

function parseBudgetAmountToken(raw: string): number | undefined {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Parse budget from natural language (INR-first; legacy USD converted at ~83). */
export function parseBudgetFromText(
  text: string,
  opts?: { travelers?: number },
): number | undefined {
  const travelers =
    opts?.travelers != null && opts.travelers > 0
      ? Math.round(opts.travelers)
      : undefined

  const eachBudgetMatch = text.match(
    /\b(?:each|per\s+(?:person|traveler|traveller|friend|guest))\s+(?:having\s+)?(?:a\s+)?budget\s+of\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  )
  if (eachBudgetMatch) {
    const perPerson = parseBudgetAmountToken(eachBudgetMatch[1])
    if (perPerson != null) {
      return travelers && travelers > 1 ? perPerson * travelers : perPerson
    }
  }

  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lac)\b/i)
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100_000)

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i)
  if (kMatch) return Math.round(Number(kMatch[1]) * 1_000)

  const inrMatch = text.match(
    /(?:₹|rs\.?\s*|inr\s*)(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  )
  if (inrMatch) {
    const amount = parseBudgetAmountToken(inrMatch[1])
    if (
      amount != null &&
      /\b(?:each|per\s+(?:person|traveler|friend))\b/i.test(text) &&
      travelers &&
      travelers > 1
    ) {
      return amount * travelers
    }
    if (amount != null) return amount
  }

  const plainMatch = text.match(
    /(?:budget|under|around|max|total)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\s*(?:inr|rupees?|rs\.?|budget)?/i,
  )
  if (plainMatch) {
    const amount = parseBudgetAmountToken(plainMatch[1])
    if (
      amount != null &&
      /\b(?:each|per\s+(?:person|traveler|friend))\b/i.test(text) &&
      travelers &&
      travelers > 1
    ) {
      return amount * travelers
    }
    if (amount != null) return amount
  }

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
