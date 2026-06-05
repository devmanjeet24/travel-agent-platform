/** Geocoding, weather, hotels, flights, trains, and buses using public/optional-key APIs. */

import { formatInr } from './currency.ts';
import {
  getCachedTravelContext,
  setCachedTravelContext,
  travelContextCacheKey,
} from './travel-context-cache.ts';
import {
  buildIndianRailContext,
  searchIndianTrains,
} from './indian-rail-api.ts';
import {
  buildBusContext,
  searchBusOptions,
} from './bus-api.ts';
import {
  analyzeRoute,
  buildTransportGuidanceBlock,
  estimateBusPriceInr,
  estimateFlightPriceInr,
  estimateTrainPriceInr,
  groundTransportEstimates,
  shouldIncludeFlights,
  tripDaysFromDates,
} from './transport-guidance.ts';

export type GeoResult = {
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lon: number;
  displayName: string;
  placeType?: string;
  imageUrl?: string | null;
};

export type WeatherDay = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  weatherCode: number;
};

export type WeatherResult = {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  daily: WeatherDay[];
  summary: string;
};

export type HotelOffer = {
  id: string;
  name: string;
  rating: number | null;
  pricePerNightUsd: number | null;
  imageUrl: string | null;
  /** Provider/source for hotel identity. Prices are INR estimates unless raw.priceSource says provider. */
  source: 'liteapi' | 'geoapify' | 'osm' | 'estimate';
  raw: Record<string, unknown>;
};

export type PlaceOffer = {
  id: string;
  name: string;
  category: 'restaurant' | 'place';
  address: string | null;
  latitude: number;
  longitude: number;
  cuisine: string | null;
  website: string | null;
  phone: string | null;
  source: 'geoapify' | 'osm' | 'nominatim-osm';
  raw: Record<string, unknown>;
};

export type FlightOffer = {
  id: string;
  airline: string;
  route: string;
  departTime: string;
  arriveTime: string;
  priceUsd: number | null;
  stops: string;
  source: 'estimate' | 'osm' | 'duffel';
  raw: Record<string, unknown>;
};

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const;

const NOMINATIM_TIMEOUT_MS = 8_000;
const OPEN_METEO_TIMEOUT_MS = 8_000;
const OVERPASS_TIMEOUT_MS = 8_000;
const WIKIDATA_TIMEOUT_MS = 5_000;
const COMMONS_TIMEOUT_MS = 3_000;
const LITEAPI_TIMEOUT_MS = 9_000;
const GEOAPIFY_TIMEOUT_MS = 8_000;

const NOMINATIM_HEADERS = {
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
  'Accept-Language': 'en',
};

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
};

type EnvGlobal = typeof globalThis & {
  Deno?: {
    env?: {
      get(name: string): string | undefined;
    };
  };
};

function env(name: string): string | undefined {
  return (globalThis as EnvGlobal).Deno?.env?.get(name);
}

function liteApiKey(): string | undefined {
  return env('LITEAPI_KEY') ?? env('LITEAPI_API_KEY') ?? env('LITE_API_KEY');
}

function liteApiHotelSearchEnabled(): boolean {
  const value = env('LITEAPI_HOTELS_ENABLED') ?? env('ENABLE_LITEAPI_HOTELS') ?? '';
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

function geoapifyKey(): string | undefined {
  return env('GEOAPIFY_API_KEY') ?? env('GEOAPIFY_KEY');
}

const PLACEHOLDER_IMAGE_HOSTS = [
  'loremflickr.com',
  'picsum.photos',
  'placehold.co',
  'via.placeholder.com',
  'source.unsplash.com',
] as const;
const PLACEHOLDER_UNSPLASH_PHOTO_IDS = [
  'photo-1488646953014-85cb44e25828',
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1507525428034-b723cf961d3e',
] as const;

const DESTINATION_IMAGE_OVERRIDES: Record<string, string> = {
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
  indonesia: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
  france: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
  'paris france': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
  japan: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
  santorini: 'https://images.unsplash.com/photo-1613395877344-13f27c9eb15d?w=1200&q=80',
  greece: 'https://images.unsplash.com/photo-1613395877344-13f27c9eb15d?w=1200&q=80',
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
  'melbourne australia': 'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200&q=80',
  'new zealand': 'https://images.unsplash.com/photo-1469521669194-babb45599def?w=1200&q=80',
  auckland: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1200&q=80',
  queenstown: 'https://images.unsplash.com/photo-1589871973318-9ca1258faa5d?w=1200&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
  uae: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
  'united arab emirates': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
  'dubai uae': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
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
};

function normalizeDestinationKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPlaceholderImageHost(hostname: string): boolean {
  return PLACEHOLDER_IMAGE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

function isGenericUnsplashImage(value: string): boolean {
  const parsed = safeParseUrl(value);
  if (!parsed) {
    return PLACEHOLDER_UNSPLASH_PHOTO_IDS.some((id) => value.includes(id));
  }
  if (parsed.hostname.toLowerCase() !== 'images.unsplash.com') return false;
  return PLACEHOLDER_UNSPLASH_PHOTO_IDS.some((id) => parsed.pathname.includes(id));
}

export function isPlaceholderTripImageUrl(url: string | null | undefined): boolean {
  const value = url?.trim();
  if (!value) return true;
  if (isGenericUnsplashImage(value)) return true;
  const parsed = safeParseUrl(value);
  return parsed ? isPlaceholderImageHost(parsed.hostname.toLowerCase()) : false;
}

function knownDestinationImageUrl(candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const parts = candidate
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const value of [candidate, ...parts]) {
      const image = DESTINATION_IMAGE_OVERRIDES[normalizeDestinationKey(value)];
      if (image) return image;
    }
  }
  return null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidLatLon(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  return true;
}

function parseStars(tags: Record<string, string>): number | null {
  const raw = tags.stars;
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Parse OSM fee/charge tags into nightly INR when present. */
function parseOsmFeeInr(tags: Record<string, string>): number | null {
  const raw = (tags.fee ?? tags.charge ?? tags['rooms:charge'] ?? '').trim();
  if (!raw) return null;
  const inr = raw.match(/(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*)/i);
  if (inr) {
    const n = Number(inr[1].replace(/,/g, ''));
    if (n >= 300 && n <= 200_000) return n;
  }
  const plain = raw.match(/(\d[\d,]{2,6})\s*(?:inr|rs|₹)?/i);
  if (plain) {
    const n = Number(plain[1].replace(/,/g, ''));
    if (n >= 300 && n <= 200_000) return n;
  }
  return null;
}

export type HotelSearchOptions = {
  budgetInr?: number;
  tripDays?: number;
  travelers?: number;
};

type HotelPriceSignals = {
  name: string;
  tourism?: string | null;
  distanceKm?: number | null;
};

function normalizeHotelSearchOptions(input?: HotelSearchOptions | number): HotelSearchOptions {
  return typeof input === 'number' ? { budgetInr: input } : (input ?? {});
}

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tourismBasePriceInr(tourism?: string | null): number {
  switch ((tourism ?? '').toLowerCase()) {
    case 'hostel':
      return 1500;
    case 'guest_house':
      return 2200;
    case 'motel':
      return 3000;
    case 'apartment':
      return 3200;
    case 'chalet':
      return 4200;
    case 'resort':
      return 7200;
    case 'hotel':
      return 4200;
    default:
      return 3200;
  }
}

function starsBasePriceInr(stars: number | null): number | null {
  if (!stars) return null;
  if (stars >= 5) return 11000;
  if (stars >= 4) return 7000;
  if (stars >= 3) return 4500;
  if (stars >= 2) return 2800;
  return 1800;
}

function roundToNearestHundred(value: number): number {
  return Math.round(value / 100) * 100;
}

function estimateHotelPriceInr(
  stars: number | null,
  options?: HotelSearchOptions,
  osmFeeInr?: number | null,
  signals?: HotelPriceSignals,
): number | null {
  if (osmFeeInr != null) return osmFeeInr;
  const tourism = signals?.tourism ?? null;
  const name = signals?.name ?? '';
  const distanceKm = signals?.distanceKm ?? null;
  const baseFromStars = starsBasePriceInr(stars);
  let estimate = baseFromStars ?? tourismBasePriceInr(tourism);

  if (distanceKm != null) {
    if (distanceKm <= 1.5) estimate *= 1.14;
    else if (distanceKm <= 5) estimate *= 1.06;
    else if (distanceKm >= 18) estimate *= 0.88;
    else if (distanceKm >= 10) estimate *= 0.94;
  }

  const budgetInr = options?.budgetInr;
  if (budgetInr && budgetInr > 0) {
    const travelers = Math.max(1, options?.travelers ?? 1);
    const tripDays = Math.max(1, options?.tripDays ?? 7);
    const roomCount = Math.max(1, Math.ceil(travelers / 2));
    const perRoomNightBudget = Math.max(900, (budgetInr * 0.35) / tripDays / roomCount);
    estimate = estimate * 0.65 + perRoomNightBudget * 0.35;
  }

  const variance = ((stableHash(name || tourism || 'hotel') % 25) - 12) / 100;
  estimate *= 1 + variance;

  const min = tourism === 'hostel' ? 700 : 1000;
  const max = stars && stars >= 5 ? 35_000 : tourism === 'resort' ? 28_000 : 22_000;
  return Math.max(min, Math.min(roundToNearestHundred(estimate), max));
}

function isLowBudgetHotels(budgetInr?: number): boolean {
  if (!budgetInr || budgetInr <= 0) return false;
  return budgetInr < 25_000;
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  importance?: number;
  namedetails?: Record<string, string>;
  address?: {
    country?: string;
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
  extratags?: Record<string, string>;
};

function isMostlyLatinText(value: string): boolean {
  return /^[\p{Script=Latin}\p{N}\s.,'()-]+$/u.test(value.trim());
}

function nominatimEnglishPlaceName(hit: NominatimHit): string | null {
  const namedetails = hit.namedetails ?? {};
  for (const key of ['name:en', 'name:en-US', 'name:en-GB', 'name:international']) {
    const value = namedetails[key]?.trim();
    if (value) return value;
  }

  const fromAddress =
    hit.address?.city?.trim() ??
    hit.address?.town?.trim() ??
    hit.address?.village?.trim() ??
    null;
  if (fromAddress && isMostlyLatinText(fromAddress)) return fromAddress;

  const firstSegment = hit.display_name.split(',')[0]?.trim() ?? '';
  if (firstSegment && isMostlyLatinText(firstSegment)) return firstSegment;

  return fromAddress ?? (firstSegment || null);
}

function nominatimEnglishRegionName(hit: NominatimHit, field: 'state' | 'country'): string {
  const value = hit.address?.[field]?.trim() ?? '';
  if (value && isMostlyLatinText(value)) return value;
  const segmentIndex = field === 'country' ? -1 : 1;
  const segments = hit.display_name.split(',').map((part) => part.trim()).filter(Boolean);
  const fallback =
    segmentIndex === -1
      ? segments[segments.length - 1] ?? ''
      : segments[segmentIndex] ?? '';
  return fallback && isMostlyLatinText(fallback) ? fallback : value;
}

async function nominatimSearch(
  q: string,
  opts?: { featureType?: string; limit?: number },
): Promise<NominatimHit[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(opts?.limit ?? 5));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('accept-language', 'en');
  if (opts?.featureType) {
    url.searchParams.set('featuretype', opts.featureType);
  }

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: NOMINATIM_HEADERS },
    NOMINATIM_TIMEOUT_MS,
  );
  if (!res.ok) return [];
  return (await res.json()) as NominatimHit[];
}

async function wikidataImageUrlForSearch(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', q);
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { 'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge)' } },
      WIKIDATA_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const id = data?.search?.[0]?.id;
    return typeof id === 'string' ? wikidataImageUrl(id) : null;
  } catch {
    return null;
  }
}

async function destinationImageFromHit(
  hit: NominatimHit,
  fallbackQuery: string,
): Promise<string | null> {
  const tags = hit.extratags ?? {};
  const tagged = osmImageFromTags(tags);
  if (tagged) return tagged;
  if (tags.wikidata) return wikidataImageUrl(tags.wikidata);
  const candidates = [
    hit.address?.city,
    hit.address?.town,
    hit.address?.village,
    hit.address?.state,
    fallbackQuery,
    hit.address?.country,
  ].filter((value, index, values): value is string =>
    Boolean(value?.trim()) && values.indexOf(value) === index
  );
  for (const candidate of candidates) {
    const image = await wikidataImageUrlForSearch(candidate);
    if (image) return image;
  }
  return knownDestinationImageUrl(candidates);
}

function hitToGeo(hit: NominatimHit, fallbackQuery: string): GeoResult {
  const cityName =
    nominatimEnglishPlaceName(hit) ??
    hit.address?.city ??
    hit.address?.town ??
    hit.address?.village;
  const name =
    cityName ??
    hit.address?.state ??
    fallbackQuery.split(',')[0]?.trim() ??
    fallbackQuery;
  const country =
    (nominatimEnglishRegionName(hit, 'country') || hit.address?.country) ?? '';
  return {
    name,
    country,
    countryCode: hit.address?.country_code?.toUpperCase(),
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
    placeType: cityName ? 'city' : (hit.type ?? hit.class),
    imageUrl: null,
  };
}

function pickBestGeocodeHit(hits: NominatimHit[]): NominatimHit | null {
  if (!hits.length) return null;
  const scored = hits.map((hit) => {
    let score = hit.importance ?? 0;
    const type = (hit.type ?? '').toLowerCase();
    const cls = (hit.class ?? '').toLowerCase();
    if (['city', 'town', 'village', 'administrative'].includes(type)) score += 2;
    if (cls === 'place' || cls === 'boundary') score += 1;
    if (type === 'hotel' || type === 'hostel') score -= 3;
    return { hit, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.hit ?? null;
}

export type CitySuggestion = {
  id: string;
  label: string;
  subtitle: string;
  /** Travel-style value, e.g. "Delhi, India" */
  value: string;
};

function scoreCitySuggestionHit(hit: NominatimHit): number {
  let score = hit.importance ?? 0;
  const type = (hit.type ?? '').toLowerCase();
  const cls = (hit.class ?? '').toLowerCase();
  if (['city', 'town', 'village'].includes(type)) score += 3;
  if (type === 'administrative') score += 1;
  if (cls === 'place' || cls === 'boundary') score += 1;
  if (type === 'hotel' || type === 'hostel' || type === 'aerodrome') score -= 5;
  return score;
}

function nominatimHitToCitySuggestion(hit: NominatimHit): CitySuggestion | null {
  const place = nominatimEnglishPlaceName(hit);
  if (!place) return null;

  const state = nominatimEnglishRegionName(hit, 'state');
  const country = nominatimEnglishRegionName(hit, 'country');
  const value = country ? `${place}, ${country}` : place;
  const subtitleParts = [state, country].filter(Boolean);
  const subtitle =
    subtitleParts.length > 0
      ? subtitleParts.join(' · ')
      : hit.display_name.split(',').slice(1, 3).join(',').trim();

  return {
    id: `${hit.lat},${hit.lon}`,
    label: place,
    subtitle,
    value,
  };
}

function mergeNominatimHits(...groups: NominatimHit[][]): NominatimHit[] {
  const seen = new Set<string>();
  const merged: NominatimHit[] = [];
  for (const group of groups) {
    for (const hit of group) {
      const key = `${hit.lat},${hit.lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }
  return merged;
}

/** City autocomplete for trip origin/destination (Nominatim / OpenStreetMap). */
export async function searchCitySuggestions(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cityHits = await nominatimSearch(q, { featureType: 'city', limit: 8 });
  const generalHits =
    cityHits.length >= 6 ? [] : await nominatimSearch(q, { limit: 8 });
  const hits = mergeNominatimHits(cityHits, generalHits).sort(
    (a, b) => scoreCitySuggestionHit(b) - scoreCitySuggestionHit(a),
  );

  const suggestions: CitySuggestion[] = [];
  const seenValues = new Set<string>();
  for (const hit of hits) {
    const suggestion = nominatimHitToCitySuggestion(hit);
    if (!suggestion) continue;
    const key = suggestion.value.toLowerCase();
    if (seenValues.has(key)) continue;
    seenValues.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= 6) break;
  }
  return suggestions;
}

export async function geocodeDestination(query: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;

  let hits = await nominatimSearch(q, { featureType: 'city' });
  let hit = pickBestGeocodeHit(hits);
  if (!hit) {
    hits = await nominatimSearch(q);
    hit = pickBestGeocodeHit(hits);
  }
  if (!hit) return null;
  const geo = hitToGeo(hit, q);
  geo.imageUrl = await destinationImageFromHit(hit, q);
  return geo;
}

/** Use saved trip coordinates when geocoding drifts from the user's destination label. */
export function geoFromCoordinates(
  lat: number,
  lon: number,
  label: string,
  country = '',
  countryCode?: string,
  placeType = 'coordinates',
  imageUrl: string | null = null,
): GeoResult {
  return {
    name: label.split(',')[0]?.trim() || label,
    country,
    countryCode,
    lat,
    lon,
    displayName: label,
    placeType,
    imageUrl,
  };
}

/** Geocode a place name near a destination (for itinerary pins). */
export async function geocodeNearDestination(
  placeName: string,
  near: GeoResult,
): Promise<{ lat: number; lon: number } | null> {
  const cleanName = placeName.trim();
  if (!cleanName) return null;

  if (/\b(local market|local attractions|nearby attractions|things to do|free time)\b/i.test(cleanName)) {
    console.debug('[travel-apis] skipped generic activity geocode', {
      placeName: cleanName,
      destination: near.displayName,
    });
    return null;
  }

  const q = `${cleanName}, ${near.displayName || near.name}`;
  const radiusKm = 50;
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm /
    (111 * Math.max(0.2, Math.cos((near.lat * Math.PI) / 180)));
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('accept-language', 'en');
  url.searchParams.set(
    'viewbox',
    `${near.lon - lonDelta},${near.lat + latDelta},${near.lon + lonDelta},${near.lat - latDelta}`,
  );
  url.searchParams.set('bounded', '1');

  const res = await fetchWithTimeout(
    url.toString(),
    { headers: NOMINATIM_HEADERS },
    NOMINATIM_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.warn('[travel-apis] activity geocode failed', {
      placeName: cleanName,
      status: res.status,
    });
    return null;
  }
  const data = (await res.json()) as NominatimHit[];
  const candidates = data
    .map((hit) => {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!isValidLatLon(lat, lon)) return null;
      const distanceKm = haversineKm(near.lat, near.lon, lat, lon);
      const cls = (hit.class ?? '').toLowerCase();
      const type = (hit.type ?? '').toLowerCase();
      const genericPlace = cls === 'boundary' ||
        cls === 'place' ||
        ['city', 'town', 'village', 'administrative', 'country'].includes(type);
      if (distanceKm > radiusKm || genericPlace) return null;
      return { hit, lat, lon, distanceKm };
    })
    .filter((item): item is {
      hit: NominatimHit;
      lat: number;
      lon: number;
      distanceKm: number;
    } => Boolean(item))
    .sort((a, b) => {
      const importanceA = a.hit.importance ?? 0;
      const importanceB = b.hit.importance ?? 0;
      return a.distanceKm - b.distanceKm || importanceB - importanceA;
    });

  const best = candidates[0];
  console.debug('[travel-apis] activity geocode result', {
    placeName: cleanName,
    destination: near.displayName,
    hitCount: data.length,
    accepted: Boolean(best),
    lat: best?.lat ?? null,
    lon: best?.lon ?? null,
    distanceKm: best?.distanceKm ?? null,
    displayName: best?.hit.display_name ?? null,
  });
  if (!best) return null;
  return { lat: best.lat, lon: best.lon };
}

export async function fetchWeather(
  lat: number,
  lon: number,
  days = 7,
): Promise<WeatherResult | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', String(Math.min(days, 16)));

  const res = await fetchWithTimeout(url.toString(), {}, OPEN_METEO_TIMEOUT_MS);
  if (!res.ok) return null;

  const data = await res.json();
  const daily = data.daily;
  if (!daily?.time) return null;

  const weatherDays: WeatherDay[] = daily.time.map((date: string, i: number) => ({
    date,
    tempMaxC: daily.temperature_2m_max[i],
    tempMinC: daily.temperature_2m_min[i],
    precipitationMm: daily.precipitation_sum[i] ?? 0,
    weatherCode: daily.weathercode[i],
  }));

  const avgMax =
    weatherDays.reduce((s, d) => s + d.tempMaxC, 0) / weatherDays.length;

  return {
    location: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    latitude: lat,
    longitude: lon,
    timezone: data.timezone ?? 'UTC',
    daily: weatherDays,
    summary: `Open-Meteo forecast: highs around ${Math.round(avgMax)}°C over ${weatherDays.length} days.`,
  };
}

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function overpassQuery(
  query: string,
  opts: { failOnError?: boolean } = {},
): Promise<OsmElement[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: OVERPASS_HEADERS,
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_TIMEOUT_MS,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        lastError = new Error(
          `OpenStreetMap hotel search failed (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ''}.`,
        );
        continue;
      }
      const json = await res.json();
      return (json.elements ?? []) as OsmElement[];
    } catch (e) {
      lastError = e instanceof Error
        ? e
        : new Error('OpenStreetMap hotel search failed.');
    }
  }

  if (opts.failOnError && lastError) throw lastError;
  return [];
}

function elementCoord(el: OsmElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function osmHotelName(tags: Record<string, string>): string | null {
  const name =
    tags.name?.trim() ||
    tags['name:en']?.trim() ||
    tags['official_name']?.trim() ||
    tags.brand?.trim();
  if (!name || /^hotel\s*\d*$/i.test(name)) return null;
  return name;
}

function osmHotelAddress(tags: Record<string, string>): string | null {
  const street = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ')
    .trim();
  const parts = [
    street || null,
    tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:place'] ?? tags['addr:suburb'],
    tags['addr:state'],
    tags['addr:postcode'],
    tags['addr:country'],
  ].filter((p): p is string => Boolean(p && String(p).trim()));
  if (parts.length) return parts.join(', ');
  const full = tags['addr:full']?.trim();
  return full || null;
}

function commonsFileUrl(file: string): string {
  const clean = file.replace(/^File:/i, '').trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=800`;
}

function osmImageFromTags(tags: Record<string, string>): string | null {
  const direct = tags.image ?? tags['image:url'];
  if (direct?.startsWith('http')) return direct;
  const commons = tags.wikimedia_commons;
  if (commons && !commons.startsWith('Category:')) return commonsFileUrl(commons);
  return null;
}

async function wikidataImageUrl(wikidataTag: string): Promise<string | null> {
  const qid = wikidataTag
    .replace(/^https?:\/\/(www\.)?wikidata\.org\/wiki\//i, '')
    .trim();
  if (!/^Q\d+$/i.test(qid)) return null;
  try {
    const res = await fetchWithTimeout(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { 'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge)' } },
      WIKIDATA_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data?.entities?.[qid];
    const fileName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (typeof fileName === 'string' && fileName.length > 0) {
      return commonsFileUrl(fileName);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function commonsImageUrlForSearch(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrsearch', q);
    url.searchParams.set('gsrlimit', '3');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url');
    url.searchParams.set('iiurlwidth', '800');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { 'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge)' } },
      COMMONS_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages ?? {}) as Array<{
      imageinfo?: Array<{ thumburl?: string; url?: string }>;
    }>;
    for (const page of pages) {
      const image = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url;
      if (typeof image === 'string' && image.startsWith('http')) return image;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function hotelImageFromSearch(
  name: string,
  geo: GeoResult,
): Promise<string | null> {
  const place = geo.name.trim();
  const queries = [
    `${name} ${place}`,
    `${name} hotel ${place}`,
  ].filter((query, index, queries): query is string =>
    Boolean(query.trim()) && queries.indexOf(query) === index
  );

  for (const query of queries) {
    const wikidata = await wikidataImageUrlForSearch(query);
    if (wikidata) return wikidata;
    const commons = await commonsImageUrlForSearch(query);
    if (commons) return commons;
  }
  return null;
}

type LiteApiHotel = {
  id?: string;
  name?: string;
  country?: string;
  city?: string;
  latitude?: number | string;
  longitude?: number | string;
  address?: string | null;
  main_photo?: string | null;
  thumbnail?: string | null;
  stars?: number | string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  chain?: string | null;
  hotelDescription?: string | null;
};

type GeoapifyFeature = {
  properties?: Record<string, unknown>;
  geometry?: {
    coordinates?: [number, number];
  };
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizedRating(value: unknown): number | null {
  const n = asNumber(value);
  if (n == null || n <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(n > 5 ? n / 2 : n)));
}

function geoapifyFeatureCoord(feature: GeoapifyFeature): { lat: number; lon: number } | null {
  const props = feature.properties ?? {};
  const propLat = asNumber(props.lat);
  const propLon = asNumber(props.lon);
  if (propLat != null && propLon != null && isValidLatLon(propLat, propLon)) {
    return { lat: propLat, lon: propLon };
  }
  const [lon, lat] = feature.geometry?.coordinates ?? [];
  return lat != null && lon != null && isValidLatLon(lat, lon) ? { lat, lon } : null;
}

async function searchHotelsLiteApi(
  geo: GeoResult,
  options?: HotelSearchOptions,
): Promise<HotelOffer[]> {
  const key = liteApiKey();
  if (!key) return [];

  const url = new URL('https://api.liteapi.travel/v3.0/data/hotels');
  url.searchParams.set('latitude', String(geo.lat));
  url.searchParams.set('longitude', String(geo.lon));
  url.searchParams.set('radius', '30000');
  url.searchParams.set('limit', '20');
  url.searchParams.set('timeout', '3');

  try {
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { 'X-API-Key': key, 'Accept': 'application/json' } },
      LITEAPI_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.warn('[travel-apis] LiteAPI hotel search failed', {
        searchedFrom: geo.displayName,
        status: res.status,
      });
      return [];
    }
    const data = await res.json();
    const hotels = (Array.isArray(data?.data) ? data.data : []) as LiteApiHotel[];
    const offers = hotels
      .map((hotel, index): HotelOffer | null => {
        const lat = asNumber(hotel.latitude);
        const lon = asNumber(hotel.longitude);
        const name = hotel.name?.trim();
        if (!name || lat == null || lon == null || !isValidLatLon(lat, lon)) return null;
        const distanceKm = Math.round(haversineKm(geo.lat, geo.lon, lat, lon) * 10) / 10;
        if (distanceKm > 75) return null;
        const stars = normalizedRating(hotel.stars);
        const imageUrl = hotel.main_photo?.trim() || hotel.thumbnail?.trim() || null;
        const address = hotel.address?.trim() ||
          [hotel.city, hotel.country].filter(Boolean).join(', ') ||
          null;
        return {
          id: `liteapi/${hotel.id ?? `${lat.toFixed(6)},${lon.toFixed(6)}/${index}`}`,
          name,
          rating: stars,
          pricePerNightUsd: estimateHotelPriceInr(stars, options, null, {
            name,
            tourism: 'hotel',
            distanceKm,
          }),
          imageUrl,
          source: 'liteapi',
          raw: {
            source: 'liteapi',
            provider: 'LiteAPI hotel data',
            address,
            city: hotel.city ?? null,
            country: hotel.country ?? null,
            chain: hotel.chain ?? null,
            reviewRating: asNumber(hotel.rating),
            reviewCount: asNumber(hotel.reviewCount),
            description: hotel.hotelDescription ?? null,
            distanceKm,
            coord: { lat, lon },
            priceSource: 'estimate',
            priceNote: 'Estimated nightly rate from property rating, location, and trip budget - not a live LiteAPI room rate',
            rawHotel: hotel,
          },
        };
      })
      .filter((offer): offer is HotelOffer => Boolean(offer))
      .sort((a, b) => Number(a.raw.distanceKm ?? 999) - Number(b.raw.distanceKm ?? 999))
      .slice(0, 8);

    console.debug('[travel-apis] LiteAPI hotel response', {
      searchedFrom: geo.displayName,
      hotelCount: offers.length,
      sampleNames: offers.slice(0, 5).map((offer) => offer.name),
    });
    return offers;
  } catch (error) {
    console.warn('[travel-apis] LiteAPI hotel search threw', {
      searchedFrom: geo.displayName,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function searchHotelsGeoapify(
  geo: GeoResult,
  options?: HotelSearchOptions,
): Promise<HotelOffer[]> {
  const key = geoapifyKey();
  if (!key) return [];

  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set(
    'categories',
    'accommodation.hotel,accommodation.hostel,accommodation.guest_house,accommodation.motel,accommodation.apartment',
  );
  url.searchParams.set('filter', `circle:${geo.lon},${geo.lat},30000`);
  url.searchParams.set('bias', `proximity:${geo.lon},${geo.lat}`);
  url.searchParams.set('limit', '20');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('apiKey', key);

  try {
    const res = await fetchWithTimeout(url.toString(), {}, GEOAPIFY_TIMEOUT_MS);
    if (!res.ok) {
      console.warn('[travel-apis] Geoapify hotel search failed', {
        searchedFrom: geo.displayName,
        status: res.status,
      });
      return [];
    }
    const data = await res.json();
    const features = (Array.isArray(data?.features) ? data.features : []) as GeoapifyFeature[];
    const seen = new Set<string>();
    const offers = features
      .map((feature, index): HotelOffer | null => {
        const props = feature.properties ?? {};
        const coord = geoapifyFeatureCoord(feature);
        const name = asString(props.name) || asString(props.address_line1);
        if (!coord || !name || /^hotel\s*\d*$/i.test(name)) return null;
        const key = `${name.toLowerCase()}|${coord.lat.toFixed(5)},${coord.lon.toFixed(5)}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const distanceKm = Math.round(haversineKm(geo.lat, geo.lon, coord.lat, coord.lon) * 10) / 10;
        const categories = Array.isArray(props.categories) ? props.categories : [];
        const tourism = categories.find((category) => typeof category === 'string' && category.startsWith('accommodation.')) ??
          'hotel';
        const address = asString(props.formatted) ||
          [asString(props.address_line1), asString(props.address_line2)].filter(Boolean).join(', ') ||
          null;
        const stars = normalizedRating(props.stars);
        return {
          id: `geoapify/${asString(props.place_id) || `${coord.lat.toFixed(6)},${coord.lon.toFixed(6)}/${index}`}`,
          name,
          rating: stars,
          pricePerNightUsd: estimateHotelPriceInr(stars, options, null, {
            name,
            tourism: typeof tourism === 'string' ? tourism.replace('accommodation.', '') : 'hotel',
            distanceKm,
          }),
          imageUrl: null,
          source: 'geoapify',
          raw: {
            source: 'geoapify',
            provider: 'Geoapify Places',
            address,
            website: asString(props.website) || null,
            phone: asString(props.contact_phone) || asString(props.phone) || null,
            categories,
            distanceKm,
            coord,
            priceSource: 'estimate',
            priceNote: 'Estimated nightly rate from property type, location, and trip budget - not a live booking price',
            rawPlace: props,
          },
        };
      })
      .filter((offer): offer is HotelOffer => Boolean(offer))
      .sort((a, b) => Number(a.raw.distanceKm ?? 999) - Number(b.raw.distanceKm ?? 999))
      .slice(0, 8);

    console.debug('[travel-apis] Geoapify hotel response', {
      searchedFrom: geo.displayName,
      hotelCount: offers.length,
      sampleNames: offers.slice(0, 5).map((offer) => offer.name),
    });
    return offers;
  } catch (error) {
    console.warn('[travel-apis] Geoapify hotel search threw', {
      searchedFrom: geo.displayName,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function hotelQualityScore(
  el: OsmElement,
  geo: GeoResult,
  budgetInr?: number,
): number {
  const tags = el.tags ?? {};
  let score = 0;
  if (osmHotelName(tags)) score += 10;
  const stars = parseStars(tags);
  if (stars) score += stars * 2;
  if (tags.image || tags['image:url'] || tags.wikimedia_commons) score += 3;
  if (tags.wikidata) score += 2;
  if (tags.website) score += 1;
  if (tags['addr:street'] || tags['addr:city']) score += 2;
  if (tags.tourism === 'hotel' || tags.tourism === 'motel' || tags.tourism === 'resort') score += 3;
  if (tags.tourism === 'guest_house') score += 1;
  if (tags.tourism === 'apartment' || tags.tourism === 'chalet') score += 1;
  if (tags.tourism === 'hostel' && !isLowBudgetHotels(budgetInr)) score -= 6;

  const coord = elementCoord(el);
  if (coord) {
    const km = haversineKm(geo.lat, geo.lon, coord.lat, coord.lon);
    score += Math.max(0, 8 - km / 2);
  }
  return score;
}

const HOTEL_SEARCH_RADII_METERS = [12000, 30000, 60000] as const;
const HOTEL_TOURISM_VALUES = 'hotel|motel|guest_house|hostel|apartment|resort|chalet';

function overpassString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function hotelOverpassQuery(geo: GeoResult, radiusMeters: number): string {
  return `
[out:json][timeout:8];
(
  node["tourism"~"${HOTEL_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  way["tourism"~"${HOTEL_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  relation["tourism"~"${HOTEL_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  node["building"="hotel"]["name"](around:${radiusMeters},${geo.lat},${geo.lon});
  way["building"="hotel"]["name"](around:${radiusMeters},${geo.lat},${geo.lon});
  relation["building"="hotel"]["name"](around:${radiusMeters},${geo.lat},${geo.lon});
);
out body center;
`;
}

function isBroadDestination(geo: GeoResult): boolean {
  const name = geo.name.trim().toLowerCase();
  const country = geo.country.trim().toLowerCase();
  const type = (geo.placeType ?? '').toLowerCase();
  return Boolean(
    (country && name === country) ||
      ['administrative', 'country', 'boundary'].includes(type),
  );
}

const COUNTRY_HOTEL_ANCHORS: Record<string, string[]> = {
  australia: ['Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia'],
  'new zealand': ['Auckland, New Zealand', 'Queenstown, New Zealand', 'Wellington, New Zealand'],
  india: ['New Delhi, India', 'Mumbai, India', 'Jaipur, India'],
  france: ['Paris, France', 'Nice, France', 'Lyon, France'],
  japan: ['Tokyo, Japan', 'Kyoto, Japan', 'Osaka, Japan'],
  indonesia: ['Bali, Indonesia', 'Jakarta, Indonesia', 'Ubud, Indonesia'],
  thailand: ['Bangkok, Thailand', 'Phuket, Thailand', 'Chiang Mai, Thailand'],
  italy: ['Rome, Italy', 'Venice, Italy', 'Florence, Italy'],
  spain: ['Barcelona, Spain', 'Madrid, Spain', 'Seville, Spain'],
  singapore: ['Singapore'],
  nepal: ['Kathmandu, Nepal', 'Pokhara, Nepal'],
};

async function knownCountryAnchorGeos(geo: GeoResult): Promise<GeoResult[]> {
  const key = (geo.country || geo.name).trim().toLowerCase();
  const anchors = COUNTRY_HOTEL_ANCHORS[key] ?? [];
  const results: GeoResult[] = [];
  for (const anchor of anchors) {
    const anchorGeo = await geocodeDestination(anchor);
    if (anchorGeo) results.push(anchorGeo);
    if (results.length >= 3) break;
  }
  return results;
}

function parsePopulation(tags: Record<string, string>): number {
  const raw = tags.population?.replace(/[^\d]/g, '');
  const population = raw ? Number(raw) : 0;
  return Number.isFinite(population) ? population : 0;
}

async function findCountryAnchorGeos(geo: GeoResult): Promise<GeoResult[]> {
  const countryCode = geo.countryCode?.trim().toUpperCase();
  const countryName = (geo.country || geo.name).trim();
  if (!countryCode && !countryName) return [];

  const areaSelector = countryCode
    ? `area["ISO3166-1"="${overpassString(countryCode)}"]`
    : `area["name"="${overpassString(countryName)}"]["boundary"="administrative"]`;
  const cityQuery = `
[out:json][timeout:8];
${areaSelector}->.searchArea;
node(area.searchArea)["place"="city"];
out body;
`;
  const townQuery = `
[out:json][timeout:8];
${areaSelector}->.searchArea;
node(area.searchArea)["place"="town"];
out body;
`;

  let elements = await overpassQuery(cityQuery);
  if (!elements.length) {
    elements = await overpassQuery(townQuery);
  }
  return elements
    .map((el): { score: number; geo: GeoResult } | null => {
      const tags = el.tags ?? {};
      const coord = elementCoord(el);
      const name = tags['name:en']?.trim() || tags.name?.trim();
      if (!coord || !name) return null;
      const population = parsePopulation(tags);
      const capitalBoost = tags.capital === 'yes'
        ? 50_000_000
        : tags.capital
          ? 5_000_000
          : 0;
      const cityBoost = tags.place === 'city' ? 1_000_000 : 0;
      const anchorGeo: GeoResult = {
        name,
        country: geo.country,
        countryCode: geo.countryCode,
        lat: coord.lat,
        lon: coord.lon,
        displayName: geo.country ? `${name}, ${geo.country}` : name,
        placeType: 'city',
        imageUrl: null,
      };
      return { score: population + capitalBoost + cityBoost, geo: anchorGeo };
    })
    .filter((item): item is { score: number; geo: GeoResult } => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.geo);
}

function isAccommodationElement(tags: Record<string, string>): boolean {
  if (tags.tourism && new RegExp(`^(${HOTEL_TOURISM_VALUES})$`).test(tags.tourism)) {
    return true;
  }
  return tags.building === 'hotel';
}

function namedHotelElements(
  elements: OsmElement[],
  geo: GeoResult,
  budgetInr?: number,
): OsmElement[] {
  return elements
    .filter((el) => {
      const tags = el.tags ?? {};
      const name = osmHotelName(tags);
      if (!name) return false;
      if (!isAccommodationElement(tags)) return false;
      if (tags.tourism === 'hostel' && !isLowBudgetHotels(budgetInr)) return false;
      if (tags.abandoned === 'yes' || tags.disused === 'yes') return false;
      return true;
    })
    .sort(
      (a, b) =>
        hotelQualityScore(b, geo, budgetInr) - hotelQualityScore(a, geo, budgetInr),
    )
    .slice(0, 16);
}

function boundedViewbox(geo: GeoResult, radiusKm: number): string {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm /
    (111 * Math.max(0.2, Math.cos((geo.lat * Math.PI) / 180)));
  return `${geo.lon - lonDelta},${geo.lat + latDelta},${geo.lon + lonDelta},${geo.lat - latDelta}`;
}

function hotelFallbackQueries(geo: GeoResult): string[] {
  const place = geo.name.trim();
  const country = geo.country.trim();
  const displayPlace = geo.displayName.split(',')[0]?.trim() ?? place;
  return [
    place ? `hotel ${place}` : '',
    displayPlace && displayPlace !== place ? `hotel ${displayPlace}` : '',
    country && country !== place ? `hotel ${country}` : '',
    'hotel',
    'guest house',
    'resort',
  ].filter((query, index, queries): query is string =>
    Boolean(query) && queries.indexOf(query) === index
  );
}

async function searchHotelsNominatimFallback(
  geo: GeoResult,
  options?: HotelSearchOptions,
): Promise<HotelOffer[]> {
  const offers: HotelOffer[] = [];
  const seen = new Set<string>();
  let hitCount = 0;
  const destinationImageUrl = geo.imageUrl ?? knownDestinationImageUrl([
    geo.displayName,
    geo.name,
    geo.country,
  ]);
  let imageSearches = 0;

  for (const query of hotelFallbackQueries(geo)) {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '12');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('viewbox', boundedViewbox(geo, 60));
    url.searchParams.set('bounded', '1');

    const res = await fetchWithTimeout(
      url.toString(),
      { headers: NOMINATIM_HEADERS },
      NOMINATIM_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.warn('[travel-apis] Nominatim hotel fallback failed', {
        searchedFrom: geo.displayName,
        query,
        status: res.status,
      });
      continue;
    }

    const hits = (await res.json()) as NominatimHit[];
    hitCount += hits.length;
    for (const [index, hit] of hits.entries()) {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!isValidLatLon(lat, lon)) continue;
      const name =
        hit.extratags?.name?.trim() ||
        hit.extratags?.brand?.trim() ||
        hit.display_name.split(',')[0]?.trim();
      if (!name || /^hotel\s*\d*$/i.test(name)) continue;
      const key = `${name.toLowerCase()}|${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const distanceKm = Math.round(haversineKm(geo.lat, geo.lon, lat, lon) * 10) / 10;
      const tags = hit.extratags ?? {};
      const stars = parseStars(tags);
      let imageUrl = osmImageFromTags(tags);
      if (!imageUrl && tags.wikidata) {
        imageUrl = await wikidataImageUrl(tags.wikidata);
      }
      if (!imageUrl && imageSearches < 2) {
        imageSearches += 1;
        imageUrl = await hotelImageFromSearch(name, geo);
      }
      const imageSource = imageUrl ? 'hotel' : destinationImageUrl ? 'destination' : null;
      offers.push({
        id: `nominatim/${lat.toFixed(6)},${lon.toFixed(6)}/${index}`,
        name,
        rating: stars,
        pricePerNightUsd: estimateHotelPriceInr(stars, options, null, {
          name,
          tourism: tags.tourism,
          distanceKm,
        }),
        imageUrl,
        source: 'osm' as const,
        raw: {
          source: 'nominatim-osm',
          address: hit.display_name,
          distanceKm,
          searchedFrom: geo.displayName,
          fallbackQuery: query,
          coord: { lat, lon },
          osm: { tags },
          destinationImageUrl,
          imageSource,
          priceSource: 'estimate',
          priceNote: 'Estimated nightly rate from property type, location, and trip budget - not a live booking price',
        },
      });
    }

    if (offers.length >= 8) break;
  }

  const sorted = offers
    .sort((a, b) => {
      const aDistance = Number(a.raw.distanceKm ?? 999);
      const bDistance = Number(b.raw.distanceKm ?? 999);
      return aDistance - bDistance;
    })
    .slice(0, 8);

  console.debug('[travel-apis] Nominatim hotel fallback response', {
    searchedFrom: geo.displayName,
    hitCount,
    hotelCount: sorted.length,
    sampleNames: sorted.slice(0, 5).map((offer) => offer.name),
  });
  return sorted;
}

/** Real hotels from OpenStreetMap — names, addresses, images; nightly INR is estimated when OSM has no rate. */
export async function searchHotelsOsm(
  geo: GeoResult,
  optionsOrBudget?: HotelSearchOptions | number,
): Promise<{ offers: HotelOffer[]; error?: string }> {
  const options = normalizeHotelSearchOptions(optionsOrBudget);
  const budgetInr = options.budgetInr;
  const geoapifyHotels = await searchHotelsGeoapify(geo, options);
  if (geoapifyHotels.length) {
    return { offers: geoapifyHotels };
  }

  let named: OsmElement[] = [];
  let hotelGeo = geo;
  let searchRadiusMeters: number = HOTEL_SEARCH_RADII_METERS[0];
  let destinationImageUrl = geo.imageUrl ?? knownDestinationImageUrl([
    geo.displayName,
    geo.name,
    geo.country,
  ]);

  const searchAround = async (candidateGeo: GeoResult) => {
    const finalRadius = HOTEL_SEARCH_RADII_METERS[HOTEL_SEARCH_RADII_METERS.length - 1];
    for (const radiusMeters of HOTEL_SEARCH_RADII_METERS) {
      const elements = await overpassQuery(hotelOverpassQuery(candidateGeo, radiusMeters), {
        failOnError: true,
      });
      const candidates = namedHotelElements(elements, candidateGeo, budgetInr);
      console.debug('[travel-apis] hotel API response', {
        searchedFrom: candidateGeo.displayName,
        lat: candidateGeo.lat,
        lon: candidateGeo.lon,
        radiusMeters,
        elementCount: elements.length,
        namedCandidateCount: candidates.length,
        sampleNames: candidates
          .slice(0, 5)
          .map((el) => osmHotelName(el.tags ?? {}))
          .filter(Boolean),
      });
      if (candidates.length || radiusMeters === finalRadius) {
        return { candidates, radiusMeters };
      }
    }
    return { candidates: [] as OsmElement[], radiusMeters: finalRadius };
  };

  try {
    const primary = await searchAround(geo);
    named = primary.candidates;
    searchRadiusMeters = primary.radiusMeters;

    if (!named.length && isBroadDestination(geo)) {
      const anchors = await knownCountryAnchorGeos(geo);
      if (!anchors.length) anchors.push(...(await findCountryAnchorGeos(geo)));
      for (const anchorGeo of anchors) {
        const anchored = await searchAround(anchorGeo);
        if (anchored.candidates.length) {
          named = anchored.candidates;
          hotelGeo = anchorGeo;
          searchRadiusMeters = anchored.radiusMeters;
          break;
        }
      }
    }
  } catch (e) {
    console.warn('[travel-apis] Overpass hotel search failed, trying Nominatim fallback', {
      searchedFrom: geo.displayName,
      error: e instanceof Error ? e.message : String(e),
    });
    const fallbackOffers = await searchHotelsNominatimFallback(geo, options);
    if (fallbackOffers.length) {
      return { offers: fallbackOffers };
    }
    if (liteApiHotelSearchEnabled()) {
      const liteApiHotels = await searchHotelsLiteApi(geo, options);
      if (liteApiHotels.length) return { offers: liteApiHotels };
    }
    return {
      offers: [],
      error: e instanceof Error ? e.message : 'OpenStreetMap hotel search failed.',
    };
  }

  if (!named.length) {
    const fallbackGeos = [hotelGeo];
    if (isBroadDestination(geo)) {
      const anchors = await knownCountryAnchorGeos(geo);
      if (!anchors.length) anchors.push(...(await findCountryAnchorGeos(geo)));
      fallbackGeos.push(...anchors);
    }
    for (const fallbackGeo of fallbackGeos) {
      const fallbackOffers = await searchHotelsNominatimFallback(fallbackGeo, options);
      if (fallbackOffers.length) {
        return { offers: fallbackOffers };
      }
    }
    if (liteApiHotelSearchEnabled()) {
      const liteApiHotels = await searchHotelsLiteApi(geo, options);
      if (liteApiHotels.length) return { offers: liteApiHotels };
    }
    console.warn('[travel-apis] no named hotels after all searches', {
      searchedFrom: hotelGeo.displayName,
      lat: hotelGeo.lat,
      lon: hotelGeo.lon,
      searchRadiusMeters,
      broadDestination: isBroadDestination(geo),
    });
    return {
      offers: [],
      error: 'No named hotels found in OpenStreetMap for this area.',
    };
  }

  const offers: HotelOffer[] = [];
  let wikidataFetches = 0;
  let imageSearches = 0;

  destinationImageUrl ??= hotelGeo.imageUrl ?? knownDestinationImageUrl([
    hotelGeo.displayName,
    hotelGeo.name,
    hotelGeo.country,
  ]);

  for (const el of named) {
    const tags = el.tags ?? {};
    const name = osmHotelName(tags)!;
    const stars = parseStars(tags);
    const coord = elementCoord(el);
    let imageUrl = osmImageFromTags(tags);
    if (!imageUrl && tags.wikidata && wikidataFetches < 6) {
      wikidataFetches += 1;
      imageUrl = await wikidataImageUrl(tags.wikidata);
    }

    const address =
      osmHotelAddress(tags) ??
      (coord
        ? `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`
        : hotelGeo.displayName);

    const osmFeeInr = parseOsmFeeInr(tags);
    const distanceKm = coord
      ? Math.round(haversineKm(hotelGeo.lat, hotelGeo.lon, coord.lat, coord.lon) * 10) / 10
      : null;
    if (!imageUrl && imageSearches < 3) {
      imageSearches += 1;
      imageUrl = await hotelImageFromSearch(name, hotelGeo);
    }
    const imageSource = imageUrl ? 'hotel' : destinationImageUrl ? 'destination' : null;
    const pricePerNight = estimateHotelPriceInr(stars, options, osmFeeInr, {
      name,
      tourism: tags.tourism,
      distanceKm,
    });

    offers.push({
      id: `${el.type}/${el.id}`,
      name,
      rating: stars,
      pricePerNightUsd: pricePerNight,
      imageUrl,
      source: 'osm',
      raw: {
        source: 'osm',
        address,
        website: tags.website ?? tags['contact:website'] ?? null,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        brand: tags.brand ?? null,
        tourism: tags.tourism ?? null,
        distanceKm,
        destinationImageUrl,
        imageSource,
        priceSource: osmFeeInr != null ? 'osm_fee' : 'estimate',
        priceNote: osmFeeInr != null
          ? 'Nightly rate from OpenStreetMap fee tag'
          : 'Estimated nightly rate from property type, location, and trip budget - not a live booking price',
        searchRadiusMeters,
        searchedFrom: hotelGeo.displayName,
        osm: { type: el.type, id: el.id, tags },
        coord,
      },
    });

    if (offers.length >= 8) break;
  }

  return { offers };
}

const RESTAURANT_AMENITIES = 'restaurant|cafe|fast_food|food_court|pub|bar';
const PLACE_TOURISM_VALUES = 'attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park';
const PLACE_SEARCH_RADII_METERS = [8000, 20000, 40000] as const;

function placeCategoryFromOsm(tags: Record<string, string>): 'restaurant' | 'place' | null {
  if (tags.amenity && new RegExp(`^(${RESTAURANT_AMENITIES})$`).test(tags.amenity)) {
    return 'restaurant';
  }
  if (tags.tourism && new RegExp(`^(${PLACE_TOURISM_VALUES})$`).test(tags.tourism)) {
    return 'place';
  }
  if (tags.historic || tags.leisure === 'park') return 'place';
  return null;
}

function osmPlaceName(tags: Record<string, string>): string | null {
  const name = tags.name?.trim() || tags['name:en']?.trim() || tags.brand?.trim();
  if (!name) return null;
  if (/^(restaurant|cafe|food|place|attraction)\s*\d*$/i.test(name)) return null;
  return name;
}

function osmPlaceAddress(tags: Record<string, string>): string | null {
  return osmHotelAddress(tags);
}

function placeOverpassQuery(geo: GeoResult, radiusMeters: number): string {
  return `
[out:json][timeout:8];
(
  node["amenity"~"${RESTAURANT_AMENITIES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  way["amenity"~"${RESTAURANT_AMENITIES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  relation["amenity"~"${RESTAURANT_AMENITIES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  node["tourism"~"${PLACE_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  way["tourism"~"${PLACE_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  relation["tourism"~"${PLACE_TOURISM_VALUES}"](around:${radiusMeters},${geo.lat},${geo.lon});
  node["historic"]["name"](around:${Math.min(radiusMeters, 20000)},${geo.lat},${geo.lon});
  way["historic"]["name"](around:${Math.min(radiusMeters, 20000)},${geo.lat},${geo.lon});
  node["leisure"="park"]["name"](around:${Math.min(radiusMeters, 20000)},${geo.lat},${geo.lon});
  way["leisure"="park"]["name"](around:${Math.min(radiusMeters, 20000)},${geo.lat},${geo.lon});
);
out body center 80;
`;
}

function placeQualityScore(place: PlaceOffer, geo: GeoResult): number {
  const distanceKm = Number(place.raw.distanceKm ?? haversineKm(geo.lat, geo.lon, place.latitude, place.longitude));
  let score = Math.max(0, 12 - distanceKm);
  if (place.category === 'restaurant') score += 2;
  if (place.website) score += 1;
  if (place.phone) score += 1;
  if (place.address) score += 1;
  return score;
}

async function searchPlacesGeoapify(
  geo: GeoResult,
  maxItems: number,
): Promise<PlaceOffer[]> {
  const key = geoapifyKey();
  if (!key) return [];

  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set(
    'categories',
    'catering.restaurant,catering.cafe,catering.fast_food,catering.pub,catering.bar,tourism.sights,entertainment.museum,entertainment.culture',
  );
  url.searchParams.set('filter', `circle:${geo.lon},${geo.lat},30000`);
  url.searchParams.set('bias', `proximity:${geo.lon},${geo.lat}`);
  url.searchParams.set('limit', String(Math.max(10, Math.min(maxItems * 3, 60))));
  url.searchParams.set('lang', 'en');
  url.searchParams.set('apiKey', key);

  try {
    const res = await fetchWithTimeout(url.toString(), {}, GEOAPIFY_TIMEOUT_MS);
    if (!res.ok) {
      console.warn('[travel-apis] Geoapify places search failed', {
        searchedFrom: geo.displayName,
        status: res.status,
      });
      return [];
    }
    const data = await res.json();
    const features = (Array.isArray(data?.features) ? data.features : []) as GeoapifyFeature[];
    return features
      .map((feature): PlaceOffer | null => {
        const props = feature.properties ?? {};
        const coord = geoapifyFeatureCoord(feature);
        const name = asString(props.name) || asString(props.address_line1);
        if (!coord || !name) return null;
        const categories = Array.isArray(props.categories) ? props.categories : [];
        const category = categories.some((item) => typeof item === 'string' && item.startsWith('catering.'))
          ? 'restaurant'
          : 'place';
        const address = asString(props.formatted) ||
          [asString(props.address_line1), asString(props.address_line2)].filter(Boolean).join(', ') ||
          null;
        const distanceKm = Math.round(haversineKm(geo.lat, geo.lon, coord.lat, coord.lon) * 10) / 10;
        return {
          id: `geoapify/${asString(props.place_id) || `${coord.lat.toFixed(6)},${coord.lon.toFixed(6)}`}`,
          name,
          category,
          address,
          latitude: coord.lat,
          longitude: coord.lon,
          cuisine: asString(props.cuisine) || null,
          website: asString(props.website) || null,
          phone: asString(props.contact_phone) || asString(props.phone) || null,
          source: 'geoapify',
          raw: {
            source: 'geoapify',
            provider: 'Geoapify Places',
            categories,
            distanceKm,
            rawPlace: props,
          },
        };
      })
      .filter((place): place is PlaceOffer => Boolean(place))
      .sort((a, b) => placeQualityScore(b, geo) - placeQualityScore(a, geo))
      .slice(0, maxItems);
  } catch (error) {
    console.warn('[travel-apis] Geoapify places search threw', {
      searchedFrom: geo.displayName,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function searchPlacesOsm(geo: GeoResult, maxItems: number): Promise<PlaceOffer[]> {
  for (const radiusMeters of PLACE_SEARCH_RADII_METERS) {
    const elements = await overpassQuery(placeOverpassQuery(geo, radiusMeters));
    const places = elements
      .map((el): PlaceOffer | null => {
        const tags = el.tags ?? {};
        const coord = elementCoord(el);
        const name = osmPlaceName(tags);
        const category = placeCategoryFromOsm(tags);
        if (!coord || !name || !category || !isValidLatLon(coord.lat, coord.lon)) return null;
        const distanceKm = Math.round(haversineKm(geo.lat, geo.lon, coord.lat, coord.lon) * 10) / 10;
        return {
          id: `osm/${el.type}/${el.id}`,
          name,
          category,
          address: osmPlaceAddress(tags),
          latitude: coord.lat,
          longitude: coord.lon,
          cuisine: tags.cuisine ?? null,
          website: tags.website ?? tags['contact:website'] ?? null,
          phone: tags.phone ?? tags['contact:phone'] ?? null,
          source: 'osm',
          raw: {
            source: 'osm',
            provider: 'OpenStreetMap Overpass',
            amenity: tags.amenity ?? null,
            tourism: tags.tourism ?? null,
            historic: tags.historic ?? null,
            leisure: tags.leisure ?? null,
            distanceKm,
            coord,
            osm: { type: el.type, id: el.id, tags },
          },
        };
      })
      .filter((place): place is PlaceOffer => Boolean(place))
      .sort((a, b) => placeQualityScore(b, geo) - placeQualityScore(a, geo));

    console.debug('[travel-apis] OSM places response', {
      searchedFrom: geo.displayName,
      radiusMeters,
      elementCount: elements.length,
      placeCount: places.length,
      sampleNames: places.slice(0, 5).map((place) => place.name),
    });
    if (places.length >= Math.min(6, maxItems) || radiusMeters === PLACE_SEARCH_RADII_METERS[PLACE_SEARCH_RADII_METERS.length - 1]) {
      return places.slice(0, maxItems);
    }
  }
  return [];
}

function placeFallbackQueries(): Array<{ query: string; category: 'restaurant' | 'place' }> {
  return [
    { query: 'restaurant', category: 'restaurant' },
    { query: 'cafe', category: 'restaurant' },
    { query: 'attraction', category: 'place' },
    { query: 'museum', category: 'place' },
  ];
}

async function searchPlacesNominatimFallback(
  geo: GeoResult,
  maxItems: number,
): Promise<PlaceOffer[]> {
  const offers: PlaceOffer[] = [];
  const seen = new Set<string>();
  for (const { query, category } of placeFallbackQueries()) {
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '10');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('viewbox', boundedViewbox(geo, 40));
    url.searchParams.set('bounded', '1');
    const res = await fetchWithTimeout(
      url.toString(),
      { headers: NOMINATIM_HEADERS },
      NOMINATIM_TIMEOUT_MS,
    );
    if (!res.ok) continue;
    const hits = (await res.json()) as NominatimHit[];
    for (const [index, hit] of hits.entries()) {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!isValidLatLon(lat, lon)) continue;
      const tags = hit.extratags ?? {};
      const name = tags.name?.trim() || tags.brand?.trim() || hit.display_name.split(',')[0]?.trim();
      if (!name) continue;
      const key = `${name.toLowerCase()}|${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push({
        id: `nominatim-place/${lat.toFixed(6)},${lon.toFixed(6)}/${index}`,
        name,
        category,
        address: hit.display_name,
        latitude: lat,
        longitude: lon,
        cuisine: tags.cuisine ?? null,
        website: tags.website ?? tags['contact:website'] ?? null,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        source: 'nominatim-osm',
        raw: {
          source: 'nominatim-osm',
          provider: 'Nominatim / OpenStreetMap',
          fallbackQuery: query,
          distanceKm: Math.round(haversineKm(geo.lat, geo.lon, lat, lon) * 10) / 10,
          coord: { lat, lon },
          osm: { tags },
        },
      });
      if (offers.length >= maxItems) return offers;
    }
  }
  return offers;
}

function dedupePlaces(places: PlaceOffer[], geo: GeoResult, maxItems: number): PlaceOffer[] {
  const seen = new Set<string>();
  return places
    .filter((place) => {
      const key = `${place.name.toLowerCase()}|${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => placeQualityScore(b, geo) - placeQualityScore(a, geo))
    .slice(0, maxItems);
}

export async function searchPlaces(
  geo: GeoResult,
  options: { maxItems?: number } = {},
): Promise<{ places: PlaceOffer[]; error?: string }> {
  const maxItems = Math.max(1, Math.min(options.maxItems ?? 12, 20));
  const errors: string[] = [];
  const geoapify = await searchPlacesGeoapify(geo, maxItems);
  let osm: PlaceOffer[] = [];
  if (geoapify.length < maxItems) {
    try {
      osm = await searchPlacesOsm(geo, maxItems);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'OpenStreetMap place search failed.');
    }
  }

  const combined = dedupePlaces([...geoapify, ...osm], geo, maxItems);
  if (combined.length >= Math.min(6, maxItems)) return { places: combined };

  let nominatim: PlaceOffer[] = [];
  try {
    nominatim = await searchPlacesNominatimFallback(geo, maxItems);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Nominatim place fallback failed.');
  }
  const withFallback = dedupePlaces([...combined, ...nominatim], geo, maxItems);
  return withFallback.length
    ? { places: withFallback }
    : {
      places: [],
      error: errors[0] ?? 'No real restaurants or places found from Geoapify, OpenStreetMap, or Nominatim for this area.',
    };
}

export function buildPlacesContext(places: PlaceOffer[]): string {
  if (!places.length) return '';
  const restaurants = places.filter((place) => place.category === 'restaurant').slice(0, 6);
  const attractions = places.filter((place) => place.category === 'place').slice(0, 6);
  const lines = ['[REAL RESTAURANT/PLACE DATA]'];
  if (restaurants.length) {
    lines.push(
      'Restaurants from real place APIs: ' +
        restaurants
          .map((place) =>
            `${place.name}${place.cuisine ? ` (${place.cuisine})` : ''} @ ${place.latitude.toFixed(5)},${place.longitude.toFixed(5)} [${place.source}]`
          )
          .join('; '),
    );
  }
  if (attractions.length) {
    lines.push(
      'Places/attractions from real place APIs: ' +
        attractions
          .map((place) => `${place.name} @ ${place.latitude.toFixed(5)},${place.longitude.toFixed(5)} [${place.source}]`)
          .join('; '),
    );
  }
  lines.push('Use these named restaurants/places when relevant. Do not replace them with invented restaurant names.');
  return lines.join('\n');
}

export type AirportPoint = {
  name: string;
  iata: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
};

export async function findAirportsNear(geo: GeoResult): Promise<AirportPoint[]> {
  const query = `
[out:json][timeout:8];
(
  node["aeroway"~"aerodrome|airport"]["iata"](around:120000,${geo.lat},${geo.lon});
  way["aeroway"~"aerodrome|airport"]["iata"](around:120000,${geo.lat},${geo.lon});
  node["aeroway"~"aerodrome|airport"](around:80000,${geo.lat},${geo.lon});
  way["aeroway"~"aerodrome|airport"](around:80000,${geo.lat},${geo.lon});
);
out center 12;
`;
  const elements = await overpassQuery(query);
  const airports: AirportPoint[] = [];

  for (const el of elements) {
    const coord = elementCoord(el);
    if (!coord) continue;
    const tags = el.tags ?? {};
    const name = tags.name ?? tags['name:en'];
    if (!name) continue;
    const iata = tags.iata?.trim().toUpperCase() ?? null;
    const distanceKm = haversineKm(geo.lat, geo.lon, coord.lat, coord.lon);
    airports.push({ name, iata, lat: coord.lat, lon: coord.lon, distanceKm });
  }

  airports.sort((a, b) => {
    const iataBoost = (a: AirportPoint) => (a.iata?.length === 3 ? 0 : 50);
    return a.distanceKm + iataBoost(a) - (b.distanceKm + iataBoost(b));
  });

  const seen = new Set<string>();
  const unique: AirportPoint[] = [];
  for (const ap of airports) {
    const key = ap.iata ?? ap.name;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ap);
    if (unique.length >= 4) break;
  }
  return unique;
}

const INDIA_DOMESTIC_AIRLINES = [
  'IndiGo',
  'Air India',
  'SpiceJet',
  'Akasa Air',
];

const INTERNATIONAL_AIRLINES = [
  'Emirates',
  'Singapore Airlines',
  'Qatar Airways',
  'Thai Airways',
  'AirAsia',
];

function normalizeCountryName(c: string): string {
  return c.trim().toLowerCase();
}

function suggestAirline(
  originCountry: string,
  destCountry: string,
  distanceKm: number,
  variant: number,
): string {
  const same =
    Boolean(originCountry && destCountry) &&
    normalizeCountryName(originCountry) === normalizeCountryName(destCountry);
  const india =
    normalizeCountryName(originCountry) === 'india' ||
    normalizeCountryName(destCountry) === 'india';

  if (same && india) {
    return INDIA_DOMESTIC_AIRLINES[variant % INDIA_DOMESTIC_AIRLINES.length];
  }
  if (distanceKm >= 2000) {
    return INTERNATIONAL_AIRLINES[variant % INTERNATIONAL_AIRLINES.length];
  }
  if (india) {
    return INDIA_DOMESTIC_AIRLINES[variant % INDIA_DOMESTIC_AIRLINES.length];
  }
  return INTERNATIONAL_AIRLINES[variant % INTERNATIONAL_AIRLINES.length];
}

function formatClock(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function estimateFlightTimes(distanceKm: number): {
  departTime: string;
  arriveTime: string;
  durationMin: number;
  stops: string;
} {
  const cruiseKmh = 780;
  const groundMin = 55;
  const flightMin = Math.round((distanceKm / cruiseKmh) * 60) + groundMin;
  const stops =
    distanceKm > 3500
      ? '1 stop (typical)'
      : distanceKm > 2000
        ? 'Non-stop or 1 stop'
        : 'Non-stop (typical)';

  const departMin = 7 * 60 + 15;
  const arriveMin = departMin + flightMin;
  const nextDay = arriveMin >= 24 * 60;
  const arriveLabel = nextDay
    ? `${formatClock(arriveMin)} (+1 day)`
    : formatClock(arriveMin);

  return {
    departTime: formatClock(departMin),
    arriveTime: arriveLabel,
    durationMin: flightMin,
    stops,
  };
}

function buildFlightOffer(params: {
  id: string;
  airline: string;
  route: string;
  originAirport: string;
  destAirport: string;
  originCode: string;
  destCode: string;
  distanceKm: number;
  departDate: string;
  priceInr: number;
  stops: string;
  departTime: string;
  arriveTime: string;
  durationMin: number;
}): FlightOffer {
  return {
    id: params.id,
    airline: params.airline,
    route: params.route,
    departTime: params.departTime,
    arriveTime: params.arriveTime,
    priceUsd: params.priceInr,
    stops: params.stops,
    source: 'estimate',
    raw: {
      originAirport: params.originAirport,
      destAirport: params.destAirport,
      originAirportCode: params.originCode,
      destAirportCode: params.destCode,
      distanceKm: params.distanceKm,
      durationMinutes: params.durationMin,
      departDate: params.departDate,
      note: 'Estimated fare from route distance — not a live booking price.',
    },
  };
}

/** Flight options with estimated fares (no paid flight API). */
export async function searchFlightsEstimate(params: {
  originGeo: GeoResult;
  destGeo: GeoResult;
  departDate: string;
  budgetInr?: number;
}): Promise<{ offers: FlightOffer[]; error?: string }> {
  const [originAirports, destAirports] = await Promise.all([
    findAirportsNear(params.originGeo),
    findAirportsNear(params.destGeo),
  ]);

  const cityDistanceKm = haversineKm(
    params.originGeo.lat,
    params.originGeo.lon,
    params.destGeo.lat,
    params.destGeo.lon,
  );

  const origin = originAirports[0];
  const dest = destAirports[0];
  const distanceKm = origin && dest
    ? haversineKm(origin.lat, origin.lon, dest.lat, dest.lon)
    : cityDistanceKm;

  const basePrice = estimateFlightPriceInr(distanceKm);
  const priceCap = params.budgetInr
    ? Math.min(basePrice, Math.round(params.budgetInr * 0.4))
    : basePrice;

  const originCode = origin?.iata ??
    params.originGeo.name.slice(0, 3).toUpperCase();
  const destCode = dest?.iata ?? params.destGeo.name.slice(0, 3).toUpperCase();
  const originAirportName = origin?.name ?? `${params.originGeo.name} area`;
  const destAirportName = dest?.name ?? `${params.destGeo.name} area`;

  const schedule = estimateFlightTimes(distanceKm);
  const airlineA = suggestAirline(
    params.originGeo.country,
    params.destGeo.country,
    distanceKm,
    0,
  );
  const airlineB = suggestAirline(
    params.originGeo.country,
    params.destGeo.country,
    distanceKm,
    1,
  );

  const evening = estimateFlightTimes(distanceKm);
  evening.departTime = '13:40';
  const eveningDepartMin = 13 * 60 + 40;
  const eveningArriveMin = eveningDepartMin + evening.durationMin;
  evening.arriveTime =
    eveningArriveMin >= 24 * 60
      ? `${formatClock(eveningArriveMin)} (+1 day)`
      : formatClock(eveningArriveMin);

  const offers: FlightOffer[] = [
    buildFlightOffer({
      id: `est-${originCode}-${destCode}`,
      airline: airlineA,
      route: `${params.originGeo.name} (${originCode}) → ${params.destGeo.name} (${destCode})`,
      originAirport: originAirportName,
      destAirport: destAirportName,
      originCode,
      destCode,
      distanceKm: Math.round(distanceKm),
      departDate: params.departDate,
      priceInr: priceCap,
      stops: schedule.stops,
      departTime: schedule.departTime,
      arriveTime: schedule.arriveTime,
      durationMin: schedule.durationMin,
    }),
    buildFlightOffer({
      id: `est-${originCode}-${destCode}-alt`,
      airline: airlineB,
      route: `${params.originGeo.name} (${originCode}) → ${params.destGeo.name} (${destCode})`,
      originAirport: originAirportName,
      destAirport: destAirportName,
      originCode,
      destCode,
      distanceKm: Math.round(distanceKm),
      departDate: params.departDate,
      priceInr: Math.round(priceCap * 0.88),
      stops: evening.stops,
      departTime: evening.departTime,
      arriveTime: evening.arriveTime,
      durationMin: evening.durationMin,
    }),
  ];

  if (!originAirports.length || !destAirports.length) {
    offers[0].raw.note =
      'Estimated city-to-city fare — no IATA airport tagged in OSM near this location.';
  }

  return { offers };
}

/** Build travel context string for the LLM from live APIs. */
export async function buildTravelContext(input: {
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  budgetInr?: number;
  travelers?: number;
  includeHotels?: boolean;
  includePlaces?: boolean;
  includeFlightOffers?: boolean;
  includeTrainOffers?: boolean;
  includeBusOffers?: boolean;
  maxPlaces?: number;
  maxHotels?: number;
  weatherDays?: number;
}): Promise<string> {
  const cacheKey = travelContextCacheKey(input);
  const cached = getCachedTravelContext(cacheKey);
  if (cached !== undefined) return cached;

  const parts: string[] = [];
  const dest = input.destination?.trim();
  if (!dest) return '';
  const includeHotels = input.includeHotels ?? true;
  const includePlaces = input.includePlaces ?? true;
  const includeFlightOffers = input.includeFlightOffers ?? true;
  const includeTrainOffers = input.includeTrainOffers ?? true;
  const includeBusOffers = input.includeBusOffers ?? true;

  const geo = await geocodeDestination(dest);
  if (geo) {
    parts.push(
      `Destination (Nominatim/OSM): ${geo.displayName} (${geo.lat}, ${geo.lon}), country: ${geo.country}.`,
    );
    const weather = await fetchWeather(geo.lat, geo.lon);
    if (weather) {
      parts.push(`Weather (Open-Meteo): ${weather.summary}`);
      const weatherSampleDays = Math.min(input.weatherDays ?? 3, weather.daily.length);
      const sample = weather.daily.slice(0, weatherSampleDays).map(
        (d) =>
          `${d.date}: ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)}°C, rain ${d.precipitationMm}mm`,
      );
      parts.push(`Daily sample: ${sample.join('; ')}`);
    }

    if (includeHotels) {
      const hotels = await searchHotelsOsm(geo, {
        budgetInr: input.budgetInr,
        tripDays: tripDaysFromDates(input.startDate, input.endDate),
        travelers: input.travelers,
      });
      const hotelSlice = hotels.offers.slice(0, input.maxHotels ?? 5);
      if (hotelSlice.length) {
        parts.push(
          'Hotels (estimate INR/night): ' +
            hotelSlice
              .map(
                (h) =>
                  `${h.name}${h.rating ? ` ★${h.rating}` : ''} ~${h.pricePerNightUsd != null ? formatInr(h.pricePerNightUsd) : '?'}`,
              )
              .join('; '),
        );
      } else if (hotels.error) {
        parts.push(`Hotels note: ${hotels.error}`);
      }
    }

    if (includePlaces) {
      const places = await searchPlaces(geo, { maxItems: input.maxPlaces ?? 8 });
      if (places.places.length) {
        parts.push(buildPlacesContext(places.places));
      } else if (places.error) {
        parts.push(`[REAL RESTAURANT/PLACE DATA]\nNo real restaurant/place data available: ${places.error}`);
      }
    }

    if (input.origin) {
      const originGeo = await geocodeDestination(input.origin);
      if (originGeo) {
        const days = tripDaysFromDates(input.startDate, input.endDate);
        const route = analyzeRoute({
          originGeo,
          destGeo: geo,
          budgetInr: input.budgetInr,
          travelers: input.travelers,
          tripDays: days,
        });
        parts.push(buildTransportGuidanceBlock(route));
        parts.push(
          groundTransportEstimates(route.distanceKm, input.travelers ?? 1),
        );

        if (includeTrainOffers && route.sameCountry) {
          const trains = await searchIndianTrains({
            originName: input.origin,
            destinationName: dest,
            originGeo,
            destGeo: geo,
            maxItems: 6,
          });
          parts.push(
            buildIndianRailContext(
              trains,
              estimateTrainPriceInr(route.distanceKm, input.travelers ?? 1),
            ),
          );
        }

        if (includeBusOffers && route.recommendedModes.includes('bus')) {
          const buses = await searchBusOptions({
            originName: input.origin,
            destinationName: dest,
            originGeo,
            destGeo: geo,
            departDate: input.startDate,
            travelers: input.travelers,
            maxItems: 5,
          });
          parts.push(
            buildBusContext(
              buses,
              estimateBusPriceInr(route.distanceKm, input.travelers ?? 1),
            ),
          );
        }

        const includeFlights = shouldIncludeFlights(route);

        if (includeFlights) {
          if (includeFlightOffers && input.startDate) {
            const duffelToken = Deno.env.get('DUFFEL_ACCESS_TOKEN') ??
              Deno.env.get('DUFFEL_API_KEY');
            if (duffelToken?.trim()) {
              const { searchFlightsDuffel } = await import('./duffel-api.ts');
              const flights = await searchFlightsDuffel({
                originGeo,
                destGeo: geo,
                departDate: input.startDate,
                travelers: input.travelers,
                accessToken: duffelToken,
              });
              if (flights.offers.length) {
                parts.push(
                  'Flights (live Duffel offers — prices at search time, not guaranteed until booking): ' +
                    flights.offers
                      .map((f) => {
                        const amount = f.raw.priceAmount;
                        const currency = f.raw.priceCurrency;
                        const price =
                          typeof amount === 'number' && currency
                            ? `${currency} ${amount}`
                            : f.priceUsd != null
                              ? formatInr(f.priceUsd)
                              : '?';
                        return `${f.airline} ${f.route} ${f.departTime}-${f.arriveTime} ${price} (${f.stops})`;
                      })
                      .join('; '),
                );
              } else if (flights.error) {
                parts.push(`Flights note (Duffel): ${flights.error}`);
              } else {
                parts.push(
                  'Flights: No live Duffel offers returned for this route/date. Do not invent airline names, flight numbers, or fares.',
                );
              }
            } else {
              parts.push(
                'Flights: Live flight fares are not configured (Duffel API key missing). Do not quote specific airline fares, flight numbers, or booking prices — only generic guidance that flights may apply on this route.',
              );
            }
          } else {
            parts.push(
              'Flights: Route analysis says flights may be appropriate. Do not invent specific fares or flight numbers; exact live options require a start date and Duffel search.',
            );
          }
        } else {
          parts.push(
            'Flights: Not recommended for this route/budget — plan train/bus/ferry instead. Set Flights budget line to ₹0 unless a mandatory short-hop flight exists.',
          );
        }
      }
    }
  }

  if (input.budgetInr) {
    parts.push(`Budget cap: ${formatInr(input.budgetInr)} INR.`);
  }
  if (input.travelers) parts.push(`Travelers: ${input.travelers}.`);

  const result = parts.join('\n');
  if (result) setCachedTravelContext(cacheKey, result);
  return result;
}
