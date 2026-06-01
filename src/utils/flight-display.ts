export type TripFlightRaw = {
  source?: string
  originAirport?: string
  destAirport?: string
  originAirportCode?: string
  destAirportCode?: string
  distanceKm?: number
  durationMinutes?: number
  priceAmount?: number | string | null
  priceCurrency?: string | null
  totalAmount?: number | string | null
  totalCurrency?: string | null
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

function parseMoneyAmount(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? amount : null
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`
  }
}

export function flightPriceLabel(raw: unknown, fallbackInr?: number | null): string {
  const r = parseFlightRaw(raw)
  const currency = (r?.priceCurrency ?? r?.totalCurrency)?.trim().toUpperCase()
  const amount = parseMoneyAmount(r?.priceAmount ?? r?.totalAmount)
  if (currency && amount != null) return formatCurrency(amount, currency)
  if (fallbackInr != null) return formatCurrency(fallbackInr, 'INR')
  return '—'
}
