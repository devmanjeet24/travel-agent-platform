import { parseBudgetFromText } from '@/utils/currency'

export type ParsedTripContext = {
  destination?: string
  origin?: string
  startDate?: string
  endDate?: string
  /** Trip length in days when the user stated duration instead of an end date. */
  tripDurationDays?: number
  /** Budget in INR (stored in trips.budget_usd). */
  budgetInr?: number
  travelers?: number
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const MONTH_NAME_PATTERN =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'

/** "from 15 July 2026 to 22 July 2026" → ISO start/end. */
export function parseTripDateRangeFromText(text: string): {
  startDate?: string
  endDate?: string
} {
  const match = text.match(
    new RegExp(
      `\\b(?:from\\s+)?(\\d{1,2})\\s+(${MONTH_NAME_PATTERN})\\.?\\s+(20\\d{2})\\s+to\\s+(\\d{1,2})\\s+(${MONTH_NAME_PATTERN})\\.?(?:\\s+(20\\d{2}))?\\b`,
      'i',
    ),
  )
  if (!match) return {}

  const startMonth = MONTHS[match[2].toLowerCase().replace(/\./g, '')]
  const endMonth = MONTHS[match[5].toLowerCase().replace(/\./g, '')]
  const startDay = Number(match[1])
  const endDay = Number(match[4])
  const startYear = Number(match[3])
  const endYear = match[6] ? Number(match[6]) : startYear
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  if (!startMonth || !endMonth) return {}
  return {
    startDate: `${startYear}-${pad(startMonth)}-${pad(startDay)}`,
    endDate: `${endYear}-${pad(endMonth)}-${pad(endDay)}`,
  }
}

function inferTripYear(month: number, day: number, explicitYear?: number): number {
  if (explicitYear) return explicitYear
  const now = new Date()
  let year = now.getUTCFullYear()
  const candidate = Date.UTC(year, month - 1, day)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (candidate < today) year += 1
  return year
}

function sanitizeDestination(destination: string): string {
  return destination
    .replace(/^(?:go\s+to|going\s+to|to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const DESTINATION_COUNTRY_WORDS =
  /\b(?:Australia|India|Japan|USA|U\.?S\.?A|UK|U\.?K|Thailand|Singapore|Dubai|France|Italy|Spain|Germany|Canada|Nepal|Sri Lanka|New Zealand|Indonesia|Vietnam|China|Korea|Malaysia|Philippines|UAE|Switzerland|Netherlands|Greece|Turkey|Egypt|Brazil|Mexico|Argentina|South Africa|Portugal|Ireland|Scotland|England|Wales|Hong Kong|Taiwan|Cambodia|Maldives|Bhutan|Bangladesh|Pakistan|Qatar|Saudi Arabia|Oman|Israel|Morocco|Kenya|Tanzania|Iceland|Norway|Sweden|Denmark|Finland|Belgium|Austria|Czech Republic|Hungary|Poland|Croatia|Romania|Russia|Peru|Colombia|Chile|Cuba|Jamaica|Bahamas|Fiji|Bali|Hawaii|Europe|Asia)\b/i

function parseTravelersFromText(text: string): number | undefined {
  const numeric = text.match(
    /(\d+)\s*(?:people|travelers|travellers|guests|pax|friends?|adults?)\b/i,
  )
  if (numeric) return Number(numeric[1])
  if (/\bme\s+and\s+my\s+friends?\b/i.test(text)) return 2
  if (/\bmy\s+friend\s+and\s+(?:i|me)\b/i.test(text)) return 2
  if (/\b(?:the\s+)?two\s+of\s+us\b/i.test(text)) return 2
  if (/\b(?:just\s+)?me\s+and\s+(?:a\s+)?friend\b/i.test(text)) return 2
  const weAre = text.match(/\bwe\s+are\s+(\d+)\b/i)
  if (weAre) return Number(weAre[1])
  return undefined
}

const WORD_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function parseTripDurationDaysFromText(text: string): number | undefined {
  const numeric = text.match(/\b(?:for\s+)?(\d{1,3})\s+days?\b/i)
  if (numeric) return Math.max(1, Number(numeric[1]))
  const word = text.match(
    /\b(?:for\s+)?(one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/i,
  )
  if (word) return WORD_NUMBER[word[1].toLowerCase()]
  return undefined
}

function parseDestinationFromText(text: string): string | undefined {
  const destPatterns = [
    /\bplanning\s+for\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+for\b|\s+from\b|,|\s+\d|\s+with\b|\s+trip\b|\.|$)/i,
    /\bplanning\s+a\s+trip\s+to\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|\s+we\b|\.|$)/i,
    /\b(?:are\s+)?planned\s+to\s+go(?:\s+to)?\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:,|\s+for\b|\s+with\b|\s+from\b|\s+and\b|\.|$)/i,
    /\bplan(?:ning)?\s+to\s+go(?:\s+to)?\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\s+from\b|\s+and\b|\.|$)/i,
    /\bgo\s+to\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:,|\s+for\b|\s+with\b|\s+from\b|\s+and\b|\.|$)/i,
    /\b(?:going\s+to|travel\s+to|visit)\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\.|$)/i,
    /\btrip\s+to\s+([A-Za-z][A-Za-z\s,]{2,50}?)(?:\s+with\b|\s+for\b|,|\s+we\b|\.|$)/i,
    /(?:^|[,.]\s*)(?:to|in)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  ]
  for (const pattern of destPatterns) {
    const match = text.match(pattern)
    if (!match) continue
    const candidate = sanitizeDestination(match[1].trim())
    const weak =
      candidate.length < 3 ||
      /^(this|that|there|here)(\s+trip)?$/i.test(candidate) ||
      candidate.toLowerCase() === 'this trip'
    if (!weak) return candidate
  }
  return undefined
}

/** Short replies like "Melbourne Australia" → destination, not origin. */
function parseStandaloneDestination(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed.length < 3 || trimmed.length > 56 || /\d/.test(trimmed)) return undefined
  if (/^(yes|no|ok|okay|sure|thanks|thank you|hi|hello|hey|please|ask)\b/i.test(trimmed)) {
    return undefined
  }
  if (DESTINATION_COUNTRY_WORDS.test(trimmed)) {
    return sanitizeDestination(trimmed.replace(/[?.!]+$/, ''))
  }
  const twoWord = trimmed.match(/^([A-Za-z][A-Za-z\s-]{1,30})\s+([A-Za-z][A-Za-z\s-]{2,24})$/)
  if (twoWord && twoWord[2].length >= 4) {
    return sanitizeDestination(`${twoWord[1]} ${twoWord[2]}`.replace(/[?.!]+$/, ''))
  }
  return undefined
}

export function mergeTripContextFromMessages(
  messages: Array<{ role: string; content: string }>,
): ParsedTripContext {
  let merged: ParsedTripContext = {}
  for (const item of messages) {
    if (item.role !== 'user') continue
    merged = { ...merged, ...parseTripContextFromMessage(item.content) }
  }
  return merged
}

function parseLabeledTripFields(text: string): ParsedTripContext {
  const ctx: ParsedTripContext = {}

  const destLabel = text.match(/\bdestination\s*[-–:]\s*([^,.\n]+)/i)
  if (destLabel) {
    const candidate = sanitizeDestination(destLabel[1].trim())
    const weak =
      candidate.length < 3 ||
      /^(this|that|there|here)(\s+trip)?$/i.test(candidate) ||
      candidate.toLowerCase() === 'this trip'
    if (!weak) ctx.destination = candidate
  }

  const originLabel = text.match(/\borigin\s*(?:city\s*)?(?:is|-–:)\s*([^,.\n]+)/i)
  if (originLabel) {
    const origin = originLabel[1].trim().replace(/\s+/g, ' ')
    if (origin.length >= 2) ctx.origin = origin
  }

  const originIsPhrase = text.match(
    /\b([A-Za-z][A-Za-z\s]{2,40}?)\s+is\s+the\s+origin\s+city\b/i,
  )
  if (originIsPhrase) {
    const origin = originIsPhrase[1].trim().replace(/\s+/g, ' ')
    if (origin.length >= 2) ctx.origin = origin
  }

  const datesLabel = text.match(
    /\bdates?\s*[-–:]\s*(?:from\s+)?(\d{1,2})(?:\s*(?:to|-|–)\s*(\d{1,2}))?\s*(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(\s+(20\d{2}))?/i,
  )
  if (datesLabel) {
    const month = MONTHS[datesLabel[3].toLowerCase().replace(/\./g, '')]
    const startDay = Number(datesLabel[1])
    const year = datesLabel[4]
      ? Number(datesLabel[4].trim())
      : inferTripYear(month, startDay)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (month) {
      ctx.startDate = `${year}-${pad(month)}-${pad(startDay)}`
      if (datesLabel[2]) {
        ctx.endDate = `${datesLabel[4] ? Number(datesLabel[4].trim()) : year}-${pad(month)}-${pad(Number(datesLabel[2]))}`
      }
    }
  }

  const budgetExplicit = text.match(/\b(?:we\s+have\s+)?(\d{1,3}(?:,\d{2,3})+|\d{5,7})\s*(?:of\s+)?budget\b/i)
  if (budgetExplicit) {
    ctx.budgetInr = Number(budgetExplicit[1].replace(/,/g, ''))
  }

  return ctx
}

/** Best-effort extraction from a natural-language chat message. */
export function parseTripContextFromMessage(text: string): ParsedTripContext {
  const labeled = parseLabeledTripFields(text)
  const ctx: ParsedTripContext = { ...labeled }
  const dateRange = parseTripDateRangeFromText(text)
  if (dateRange.startDate) ctx.startDate = dateRange.startDate
  if (dateRange.endDate) ctx.endDate = dateRange.endDate

  const destination = parseDestinationFromText(text)
  if (destination) ctx.destination = destination

  const travelers = parseTravelersFromText(text)
  if (travelers != null) ctx.travelers = travelers

  const budgetInr = parseBudgetFromText(text, { travelers: ctx.travelers })
  if (budgetInr != null) ctx.budgetInr = budgetInr

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  )
  if (originMatch) ctx.origin = originMatch[1].trim()

  const trimmed = text.trim()
  if (!ctx.destination && trimmed.length >= 3 && trimmed.length < 56) {
    const standaloneDest = parseStandaloneDestination(trimmed)
    if (standaloneDest) ctx.destination = standaloneDest
  }
  if (
    !ctx.origin &&
    !ctx.destination &&
    trimmed.length > 2 &&
    trimmed.length < 56
  ) {
    const transportOnly = /^(flight|flights|train|trains|bus|buses|road|car)$/i.test(trimmed)
    const bareCity = trimmed.match(/^([A-Za-z][A-Za-z\s]{2,40}?)(?:\s+India)?$/i)
    if (!transportOnly && bareCity && !/\d{4,}/.test(trimmed)) {
      ctx.origin = bareCity[1].trim()
    }
  }

  const isoDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1])
  if (isoDates[0]) ctx.startDate = isoDates[0]
  if (isoDates[1]) ctx.endDate = isoDates[1]

  const monthPat =
    'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'

  const dayMonthYearRangeMatch = !ctx.startDate
    ? text.match(
        new RegExp(
          `\\b(?:from\\s+)?(\\d{1,2})\\s+(${monthPat})\\.?\\s+(20\\d{2})\\s+to\\s+(\\d{1,2})\\s+(${monthPat})\\.?(?:\\s+(20\\d{2}))?\\b`,
          'i',
        ),
      )
    : null
  if (dayMonthYearRangeMatch) {
    const startMonth = MONTHS[dayMonthYearRangeMatch[2].toLowerCase().replace(/\./g, '')]
    const endMonth = MONTHS[dayMonthYearRangeMatch[5].toLowerCase().replace(/\./g, '')]
    const startDay = Number(dayMonthYearRangeMatch[1])
    const endDay = Number(dayMonthYearRangeMatch[4])
    const startYear = Number(dayMonthYearRangeMatch[3])
    const endYear = dayMonthYearRangeMatch[6]
      ? Number(dayMonthYearRangeMatch[6])
      : startYear
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (startMonth) {
      ctx.startDate = `${startYear}-${pad(startMonth)}-${pad(startDay)}`
      ctx.endDate = `${endYear}-${pad(endMonth)}-${pad(endDay)}`
    }
  }

  const dayMonthRangeMatch = !ctx.startDate
    ? text.match(
        new RegExp(
          `\\b(?:from\\s+)?(\\d{1,2})\\s+(${monthPat})\\.?\\s+to\\s+(\\d{1,2})\\s+(${monthPat})\\.?(?:,?\\s*(20\\d{2}))?\\b`,
          'i',
        ),
      ) ??
        text.match(
          new RegExp(
            `\\b(\\d{1,2})\\s+of\\s+(${monthPat})\\.?\\s+to\\s+(\\d{1,2})\\s+of\\s+(${monthPat})\\.?(?:,?\\s*(20\\d{2}))?\\b`,
            'i',
          ),
        )
    : null
  if (dayMonthRangeMatch) {
    const startMonth = MONTHS[dayMonthRangeMatch[2].toLowerCase().replace(/\./g, '')]
    const endMonth = MONTHS[dayMonthRangeMatch[4].toLowerCase().replace(/\./g, '')]
    const startDay = Number(dayMonthRangeMatch[1])
    const endDay = Number(dayMonthRangeMatch[3])
    const year = dayMonthRangeMatch[5]
      ? Number(dayMonthRangeMatch[5])
      : inferTripYear(startMonth, startDay)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (startMonth) {
      ctx.startDate = `${year}-${pad(startMonth)}-${pad(startDay)}`
      ctx.endDate = `${dayMonthRangeMatch[5] ? Number(dayMonthRangeMatch[5]) : year}-${pad(endMonth)}-${pad(endDay)}`
    }
  }

  const dayOfMonthRangeMatch = !ctx.startDate
    ? text.match(
        new RegExp(
          `\\b(\\d{1,2})\\s+of\\s+(${monthPat})\\.?\\s+to\\s+(\\d{1,2})\\s+of\\s+(${monthPat})\\.?(?:,?\\s*(20\\d{2}))?\\b`,
          'i',
        ),
      )
    : null
  if (dayOfMonthRangeMatch) {
    const startMonth = MONTHS[dayOfMonthRangeMatch[2].toLowerCase().replace(/\./g, '')]
    const endMonth = MONTHS[dayOfMonthRangeMatch[4].toLowerCase().replace(/\./g, '')]
    const startDay = Number(dayOfMonthRangeMatch[1])
    const endDay = Number(dayOfMonthRangeMatch[3])
    const year = inferTripYear(
      startMonth,
      startDay,
      dayOfMonthRangeMatch[5] ? Number(dayOfMonthRangeMatch[5]) : undefined,
    )
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (startMonth) {
      ctx.startDate = `${year}-${pad(startMonth)}-${pad(startDay)}`
      ctx.endDate = `${dayOfMonthRangeMatch[5] ? Number(dayOfMonthRangeMatch[5]) : year}-${pad(endMonth)}-${pad(endDay)}`
    }
  }

  const monthRangeMatch = !ctx.startDate
    ? text.match(
        /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})(?:,?\s*(20\d{2}))?\b/i,
      )
    : null
  if (monthRangeMatch) {
    const month = MONTHS[monthRangeMatch[1].toLowerCase().replace(/\./g, '')]
    const startDay = Number(monthRangeMatch[2])
    const year = monthRangeMatch[4]
      ? Number(monthRangeMatch[4])
      : inferTripYear(month, startDay)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    if (month) {
      ctx.startDate = `${year}-${pad(month)}-${pad(startDay)}`
      ctx.endDate = `${year}-${pad(month)}-${pad(Number(monthRangeMatch[3]))}`
    }
  }

  const monthOnlyMatch = text.match(
    /\b(?:in|during|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?(\s+(20\d{2}))?\b/i,
  )
  if (monthOnlyMatch && !ctx.startDate) {
    const month = MONTHS[monthOnlyMatch[1].toLowerCase().replace(/\./g, '')]
    if (month) {
      const year = monthOnlyMatch[2]
        ? Number(monthOnlyMatch[2].trim())
        : inferTripYear(month, 1)
      const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
      ctx.startDate = `${year}-${pad(month)}-01`
    }
  }

  const durationDays = parseTripDurationDaysFromText(text)
  if (durationDays != null) ctx.tripDurationDays = durationDays
  if (ctx.tripDurationDays && ctx.startDate && !ctx.endDate) {
    const start = new Date(`${ctx.startDate}T00:00:00Z`)
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(
        start.getTime() + Math.max(1, ctx.tripDurationDays - 1) * 86_400_000,
      )
      ctx.endDate = end.toISOString().slice(0, 10)
    }
  }

  return { ...labeled, ...ctx }
}
