/** Geocoding, weather, hotels, and flights using free/public APIs (no API keys). */

import { formatInr } from './currency.ts';
import {
  analyzeRoute,
  buildTransportGuidanceBlock,
  estimateFlightPriceInr,
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
  /** osm = named place from OSM; estimate = nightly INR heuristic when OSM has no rate */
  source: 'osm' | 'estimate';
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
  source: 'estimate' | 'osm';
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

const NOMINATIM_HEADERS = {
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
};

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
};

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

function estimateHotelPriceInr(
  stars: number | null,
  budgetInr?: number,
  osmFeeInr?: number | null,
): number | null {
  if (osmFeeInr != null) return osmFeeInr;
  if (budgetInr && budgetInr > 0) {
    const nightly = Math.round(budgetInr / 7 / 2);
    return Math.max(800, Math.min(nightly, 12000));
  }
  if (stars && stars >= 4) return 5500;
  if (stars && stars >= 3) return 3500;
  return 2200;
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
  return null;
}

function hitToGeo(hit: NominatimHit, fallbackQuery: string): GeoResult {
  const cityName =
    hit.address?.city ??
    hit.address?.town ??
    hit.address?.village;
  const name =
    cityName ??
    hit.address?.state ??
    fallbackQuery.split(',')[0]?.trim() ??
    fallbackQuery;
  return {
    name,
    country: hit.address?.country ?? '',
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
  const place =
    hit.address?.city ??
    hit.address?.town ??
    hit.address?.village ??
    hit.display_name.split(',')[0]?.trim();
  if (!place) return null;

  const state = hit.address?.state?.trim() ?? '';
  const country = hit.address?.country?.trim() ?? '';
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
    .map((el) => {
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
      return {
        score: population + capitalBoost + cityBoost,
        geo: {
          name,
          country: geo.country,
          countryCode: geo.countryCode,
          lat: coord.lat,
          lon: coord.lon,
          displayName: geo.country ? `${name}, ${geo.country}` : name,
          placeType: 'city',
          imageUrl: null,
        } satisfies GeoResult,
      };
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
  budgetInr?: number,
): Promise<HotelOffer[]> {
  const offers: HotelOffer[] = [];
  const seen = new Set<string>();
  let hitCount = 0;

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
      offers.push({
        id: `nominatim/${lat.toFixed(6)},${lon.toFixed(6)}/${index}`,
        name,
        rating: stars,
        pricePerNightUsd: estimateHotelPriceInr(stars, budgetInr),
        imageUrl: osmImageFromTags(tags),
        source: 'osm' as const,
        raw: {
          source: 'nominatim-osm',
          address: hit.display_name,
          distanceKm,
          searchedFrom: geo.displayName,
          fallbackQuery: query,
          coord: { lat, lon },
          osm: { tags },
          priceSource: 'estimate',
          priceNote: 'Estimated nightly rate — OSM has no live room prices for this property',
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
  budgetInr?: number,
): Promise<{ offers: HotelOffer[]; error?: string }> {
  let named: OsmElement[] = [];
  let hotelGeo = geo;
  let searchRadiusMeters = HOTEL_SEARCH_RADII_METERS[0];

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
    const fallbackOffers = await searchHotelsNominatimFallback(geo, budgetInr);
    if (fallbackOffers.length) {
      return { offers: fallbackOffers };
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
      const fallbackOffers = await searchHotelsNominatimFallback(fallbackGeo, budgetInr);
      if (fallbackOffers.length) {
        return { offers: fallbackOffers };
      }
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
    const pricePerNight = estimateHotelPriceInr(stars, budgetInr, osmFeeInr);
    const distanceKm = coord
      ? Math.round(haversineKm(hotelGeo.lat, hotelGeo.lon, coord.lat, coord.lon) * 10) / 10
      : null;

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
        priceSource: osmFeeInr != null ? 'osm_fee' : 'estimate',
        priceNote: osmFeeInr != null
          ? 'Nightly rate from OpenStreetMap fee tag'
          : 'Estimated nightly rate — OSM has no live room prices for this property',
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

type AirportPoint = {
  name: string;
  iata: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
};

async function findAirportsNear(geo: GeoResult): Promise<AirportPoint[]> {
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
  includeFlightOffers?: boolean;
}): Promise<string> {
  const parts: string[] = [];
  const dest = input.destination?.trim();
  if (!dest) return '';
  const includeHotels = input.includeHotels ?? true;
  const includeFlightOffers = input.includeFlightOffers ?? true;

  const geo = await geocodeDestination(dest);
  if (geo) {
    parts.push(
      `Destination (Nominatim/OSM): ${geo.displayName} (${geo.lat}, ${geo.lon}), country: ${geo.country}.`,
    );
    const weather = await fetchWeather(geo.lat, geo.lon);
    if (weather) {
      parts.push(`Weather (Open-Meteo): ${weather.summary}`);
      const sample = weather.daily.slice(0, 3).map(
        (d) =>
          `${d.date}: ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)}°C, rain ${d.precipitationMm}mm`,
      );
      parts.push(`Daily sample: ${sample.join('; ')}`);
    }

    if (includeHotels) {
      const hotels = await searchHotelsOsm(geo, input.budgetInr);
      if (hotels.offers.length) {
        parts.push(
          'Hotels (OpenStreetMap — real names/addresses; nightly INR estimated): ' +
            hotels.offers
              .map(
                (h) =>
                  `${h.name}${h.rating ? ` ★${h.rating}` : ''} ~${h.pricePerNightUsd != null ? formatInr(h.pricePerNightUsd) : '?'}/night (estimate)`,
              )
              .join('; '),
        );
      } else if (hotels.error) {
        parts.push(`Hotels note: ${hotels.error}`);
      }
    }

    if (input.origin && input.startDate) {
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

        const includeFlights = shouldIncludeFlights(route);

        if (includeFlights) {
          if (includeFlightOffers) {
            const flights = await searchFlightsEstimate({
              originGeo,
              destGeo: geo,
              departDate: input.startDate,
              budgetInr: input.budgetInr,
            });
            if (flights.offers.length) {
              parts.push(
                'Flights (estimated fares in INR, not live bookings): ' +
                  flights.offers
                    .map(
                      (f) =>
                        `${f.airline} ${f.route} ${f.departTime}-${f.arriveTime} ~${f.priceUsd != null ? formatInr(f.priceUsd) : '?'} (${f.stops})`,
                    )
                    .join('; '),
              );
            } else if (flights.error) {
              parts.push(`Flights note: ${flights.error}`);
            }
          } else {
            parts.push(
              'Flights: Route analysis says flights may be appropriate; use realistic INR estimates and keep details concise.',
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

  return parts.join('\n');
}
