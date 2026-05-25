import { defaultTripImage, featuredDestinations } from '@/constants/design'
import { formatTripDates } from '@/services/trips/trip-api'
import type { TripRow } from '@/types/database'

const destinationImageOverrides: Record<string, string> = {
  bali: featuredDestinations.find((d) => d.id === 'bali')?.image ?? defaultTripImage,
  indonesia: featuredDestinations.find((d) => d.id === 'bali')?.image ?? defaultTripImage,
  paris: featuredDestinations.find((d) => d.id === 'paris')?.image ?? defaultTripImage,
  france: featuredDestinations.find((d) => d.id === 'paris')?.image ?? defaultTripImage,
  tokyo: featuredDestinations.find((d) => d.id === 'tokyo')?.image ?? defaultTripImage,
  japan: featuredDestinations.find((d) => d.id === 'tokyo')?.image ?? defaultTripImage,
  santorini: featuredDestinations.find((d) => d.id === 'santorini')?.image ?? defaultTripImage,
  greece: featuredDestinations.find((d) => d.id === 'santorini')?.image ?? defaultTripImage,
  china: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&q=80',
  '中国': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&q=80',
  beijing: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&q=80',
  india: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80',
  delhi: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80',
  thailand: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80',
  bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80',
  'new york': 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80',
}

function normalizeDestinationKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function destinationCandidates(trip: Pick<TripRow, 'destination' | 'country'>) {
  const destination = trip.destination.trim()
  const firstPart = destination.split(',')[0]?.trim()
  return [firstPart, destination, trip.country?.trim()]
    .filter((value): value is string => Boolean(value))
}

export function tripImageUri(trip: Pick<TripRow, 'image_url' | 'destination' | 'country'>) {
  const stored = trip.image_url?.trim()
  if (stored) return stored

  for (const candidate of destinationCandidates(trip)) {
    const override = destinationImageOverrides[normalizeDestinationKey(candidate)]
    if (override) return override
  }

  const destination = trip.destination.trim()
  if (!destination) return defaultTripImage

  const query = encodeURIComponent(`${destination} travel destination`)
  return `https://source.unsplash.com/1200x800/?${query}`
}

export function isGeneratedTripTitle(title: string, destination: string) {
  const normalizedTitle = title.trim().toLowerCase()
  const normalizedDestination = destination.trim().toLowerCase()
  const destinationName = normalizedDestination.split(',')[0]?.trim()

  if (!normalizedTitle) return true
  if (/^(new|untitled|saved)?\s*trip(\s*planning)?$/i.test(title.trim())) return true
  if (normalizedTitle === `${normalizedDestination} trip`) return true
  if (destinationName && normalizedTitle === `${destinationName} trip`) return true
  return false
}

export function tripCardLabels(trip: TripRow) {
  const title = trip.title.trim()
  const destination = trip.destination.trim()
  const displayTitle =
    destination && isGeneratedTripTitle(title, destination)
      ? destination
      : title || destination || 'Trip'
  const subtitle =
    destination && destination.toLowerCase() !== displayTitle.toLowerCase()
      ? destination
      : formatTripDates(trip.start_date, trip.end_date)

  return { displayTitle, subtitle }
}
