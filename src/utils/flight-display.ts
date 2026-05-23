export type TripFlightRaw = {
  originAirport?: string
  destAirport?: string
  originAirportCode?: string
  destAirportCode?: string
  distanceKm?: number
  durationMinutes?: number
  note?: string
}

export function parseFlightRaw(raw: unknown): TripFlightRaw | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as TripFlightRaw
}

export function flightDurationLabel(raw: unknown): string | null {
  const r = parseFlightRaw(raw)
  if (!r?.durationMinutes || r.durationMinutes <= 0) return null
  const h = Math.floor(r.durationMinutes / 60)
  const m = r.durationMinutes % 60
  if (h <= 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function flightNote(raw: unknown): string | null {
  const r = parseFlightRaw(raw)
  return r?.note?.trim() || null
}
