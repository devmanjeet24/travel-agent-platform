import { parseBudgetFromText } from '@/utils/currency'

export type ParsedTripContext = {
  destination?: string
  origin?: string
  startDate?: string
  endDate?: string
  /** Budget in INR (stored in trips.budget_usd). */
  budgetInr?: number
  travelers?: number
}

/** Best-effort extraction from a natural-language chat message. */
export function parseTripContextFromMessage(text: string): ParsedTripContext {
  const ctx: ParsedTripContext = {}

  const destMatch = text.match(
    /(?:to|in|visit|trip to|going to)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  )
  if (destMatch) {
    const destination = destMatch[1].trim()
    const weak =
      destination.length < 3 ||
      /^(this|that|there|here)(\s+trip)?$/i.test(destination) ||
      destination.toLowerCase() === 'this trip'
    if (!weak) ctx.destination = destination
  }

  const budgetInr = parseBudgetFromText(text)
  if (budgetInr != null) ctx.budgetInr = budgetInr

  const travelersMatch = text.match(
    /(\d+)\s*(?:people|travelers|travellers|guests|pax|friends?)/i,
  )
  if (travelersMatch) ctx.travelers = Number(travelersMatch[1])

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  )
  if (originMatch) ctx.origin = originMatch[1].trim()

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (isoDate) ctx.startDate = isoDate[1]

  return ctx
}
