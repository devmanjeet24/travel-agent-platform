import type { TripFlightRow, TripHotelRow } from '@/types/database'

const PLACEHOLDER_HOTEL = /^hotel\s*\d+$/i
const LEGACY_DUMMY_HOTEL_PRICE_INR = 12_000

/** Legacy placeholder rows before OSM-backed caching (e.g. "Hotel 1"). */
export function isStaleHotelRow(row: TripHotelRow): boolean {
  if (PLACEHOLDER_HOTEL.test(row.name.trim())) return true
  if (!/^(node|way|relation|nominatim|liteapi|geoapify)\//.test(row.external_id ?? '')) return true
  const source = row.raw?.source
  if (
    typeof source === 'string' &&
    source &&
    !['liteapi', 'geoapify', 'osm', 'openstreetmap', 'nominatim-osm'].includes(source)
  ) {
    return true
  }
  return false
}

export function isStaleFlightRow(row: TripFlightRow): boolean {
  const airline = (row.airline ?? '').trim()
  if (/^estimated carrier$/i.test(airline)) return true
  if (/airport/i.test(airline) && airline.includes('→')) return true
  const source = row.raw?.source
  if (source === 'estimate' || source === 'osm') return true
  return false
}

export function hasOnlyStaleHotels(hotels: TripHotelRow[] | undefined): boolean {
  if (!hotels?.length) return false
  return hotels.every(isStaleHotelRow)
}

export function hasLowQualityHotelData(hotels: TripHotelRow[] | undefined): boolean {
  if (!hotels?.length) return false
  const missingImages = hotels.filter((hotel) => !hotel.image_url?.trim()).length
  const repeatedLegacyPrice =
    hotels.length > 1 &&
    hotels.every((hotel) => Number(hotel.price_per_night_usd) === LEGACY_DUMMY_HOTEL_PRICE_INR)
  return missingImages === hotels.length || repeatedLegacyPrice
}

export function hasOnlyStaleFlights(flights: TripFlightRow[] | undefined): boolean {
  if (!flights?.length) return false
  return flights.every(isStaleFlightRow)
}
