/** Display helpers for trip_hotels rows (OSM + cached raw metadata). */

export type TripHotelRaw = {
  source?: string
  address?: string | null
  website?: string | null
  phone?: string | null
  brand?: string | null
  tourism?: string | null
  distanceKm?: number | null
  priceSource?: 'osm_fee' | 'estimate'
  priceNote?: string | null
  osm?: { type?: string; id?: number; tags?: Record<string, string> }
  coord?: { lat: number; lon: number } | null
}

/** Normalize Wikimedia / OSM image URLs for mobile Image. */
export function normalizeHotelImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!trimmed.startsWith('http')) return null
  if (trimmed.includes('commons.wikimedia.org') && !trimmed.includes('width=')) {
    const sep = trimmed.includes('?') ? '&' : '?'
    return `${trimmed}${sep}width=800`
  }
  return trimmed
}

export function parseHotelRaw(raw: unknown): TripHotelRaw | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as TripHotelRaw
}

export function hotelAddress(raw: unknown): string | null {
  const r = parseHotelRaw(raw)
  return r?.address?.trim() || null
}

export function hotelWebsite(raw: unknown): string | null {
  const r = parseHotelRaw(raw)
  const url = r?.website?.trim()
  if (!url) return null
  return url.startsWith('http') ? url : `https://${url}`
}

export function hotelPriceLabel(raw: unknown): string {
  const r = parseHotelRaw(raw)
  if (r?.priceNote) return r.priceNote
  if (r?.priceSource === 'osm_fee') return 'Rate from OpenStreetMap'
  return 'Estimated nightly rate (OSM has no live prices)'
}

export function hotelSourceLabel(raw: unknown): string {
  const r = parseHotelRaw(raw)
  if (r?.source === 'osm') return 'OpenStreetMap'
  return 'OpenStreetMap'
}
