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
  destinationImageUrl?: string | null
  imageSource?: string | null
  searchedFrom?: string | null
  osm?: { type?: string; id?: number; tags?: Record<string, string> }
  coord?: { lat: number; lon: number } | null
}

const generalHotelFallbackImages = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80',
  'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80',
]

const destinationHotelFallbackImages: Record<string, string[]> = {
  melbourne: [
    'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200&q=80',
    'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200&q=80',
    'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&q=80',
  ],
  paris: [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80',
    'https://images.unsplash.com/photo-1522093007474-d86e9bf7ba6f?w=1200&q=80',
  ],
  dubai: [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
    'https://images.unsplash.com/photo-1526495124232-a04e1849168c?w=1200&q=80',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&q=80',
  ],
}

function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function destinationFallbackPool(raw: TripHotelRaw | null): string[] {
  const haystack = [raw?.searchedFrom, raw?.address, raw?.destinationImageUrl]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const key = Object.keys(destinationHotelFallbackImages).find((destination) =>
    haystack.includes(destination),
  )
  return key ? destinationHotelFallbackImages[key] : []
}

function uniqueUrls(urls: (string | null | undefined)[]) {
  const seen = new Set<string>()
  return urls.filter((url): url is string => {
    const normalized = normalizeHotelImageUrl(url)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
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

export function hotelFallbackImageUrl(raw: unknown, hotelName = ''): string | null {
  const r = parseHotelRaw(raw)
  const pool = [...destinationFallbackPool(r), ...generalHotelFallbackImages]
  if (!pool.length) return normalizeHotelImageUrl(r?.destinationImageUrl)
  const seed = [hotelName, r?.searchedFrom, r?.address].filter(Boolean).join('|')
  return pool[stableHash(seed || hotelName || 'hotel') % pool.length]
}

export function hotelImageCandidates(
  imageUrl: string | null | undefined,
  raw: unknown,
  hotelName: string,
): string[] {
  const r = parseHotelRaw(raw)
  const normalizedImageUrl = normalizeHotelImageUrl(imageUrl)
  const normalizedDestinationUrl = normalizeHotelImageUrl(r?.destinationImageUrl)
  const imageIsSharedDestinationFallback =
    normalizedImageUrl &&
    (r?.imageSource === 'destination' || normalizedImageUrl === normalizedDestinationUrl)

  const variedFallback = hotelFallbackImageUrl(raw, hotelName)
  const pool = [...destinationFallbackPool(r), ...generalHotelFallbackImages]
  const seed = stableHash([hotelName, r?.searchedFrom, r?.address].filter(Boolean).join('|'))
  const nextFallback = pool.length ? pool[(seed + 1) % pool.length] : null

  return uniqueUrls([
    imageIsSharedDestinationFallback ? null : normalizedImageUrl,
    variedFallback,
    nextFallback,
    normalizedDestinationUrl,
  ])
}

export function hotelSourceLabel(raw: unknown): string {
  const r = parseHotelRaw(raw)
  if (r?.source === 'osm') return 'OpenStreetMap'
  return 'OpenStreetMap'
}
