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
  australia: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&q=80',
  sydney: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&q=80',
  melbourne: 'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200&q=80',
  'new zealand': 'https://images.unsplash.com/photo-1469521669194-babb45599def?w=1200&q=80',
  auckland: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1200&q=80',
  queenstown: 'https://images.unsplash.com/photo-1589871973318-9ca1258faa5d?w=1200&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
  london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80',
  'new york': 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80',
  usa: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80',
  'united states': 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&q=80',
  italy: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1200&q=80',
  rome: 'https://images.unsplash.com/photo-1529154036614-a60975f5c760?w=1200&q=80',
  spain: 'https://images.unsplash.com/photo-1509840841025-9088ba78a826?w=1200&q=80',
  barcelona: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1200&q=80',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
  nepal: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&q=80',
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
  const destinationParts = destination
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return [destinationParts[0], ...destinationParts.slice(1), destination, trip.country?.trim()]
    .filter((value): value is string => Boolean(value))
}

function destinationSearchImage(candidate: string) {
  const terms = [
    ...candidate
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
    'travel',
    'landmark',
  ]
  const query = terms.map(encodeURIComponent).join(',')
  return `https://loremflickr.com/1200/800/${query}`
}

export function tripImageUri(trip: Pick<TripRow, 'image_url' | 'destination' | 'country'>) {
  const stored = trip.image_url?.trim()
  if (stored) return stored

  const candidates = destinationCandidates(trip)
  for (const candidate of candidates) {
    const override = destinationImageOverrides[normalizeDestinationKey(candidate)]
    if (override) return override
  }

  const destination = candidates[0] ?? trip.destination.trim()
  if (!destination) return defaultTripImage

  return destinationSearchImage(destination)
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
