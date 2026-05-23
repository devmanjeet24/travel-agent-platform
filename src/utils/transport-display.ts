import type { LucideIcon } from 'lucide-react-native'
import {
  Bus,
  Train,
  Plane,
  Ship,
  Car,
  Footprints,
  Navigation,
  CircleDot,
} from 'lucide-react-native'

import {
  isLowTripBudget,
  LOW_BUDGET_PER_DAY_INR,
  LOW_BUDGET_TOTAL_INR,
} from '@/utils/currency'
import type { ItineraryActivityRow, ItineraryDayRow } from '@/types/database'

type ItineraryDayWithActivities = ItineraryDayRow & { activities: ItineraryActivityRow[] }

export type TransportKind =
  | 'bus'
  | 'train'
  | 'metro'
  | 'ferry'
  | 'flight'
  | 'car'
  | 'taxi'
  | 'walk'
  | 'other'

export type TransportDisplay = {
  kind: TransportKind
  label: string
  detail: string
  icon: LucideIcon
  budgetFriendly: boolean
}

export type ItineraryTransportOption = TransportDisplay & {
  activityName: string
}

const MODE_PATTERNS: { kind: TransportKind; re: RegExp }[] = [
  { kind: 'bus', re: /\b(bus|coach|shuttle)\b/i },
  { kind: 'metro', re: /\b(metro|subway|tube|mrt|bts|tram|light rail)\b/i },
  { kind: 'train', re: /\b(train|rail|railway|express)\b/i },
  { kind: 'ferry', re: /\b(ferry|boat|catamaran|speedboat)\b/i },
  { kind: 'flight', re: /\b(flight|fly|flying|airline|plane|airport)\b/i },
  { kind: 'taxi', re: /\b(taxi|cab|uber|ola|auto|rickshaw|tuk)\b/i },
  { kind: 'car', re: /\b(car|drive|rental|self-drive|private transfer)\b/i },
  { kind: 'walk', re: /\b(walk|walking|on foot|foot)\b/i },
]

const KIND_LABEL: Record<TransportKind, string> = {
  bus: 'Bus',
  train: 'Train',
  metro: 'Metro',
  ferry: 'Ferry',
  flight: 'Flight',
  car: 'Car',
  taxi: 'Taxi',
  walk: 'Walk',
  other: 'Transport',
}

const KIND_ICON: Record<TransportKind, LucideIcon> = {
  bus: Bus,
  train: Train,
  metro: Navigation,
  ferry: Ship,
  flight: Plane,
  car: Car,
  taxi: Car,
  walk: Footprints,
  other: CircleDot,
}

const BUDGET_FRIENDLY: TransportKind[] = ['bus', 'train', 'metro', 'ferry', 'walk']

function detectKind(text: string): TransportKind {
  const first = text.split(/[·•|–—-]/)[0]?.trim() ?? text
  for (const { kind, re } of MODE_PATTERNS) {
    if (re.test(first)) return kind
  }
  for (const { kind, re } of MODE_PATTERNS) {
    if (re.test(text)) return kind
  }
  return 'other'
}

export function parseTransport(raw: string | null | undefined): TransportDisplay {
  const text = (raw ?? '').trim()
  if (!text) {
    return {
      kind: 'other',
      label: 'Transport',
      detail: '—',
      icon: CircleDot,
      budgetFriendly: false,
    }
  }

  const segments = text.split(/[·•|–—-]/).map((s) => s.trim()).filter(Boolean)
  const [first, ...rest] = segments
  const kind = detectKind(first ?? text)
  const label = KIND_LABEL[kind]
  const detail = rest.length ? rest.join(' · ') : text

  return {
    kind,
    label,
    detail: detail !== label ? detail : text,
    icon: KIND_ICON[kind],
    budgetFriendly: BUDGET_FRIENDLY.includes(kind),
  }
}

/** Unique transport options from itinerary activities (ground + flight). */
export function collectItineraryTransportOptions(
  days: ItineraryDayWithActivities[] | undefined,
): ItineraryTransportOption[] {
  if (!days?.length) return []

  const seen = new Set<string>()
  const result: ItineraryTransportOption[] = []

  for (const day of days) {
    for (const activity of day.activities) {
      const raw = activity.transport?.trim()
      if (!raw) continue

      const parsed = parseTransport(raw)
      if (parsed.kind === 'other' && parsed.detail === raw) {
        // Keep unrecognized text — still useful for display
      }

      const key = `${parsed.kind}:${parsed.detail}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ ...parsed, activityName: activity.name })
    }
  }

  return result
}

export { isLowTripBudget, LOW_BUDGET_PER_DAY_INR, LOW_BUDGET_TOTAL_INR }

export function tripDaysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 7
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 7
  return Math.max(1, Math.ceil((b - a) / 86400000))
}
