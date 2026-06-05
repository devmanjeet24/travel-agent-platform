/**
 * Run: npx tsx scripts/verify-trip-date-parse.ts
 * Verifies "from 15 July 2026 to 22 July 2026" → ISO dates through client parsers.
 */
import { parseTripDateRangeFromText, parseTripContextFromMessage } from '../src/utils/trip-context-parse'
import { buildTripContextForChat } from '../src/utils/build-trip-context'
import { assessTripRequirementsFromContext } from '../src/utils/trip-requirements'

const SAMPLE =
  'I am planning a trip to Tokyo, Japan with my friend. We are 2 travelers. Our total budget is ₹250,000. The trip will be for 8 days, from 15 July 2026 to 22 July 2026.'

const range = parseTripDateRangeFromText('from 15 July 2026 to 22 July 2026')
const parsed = parseTripContextFromMessage(SAMPLE)
const ctx = buildTripContextForChat({ message: SAMPLE, originCity: 'Delhi, India' })
const req = assessTripRequirementsFromContext(ctx ?? {})

const ok =
  range.startDate === '2026-07-15' &&
  range.endDate === '2026-07-22' &&
  parsed.startDate === '2026-07-15' &&
  parsed.endDate === '2026-07-22' &&
  ctx?.startDate === '2026-07-15' &&
  ctx?.endDate === '2026-07-22'

console.log('parseTripDateRangeFromText:', range)
console.log('parseTripContextFromMessage:', {
  startDate: parsed.startDate,
  endDate: parsed.endDate,
  tripDurationDays: parsed.tripDurationDays,
})
console.log('buildTripContextForChat:', {
  startDate: ctx?.startDate,
  endDate: ctx?.endDate,
})
console.log('assessTripRequirements:', req)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
