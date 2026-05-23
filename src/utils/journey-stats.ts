import type { TripRow } from '@/types/database';

/** Rough country guess when `trips.country` was never set (e.g. plan-trip not run). */
export function inferCountryFromDestination(destination: string): string | null {
  const d = destination.toLowerCase().trim();
  if (!d) return null;

  const rules: Array<[RegExp, string]> = [
    [/\b(bali|jakarta|ubud|indonesia)\b/, 'Indonesia'],
    [/\b(tokyo|osaka|kyoto|japan)\b/, 'Japan'],
    [/\b(paris|lyon|france)\b/, 'France'],
    [/\b(london|manchester|uk|england)\b/, 'United Kingdom'],
    [/\b(new york|los angeles|san francisco|usa|united states)\b/, 'United States'],
    [/\b(dubai|abu dhabi|uae)\b/, 'United Arab Emirates'],
    [/\b(singapore)\b/, 'Singapore'],
    [/\b(bangkok|phuket|thailand)\b/, 'Thailand'],
    [/\b(delhi|mumbai|goa|india)\b/, 'India'],
  ];

  for (const [pattern, country] of rules) {
    if (pattern.test(d)) return country;
  }
  return null;
}

export function countryForTrip(trip: TripRow): string | null {
  return trip.country?.trim() || inferCountryFromDestination(trip.destination);
}

export function computeJourneyStats(
  trips: TripRow[],
  tripIdsWithItinerary: Set<string>,
): {
  tripsCount: number;
  countriesCount: number;
  aiPlansCount: number;
} {
  const countries = new Set<string>();
  for (const trip of trips) {
    const country = countryForTrip(trip);
    if (country) countries.add(country);
  }

  let aiPlansCount = 0;
  for (const trip of trips) {
    if (tripIdsWithItinerary.has(trip.id)) aiPlansCount += 1;
  }

  return {
    tripsCount: trips.length,
    countriesCount: countries.size,
    aiPlansCount,
  };
}
