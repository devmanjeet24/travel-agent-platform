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
    /(?:to|in|visit|trip to|going to|(?:planned\s+)?to\s+go)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  ) ?? text.match(
    /\bgo(?:ing)?\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\.|,|$)/i,
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

  const isoDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1])
  if (isoDates[0]) ctx.startDate = isoDates[0]
  if (isoDates[1]) ctx.endDate = isoDates[1]

  const monthRangeMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\.?\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:,?\s*(20\d{2}))?\b/i,
  )
  if (monthRangeMatch) {
    const months: Record<string, number> = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    }
    const month = months[monthRangeMatch[1].toLowerCase()]
    const year = monthRangeMatch[4]
      ? Number(monthRangeMatch[4])
      : new Date().getFullYear()
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (month) {
      ctx.startDate = `${year}-${pad(month)}-${pad(Number(monthRangeMatch[2]))}`
      ctx.endDate = `${year}-${pad(month)}-${pad(Number(monthRangeMatch[3]))}`
    }
  }

  return ctx
}
