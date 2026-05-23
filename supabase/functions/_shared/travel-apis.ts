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
  lat: number;
  lon: number;
  displayName: string;
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
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const NOMINATIM_HEADERS = {
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
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
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
  if (opts?.featureType) {
    url.searchParams.set('featuretype', opts.featureType);
  }

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return [];
  return (await res.json()) as NominatimHit[];
}

function hitToGeo(hit: NominatimHit, fallbackQuery: string): GeoResult {
  const name =
    hit.address?.city ??
    hit.address?.town ??
    hit.address?.village ??
    fallbackQuery.split(',')[0]?.trim() ??
    fallbackQuery;
  return {
    name,
    country: hit.address?.country ?? '',
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
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
  return hitToGeo(hit, q);
}

/** Use saved trip coordinates when geocoding drifts from the user's destination label. */
export function geoFromCoordinates(
  lat: number,
  lon: number,
  label: string,
  country = '',
): GeoResult {
  return {
    name: label.split(',')[0]?.trim() || label,
    country,
    lat,
    lon,
    displayName: label,
  };
}

/** Geocode a place name near a destination (for itinerary pins). */
export async function geocodeNearDestination(
  placeName: string,
  near: GeoResult,
): Promise<{ lat: number; lon: number } | null> {
  const q = `${placeName}, ${near.name}`;
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  const hit = data[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lon: Number(hit.lon) };
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

  const res = await fetch(url.toString());
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

async function overpassQuery(query: string): Promise<OsmElement[]> {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.elements ?? []) as OsmElement[];
}

function elementCoord(el: OsmElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function osmHotelName(tags: Record<string, string>): string | null {
  const name =
    tags.name?.trim() ??
    tags['name:en']?.trim() ??
    tags['official_name']?.trim() ??
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
  if (commons) return commonsFileUrl(commons);
  return null;
}

async function wikidataImageUrl(wikidataTag: string): Promise<string | null> {
  const qid = wikidataTag
    .replace(/^https?:\/\/(www\.)?wikidata\.org\/wiki\//i, '')
    .trim();
  if (!/^Q\d+$/i.test(qid)) return null;
  try {
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { headers: { 'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge)' } },
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
  if (tags.tourism === 'hotel' || tags.tourism === 'motel') score += 3;
  if (tags.tourism === 'guest_house') score += 1;
  if (tags.tourism === 'hostel' && !isLowBudgetHotels(budgetInr)) score -= 6;

  const coord = elementCoord(el);
  if (coord) {
    const km = haversineKm(geo.lat, geo.lon, coord.lat, coord.lon);
    score += Math.max(0, 8 - km / 2);
  }
  return score;
}

/** Real hotels from OpenStreetMap — names, addresses, images; nightly INR is estimated when OSM has no rate. */
export async function searchHotelsOsm(
  geo: GeoResult,
  budgetInr?: number,
): Promise<{ offers: HotelOffer[]; error?: string }> {
  const query = `
[out:json][timeout:25];
(
  node["tourism"~"hotel|motel|guest_house|hostel"](around:12000,${geo.lat},${geo.lon});
  way["tourism"~"hotel|motel|guest_house"](around:12000,${geo.lat},${geo.lon});
);
out tags center 24;
`;
  const elements = await overpassQuery(query);
  const named = elements
    .filter((el) => {
      const tags = el.tags ?? {};
      const name = osmHotelName(tags);
      if (!name) return false;
      if (tags.tourism === 'hostel' && !isLowBudgetHotels(budgetInr)) return false;
      if (tags.abandoned === 'yes' || tags.disused === 'yes') return false;
      return true;
    })
    .sort(
      (a, b) =>
        hotelQualityScore(b, geo, budgetInr) - hotelQualityScore(a, geo, budgetInr),
    )
    .slice(0, 16);

  if (!named.length) {
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
        : geo.displayName);

    const osmFeeInr = parseOsmFeeInr(tags);
    const pricePerNight = estimateHotelPriceInr(stars, budgetInr, osmFeeInr);
    const distanceKm = coord
      ? Math.round(haversineKm(geo.lat, geo.lon, coord.lat, coord.lon) * 10) / 10
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
[out:json][timeout:25];
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
}): Promise<string> {
  const parts: string[] = [];
  const dest = input.destination?.trim();
  if (!dest) return '';

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
