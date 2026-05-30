/** Bus transport enrichment with real provider data where available and explicit fallbacks. */

import { formatInr } from './currency.ts';
import { estimateBusPriceInr } from './transport-guidance.ts';

type EnvGlobal = typeof globalThis & {
  Deno?: {
    env?: {
      get(name: string): string | undefined;
    };
  };
};

export type BusGeo = {
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lon: number;
  displayName: string;
};

export type BusOffer = {
  id: string;
  operator: string | null;
  routeName: string;
  route: string;
  departTime: string | null;
  arriveTime: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  fareInr: number | null;
  source: 'transitland' | 'osm';
  raw: Record<string, unknown>;
};

export type BusSearchResult = {
  offers: BusOffer[];
  live: boolean;
  source: 'transitland' | 'osm' | 'fallback';
  error?: string;
  note?: string;
};

type OsmElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const TRANSITLAND_ROUTING_URL = 'https://transit.land/api/v2/routing/otp/plan';
const TRANSITLAND_TIMEOUT_MS = 9_000;
const OVERPASS_TIMEOUT_MS = 8_000;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const;

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge; educational)',
};

function env(name: string): string | undefined {
  return (globalThis as EnvGlobal).Deno?.env?.get(name);
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameCountry(a: BusGeo, b: BusGeo): boolean {
  const codeA = (a.countryCode ?? '').trim().toUpperCase();
  const codeB = (b.countryCode ?? '').trim().toUpperCase();
  if (codeA && codeB) return codeA === codeB;
  return Boolean(a.country && b.country && normalize(a.country) === normalize(b.country));
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

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

function timeFromEpoch(value: unknown): string | null {
  const millis = asNumber(value);
  if (millis == null || millis <= 0) return null;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatClock(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function estimateBusSchedule(distanceKm: number): {
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
} {
  const cruiseKmh = distanceKm <= 80 ? 22 : distanceKm <= 300 ? 45 : 55;
  const bufferMinutes = distanceKm <= 80 ? 25 : 55;
  const durationMinutes = Math.max(25, Math.round((distanceKm / cruiseKmh) * 60) + bufferMinutes);
  const departMinutes = 8 * 60;
  const arriveMinutes = departMinutes + durationMinutes;
  const nextDay = arriveMinutes >= 24 * 60;
  return {
    departTime: formatClock(departMinutes),
    arriveTime: nextDay ? `${formatClock(arriveMinutes)} (+1 day)` : formatClock(arriveMinutes),
    durationMinutes,
  };
}

function durationLabel(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fareEstimate(distanceKm: number, travelers: number): number {
  return estimateBusPriceInr(distanceKm, travelers);
}

function transitlandApiKey(): string | undefined {
  return env('TRANSITLAND_API_KEY') ?? env('TRANSITLAND_APIKEY');
}

function transitlandLegMode(leg: Record<string, unknown>): string {
  return asString(leg.mode).toUpperCase();
}

function transitlandLegLabel(leg: Record<string, unknown>): string {
  const routeShort = asString(leg.routeShortName);
  const routeLong = asString(leg.routeLongName);
  const route = asString(leg.route);
  const headsign = asString(leg.headsign);
  const base = routeShort || routeLong || route || 'Bus';
  return headsign ? `${base} to ${headsign}` : base;
}

function transitlandStopName(value: unknown): string {
  const record = asRecord(value);
  return record ? asString(record.name) : '';
}

function mapTransitlandItinerary(
  raw: unknown,
  index: number,
  travelers: number,
): BusOffer | null {
  const itinerary = asRecord(raw);
  if (!itinerary) return null;
  const legs = Array.isArray(itinerary.legs) ? itinerary.legs : [];
  const busLegs = legs
    .map(asRecord)
    .filter((leg): leg is Record<string, unknown> => {
      if (!leg) return false;
      const mode = transitlandLegMode(leg);
      return mode === 'BUS' || mode === 'COACH';
    });
  if (!busLegs.length) return null;

  const firstBus = busLegs[0];
  const lastBus = busLegs[busLegs.length - 1] ?? firstBus;
  const totalDistanceKm =
    (asNumber(itinerary.transitDistance) ?? asNumber(itinerary.distance) ?? 0) / 1000;
  const distanceKm = totalDistanceKm > 0 ? Math.round(totalDistanceKm * 10) / 10 : null;
  const durationSeconds = asNumber(itinerary.duration);
  const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : null;
  const operators = busLegs
    .map((leg) => asString(leg.agencyName))
    .filter(Boolean);
  const routeNames = busLegs.map(transitlandLegLabel).filter(Boolean);
  const fromName = transitlandStopName(firstBus.from);
  const toName = transitlandStopName(lastBus.to);
  const route = `${fromName || 'Origin'} → ${toName || 'Destination'}`;
  const uniqueOperators = [...new Set(operators)];
  const uniqueRoutes = [...new Set(routeNames)];

  return {
    id: `transitland-${index}`,
    operator: uniqueOperators.length ? uniqueOperators.join(' + ') : null,
    routeName: uniqueRoutes.join(' + ') || 'Bus route',
    route,
    departTime: timeFromEpoch(itinerary.startTime) ?? timeFromEpoch(firstBus.startTime),
    arriveTime: timeFromEpoch(itinerary.endTime) ?? timeFromEpoch(lastBus.endTime),
    durationMinutes,
    distanceKm,
    fareInr: distanceKm ? fareEstimate(distanceKm, travelers) : null,
    source: 'transitland',
    raw: {
      provider: 'Transitland Routing API',
      note: 'GTFS-based route and timing. Fare is estimated because Transitland routing does not return booking prices.',
      itinerary,
    },
  };
}

async function searchTransitlandBusOptions(params: {
  originGeo: BusGeo;
  destGeo: BusGeo;
  departDate: string;
  travelers: number;
  maxItems: number;
}): Promise<BusSearchResult> {
  const key = transitlandApiKey();
  if (!key) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      error: 'TRANSITLAND_API_KEY is not configured.',
      note: 'Set a Transitland key to enable GTFS-based bus routes and scheduled times where coverage exists.',
    };
  }

  const url = new URL(TRANSITLAND_ROUTING_URL);
  url.searchParams.set('fromPlace', `${params.originGeo.lat},${params.originGeo.lon}`);
  url.searchParams.set('toPlace', `${params.destGeo.lat},${params.destGeo.lon}`);
  url.searchParams.set('date', params.departDate);
  url.searchParams.set('time', '08:00:00');
  url.searchParams.set('maxItineraries', String(Math.max(1, Math.min(params.maxItems, 5))));
  url.searchParams.set('maxWalkingDistance', '2500');
  url.searchParams.set('maxTripTime', '43200');
  url.searchParams.set('useFallbackDates', 'true');
  url.searchParams.set('api_key', key);

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { 'apikey': key, 'User-Agent': 'TravelAgentPlatform/1.0 (supabase-edge)' } },
      TRANSITLAND_TIMEOUT_MS,
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = asString(asRecord(data)?.error) ||
        asString(asRecord(data)?.message) ||
        `Transitland bus routing failed (${response.status}).`;
      return { offers: [], live: false, source: 'fallback', error: message };
    }

    const plan = asRecord(data)?.plan;
    const itineraries = asRecord(plan)?.itineraries;
    const offers = (Array.isArray(itineraries) ? itineraries : [])
      .map((itinerary, index) => mapTransitlandItinerary(itinerary, index, params.travelers))
      .filter((offer): offer is BusOffer => offer != null)
      .slice(0, params.maxItems);

    return {
      offers,
      live: offers.length > 0,
      source: offers.length ? 'transitland' : 'fallback',
      error: offers.length ? undefined : 'Transitland returned no bus itineraries for this route/date.',
      note: 'Transitland Routing coverage is strongest in supported GTFS regions; OSM route data is used next when no itinerary is returned.',
    };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Transitland bus routing timed out.'
        : error instanceof Error
          ? error.message
          : 'Transitland bus routing failed.';
    return { offers: [], live: false, source: 'fallback', error: message };
  }
}

async function overpassQuery(query: string): Promise<OsmElement[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: OVERPASS_HEADERS,
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_TIMEOUT_MS,
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        lastError = new Error(
          `OpenStreetMap bus search failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ''}.`,
        );
        continue;
      }
      const json = await response.json();
      return (json.elements ?? []) as OsmElement[];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('OpenStreetMap bus search failed.');
    }
  }

  if (lastError) throw lastError;
  return [];
}

function busOverpassQuery(geo: BusGeo, radiusMeters: number): string {
  return `
[out:json][timeout:8];
(
  relation["type"="route"]["route"="bus"](around:${radiusMeters},${geo.lat},${geo.lon});
  relation["type"="route_master"]["route_master"="bus"](around:${radiusMeters},${geo.lat},${geo.lon});
  node["amenity"="bus_station"](around:${Math.min(radiusMeters, 25000)},${geo.lat},${geo.lon});
  way["amenity"="bus_station"](around:${Math.min(radiusMeters, 25000)},${geo.lat},${geo.lon});
  relation["amenity"="bus_station"](around:${Math.min(radiusMeters, 25000)},${geo.lat},${geo.lon});
  node["highway"="bus_stop"](around:${Math.min(radiusMeters, 12000)},${geo.lat},${geo.lon});
);
out center tags 80;
`;
}

function routeKey(tags: Record<string, string>): string {
  return normalize([
    tags.ref,
    tags.name ?? tags['name:en'],
    tags.operator,
    tags.network,
    tags.from,
    tags.to,
  ].filter(Boolean).join(' '));
}

function routeName(tags: Record<string, string>): string {
  return tags.ref?.trim() ||
    tags.name?.trim() ||
    tags['name:en']?.trim() ||
    tags.network?.trim() ||
    'Bus route';
}

function operatorName(tags: Record<string, string>): string | null {
  return tags.operator?.trim() ||
    tags.network?.trim() ||
    tags.brand?.trim() ||
    null;
}

function terminalName(geo: BusGeo, station: OsmElement | null): string {
  const name = station?.tags?.name ?? station?.tags?.['name:en'];
  return name?.trim() || `${geo.name} bus area`;
}

function pickBusStations(elements: OsmElement[]): OsmElement[] {
  return elements.filter((el) => {
    const tags = el.tags ?? {};
    return tags.amenity === 'bus_station' && Boolean(tags.name || tags['name:en']);
  });
}

function pickBusRoutes(elements: OsmElement[]): OsmElement[] {
  return elements.filter((el) => {
    const tags = el.tags ?? {};
    return (
      (tags.type === 'route' && tags.route === 'bus') ||
      (tags.type === 'route_master' && tags.route_master === 'bus')
    ) && Boolean(routeKey(tags));
  });
}

function mapOsmRouteToOffer(params: {
  route: OsmElement;
  originGeo: BusGeo;
  destGeo: BusGeo;
  originStation: OsmElement | null;
  destStation: OsmElement | null;
  distanceKm: number;
  travelers: number;
  index: number;
  matchType: 'direct-route' | 'origin-network';
}): BusOffer {
  const tags = params.route.tags ?? {};
  const schedule = estimateBusSchedule(params.distanceKm);
  const fromName = tags.from?.trim() || terminalName(params.originGeo, params.originStation);
  const toName = tags.to?.trim() || terminalName(params.destGeo, params.destStation);
  const name = routeName(tags);
  const operator = operatorName(tags);
  const fare = fareEstimate(params.distanceKm, params.travelers);

  return {
    id: `osm-${params.route.type}-${params.route.id}-${params.index}`,
    operator,
    routeName: name,
    route: `${fromName} → ${toName}`,
    departTime: schedule.departTime,
    arriveTime: schedule.arriveTime,
    durationMinutes: schedule.durationMinutes,
    distanceKm: Math.round(params.distanceKm),
    fareInr: fare,
    source: 'osm',
    raw: {
      provider: 'OpenStreetMap Overpass',
      matchType: params.matchType,
      note: 'Operator/route/stop names are from OpenStreetMap. Departure, arrival, duration, and fare are planning estimates because OSM rarely contains full bus timetables or booking fares.',
      osm: { type: params.route.type, id: params.route.id, tags },
      originStation: params.originStation?.tags ?? null,
      destinationStation: params.destStation?.tags ?? null,
    },
  };
}

async function searchOsmBusOptions(params: {
  originGeo: BusGeo;
  destGeo: BusGeo;
  travelers: number;
  maxItems: number;
}): Promise<BusSearchResult> {
  const distanceKm = haversineKm(
    params.originGeo.lat,
    params.originGeo.lon,
    params.destGeo.lat,
    params.destGeo.lon,
  );
  const routeRadius = distanceKm <= 80 ? 35_000 : 60_000;

  try {
    const [originElements, destElements] = await Promise.all([
      overpassQuery(busOverpassQuery(params.originGeo, routeRadius)),
      overpassQuery(busOverpassQuery(params.destGeo, routeRadius)),
    ]);

    const originRoutes = pickBusRoutes(originElements);
    const destRoutes = pickBusRoutes(destElements);
    const destRouteKeys = new Set(destRoutes.map((route) => routeKey(route.tags ?? {})));
    const directRoutes = originRoutes.filter((route) => destRouteKeys.has(routeKey(route.tags ?? {})));
    const originStations = pickBusStations(originElements);
    const destStations = pickBusStations(destElements);
    const selectedRoutes = (directRoutes.length ? directRoutes : originRoutes)
      .filter((route, index, routes) => {
        const key = routeKey(route.tags ?? {});
        return routes.findIndex((candidate) => routeKey(candidate.tags ?? {}) === key) === index;
      })
      .slice(0, params.maxItems);

    const offers = selectedRoutes.map((route, index) =>
      mapOsmRouteToOffer({
        route,
        originGeo: params.originGeo,
        destGeo: params.destGeo,
        originStation: originStations[0] ?? null,
        destStation: destStations[0] ?? null,
        distanceKm,
        travelers: params.travelers,
        index,
        matchType: directRoutes.length ? 'direct-route' : 'origin-network',
      })
    );

    if (offers.length) {
      return {
        offers,
        live: false,
        source: 'osm',
        note: directRoutes.length
          ? 'Found OSM bus routes present near both endpoints; timings/fares remain estimates unless provided by a GTFS API.'
          : 'Found real OSM bus operators/routes near the origin; use as local/interchange context, not guaranteed direct intercity service.',
      };
    }

    if (originStations.length || destStations.length) {
      const schedule = estimateBusSchedule(distanceKm);
      const originStation = originStations[0] ?? null;
      const destStation = destStations[0] ?? null;
      return {
        offers: [{
          id: 'osm-bus-stations',
          operator: null,
          routeName: 'Bus station transfer',
          route: `${terminalName(params.originGeo, originStation)} → ${terminalName(params.destGeo, destStation)}`,
          departTime: schedule.departTime,
          arriveTime: schedule.arriveTime,
          durationMinutes: schedule.durationMinutes,
          distanceKm: Math.round(distanceKm),
          fareInr: fareEstimate(distanceKm, params.travelers),
          source: 'osm',
          raw: {
            provider: 'OpenStreetMap Overpass',
            matchType: 'bus-station',
            note: 'Bus station names are from OpenStreetMap. Exact operator, timetable, and fare are not available from OSM for this route.',
            originStation: originStation?.tags ?? null,
            destinationStation: destStation?.tags ?? null,
          },
        }],
        live: false,
        source: 'osm',
        note: 'Found real OSM bus station data; exact bus service details require provider timetable data.',
      };
    }

    return {
      offers: [],
      live: false,
      source: 'fallback',
      error: 'OpenStreetMap returned no bus routes or named bus stations near the route endpoints.',
    };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'OpenStreetMap bus search timed out.'
        : error instanceof Error
          ? error.message
          : 'OpenStreetMap bus search failed.';
    return { offers: [], live: false, source: 'fallback', error: message };
  }
}

export async function searchBusOptions(params: {
  originName: string;
  destinationName: string;
  originGeo: BusGeo;
  destGeo: BusGeo;
  departDate?: string;
  travelers?: number;
  maxItems?: number;
}): Promise<BusSearchResult> {
  const travelers = Math.max(1, params.travelers ?? 1);
  const maxItems = Math.max(1, Math.min(params.maxItems ?? 5, 8));
  const distanceKm = haversineKm(
    params.originGeo.lat,
    params.originGeo.lon,
    params.destGeo.lat,
    params.destGeo.lon,
  );

  if (!sameCountry(params.originGeo, params.destGeo) && distanceKm > 500) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      error: 'International long-distance bus data is not attempted without a dedicated provider feed.',
    };
  }

  const transitlandKey = transitlandApiKey();
  if (transitlandKey && params.departDate) {
    const transitland = await searchTransitlandBusOptions({
      originGeo: params.originGeo,
      destGeo: params.destGeo,
      departDate: params.departDate,
      travelers,
      maxItems,
    });
    if (transitland.offers.length) return transitland;
  }

  return searchOsmBusOptions({
    originGeo: params.originGeo,
    destGeo: params.destGeo,
    travelers,
    maxItems,
  });
}

function busOfferSummary(offer: BusOffer): string {
  const operator = offer.operator ? `${offer.operator} ` : '';
  const time = offer.departTime && offer.arriveTime ? `${offer.departTime}-${offer.arriveTime}` : null;
  const duration = durationLabel(offer.durationMinutes);
  const distance = offer.distanceKm ? `${Math.round(offer.distanceKm)} km` : null;
  const fare = offer.fareInr ? `fare estimate ${formatInr(offer.fareInr)}` : null;
  const details = [time, duration, distance, fare]
    .filter(Boolean)
    .join(', ');
  return `${operator}${offer.routeName}: ${offer.route}${details ? ` (${details})` : ''}`;
}

export function buildBusContext(
  result: BusSearchResult,
  fallbackFareInr: number,
): string {
  if (result.offers.length) {
    const hasTransitland = result.offers.some((offer) => offer.source === 'transitland');
    const header = hasTransitland ? '[REAL BUS DATA]' : '[REAL BUS ROUTE DATA]';
    const sourceLine = hasTransitland
      ? 'Source: Transitland GTFS routing; bus routes, operators, stops, and scheduled times are provider data where returned. Fare is estimated unless a provider fare appears in raw data.'
      : 'Source: OpenStreetMap/Overpass; bus operators, routes, and station/stop names are real mapped data. Timings, durations, and fares are planning estimates because OSM usually does not publish full timetables or booking fares.';
    return [
      header,
      sourceLine,
      result.note ? `Note: ${result.note}` : null,
      'Use named operators/routes from this block when relevant. Do not invent additional bus company names, exact departure boards, platform numbers, or live seat availability.',
      `Bus options: ${result.offers.map(busOfferSummary).join('; ')}`,
    ].filter((line): line is string => Boolean(line)).join('\n');
  }

  return [
    '[AI BUS FALLBACK]',
    `Real bus route API data unavailable: ${result.error ?? 'no supported bus provider data returned'}.`,
    `Use generic bus guidance only. Do not invent exact bus operator names, route numbers, live departure boards, platforms, seat availability, or precise timetables. Estimated planning fare: ${formatInr(fallbackFareInr)} total for this route/traveler count.`,
  ].join('\n');
}
