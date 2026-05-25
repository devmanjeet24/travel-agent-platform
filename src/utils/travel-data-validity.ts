import type { TripFlightRow, TripHotelRow } from '@/types/database'

const PLACEHOLDER_HOTEL = /^hotel\s*\d+$/i

/** Legacy placeholder rows before OSM-backed caching (e.g. "Hotel 1"). */
export function isStaleHotelRow(row: TripHotelRow): boolean {
  if (PLACEHOLDER_HOTEL.test(row.name.trim())) return true
  if (!/^(node|way|relation|nominatim)\//.test(row.external_id ?? '')) return true
  const source = row.raw?.source
  if (
    typeof source === 'string' &&
    source &&
    !['osm', 'openstreetmap', 'nominatim-osm'].includes(source)
  ) {
    return true
  }
  return false
}

export function isStaleFlightRow(row: TripFlightRow): boolean {
  const airline = (row.airline ?? '').trim()
  if (/^estimated carrier$/i.test(airline)) return true
  if (/airport/i.test(airline) && airline.includes('→')) return true
  return false
}

export function hasOnlyStaleHotels(hotels: TripHotelRow[] | undefined): boolean {
  if (!hotels?.length) return false
  return hotels.every(isStaleHotelRow)
}

export function hasOnlyStaleFlights(flights: TripFlightRow[] | undefined): boolean {
  if (!flights?.length) return false
  return flights.every(isStaleFlightRow)
}
