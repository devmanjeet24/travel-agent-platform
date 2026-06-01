/** Indian Railways train search integration with explicit AI-estimate fallback. */

import { formatInr } from './currency.ts';

type EnvGlobal = typeof globalThis & {
  Deno?: {
    env?: {
      get(name: string): string | undefined;
    };
  };
};

export type RailGeo = {
  name: string;
  country: string;
  countryCode?: string;
  displayName: string;
};

export type IndianRailStation = {
  code: string;
  name: string;
  city: string;
  state?: string;
  aliases: string[];
};

export type IndianTrainOffer = {
  id: string;
  trainNumber: string;
  trainName: string;
  trainType: string | null;
  originStation: string;
  originCode: string;
  destinationStation: string;
  destinationCode: string;
  fromStation: string;
  fromCode: string;
  toStation: string;
  toCode: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  runsOn: string[];
  classesAvailable: string[];
  fareByClass: Record<string, number>;
  seatAvailability: string[];
  routeStations: string[];
  sourceUrl: string | null;
  scrapedAt: string | null;
  source: 'apify';
  raw: Record<string, unknown>;
};

export type IndianTrainSearchResult = {
  offers: IndianTrainOffer[];
  live: boolean;
  source: 'apify' | 'fallback';
  stations?: {
    origin: IndianRailStation;
    destination: IndianRailStation;
  };
  error?: string;
  note?: string;
};

const APIFY_DEFAULT_ACTOR_ID = 'jungle_synthesizer/indian-railways-timetable-scraper';
const APIFY_TIMEOUT_MS = 18_000;
const DEFAULT_MAX_TRAINS = 8;

// Curated high-traffic/tourism stations. This is intentionally small and safe:
// unknown cities fall back to generic train estimates instead of guessing codes.
const INDIAN_RAIL_STATIONS: IndianRailStation[] = [
  { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi', aliases: ['delhi', 'new delhi', 'ncr'] },
  { code: 'DLI', name: 'Old Delhi', city: 'Delhi', state: 'Delhi', aliases: ['old delhi', 'delhi junction'] },
  { code: 'JP', name: 'Jaipur', city: 'Jaipur', state: 'Rajasthan', aliases: ['jaipur'] },
  { code: 'AGC', name: 'Agra Cantt', city: 'Agra', state: 'Uttar Pradesh', aliases: ['agra', 'agra cantt'] },
  { code: 'BSB', name: 'Varanasi Junction', city: 'Varanasi', state: 'Uttar Pradesh', aliases: ['varanasi', 'banaras', 'kashi'] },
  { code: 'LKO', name: 'Lucknow Charbagh', city: 'Lucknow', state: 'Uttar Pradesh', aliases: ['lucknow'] },
  { code: 'ASR', name: 'Amritsar Junction', city: 'Amritsar', state: 'Punjab', aliases: ['amritsar'] },
  { code: 'HW', name: 'Haridwar', city: 'Haridwar', state: 'Uttarakhand', aliases: ['haridwar'] },
  { code: 'RKSH', name: 'Rishikesh', city: 'Rishikesh', state: 'Uttarakhand', aliases: ['rishikesh'] },
  { code: 'CDG', name: 'Chandigarh', city: 'Chandigarh', state: 'Chandigarh', aliases: ['chandigarh'] },
  { code: 'MMCT', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra', aliases: ['mumbai', 'bombay', 'mumbai central'] },
  { code: 'CSMT', name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai', state: 'Maharashtra', aliases: ['csmt', 'cst', 'mumbai cst', 'chhatrapati shivaji terminus'] },
  { code: 'PUNE', name: 'Pune Junction', city: 'Pune', state: 'Maharashtra', aliases: ['pune', 'poona'] },
  { code: 'ADI', name: 'Ahmedabad Junction', city: 'Ahmedabad', state: 'Gujarat', aliases: ['ahmedabad', 'amdavad'] },
  { code: 'ST', name: 'Surat', city: 'Surat', state: 'Gujarat', aliases: ['surat'] },
  { code: 'BRC', name: 'Vadodara Junction', city: 'Vadodara', state: 'Gujarat', aliases: ['vadodara', 'baroda'] },
  { code: 'MAO', name: 'Madgaon Junction', city: 'Goa', state: 'Goa', aliases: ['goa', 'madgaon', 'margao', 'south goa'] },
  { code: 'THVM', name: 'Thivim', city: 'Goa', state: 'Goa', aliases: ['north goa', 'thivim', 'mapusa'] },
  { code: 'SBC', name: 'KSR Bengaluru City Junction', city: 'Bengaluru', state: 'Karnataka', aliases: ['bengaluru', 'bangalore', 'blr'] },
  { code: 'MYS', name: 'Mysuru Junction', city: 'Mysuru', state: 'Karnataka', aliases: ['mysuru', 'mysore'] },
  { code: 'MAS', name: 'MGR Chennai Central', city: 'Chennai', state: 'Tamil Nadu', aliases: ['chennai', 'madras', 'chennai central'] },
  { code: 'CBE', name: 'Coimbatore Junction', city: 'Coimbatore', state: 'Tamil Nadu', aliases: ['coimbatore'] },
  { code: 'MDU', name: 'Madurai Junction', city: 'Madurai', state: 'Tamil Nadu', aliases: ['madurai'] },
  { code: 'TVC', name: 'Thiruvananthapuram Central', city: 'Thiruvananthapuram', state: 'Kerala', aliases: ['thiruvananthapuram', 'trivandrum'] },
  { code: 'ERS', name: 'Ernakulam Junction', city: 'Kochi', state: 'Kerala', aliases: ['kochi', 'cochin', 'ernakulam'] },
  { code: 'CLT', name: 'Kozhikode', city: 'Kozhikode', state: 'Kerala', aliases: ['kozhikode', 'calicut'] },
  { code: 'SC', name: 'Secunderabad Junction', city: 'Hyderabad', state: 'Telangana', aliases: ['hyderabad', 'secunderabad'] },
  { code: 'HYB', name: 'Hyderabad Deccan', city: 'Hyderabad', state: 'Telangana', aliases: ['hyderabad deccan', 'nampally'] },
  { code: 'BZA', name: 'Vijayawada Junction', city: 'Vijayawada', state: 'Andhra Pradesh', aliases: ['vijayawada'] },
  { code: 'VSKP', name: 'Visakhapatnam', city: 'Visakhapatnam', state: 'Andhra Pradesh', aliases: ['visakhapatnam', 'vizag'] },
  { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal', aliases: ['kolkata', 'calcutta', 'howrah'] },
  { code: 'SDAH', name: 'Sealdah', city: 'Kolkata', state: 'West Bengal', aliases: ['sealdah'] },
  { code: 'BBS', name: 'Bhubaneswar', city: 'Bhubaneswar', state: 'Odisha', aliases: ['bhubaneswar'] },
  { code: 'PURI', name: 'Puri', city: 'Puri', state: 'Odisha', aliases: ['puri'] },
  { code: 'GHY', name: 'Guwahati', city: 'Guwahati', state: 'Assam', aliases: ['guwahati', 'gauhati'] },
  { code: 'PNBE', name: 'Patna Junction', city: 'Patna', state: 'Bihar', aliases: ['patna'] },
  { code: 'RNC', name: 'Ranchi', city: 'Ranchi', state: 'Jharkhand', aliases: ['ranchi'] },
  { code: 'BPL', name: 'Bhopal Junction', city: 'Bhopal', state: 'Madhya Pradesh', aliases: ['bhopal'] },
  { code: 'INDB', name: 'Indore Junction', city: 'Indore', state: 'Madhya Pradesh', aliases: ['indore'] },
  { code: 'AII', name: 'Ajmer Junction', city: 'Ajmer', state: 'Rajasthan', aliases: ['ajmer', 'pushkar'] },
  { code: 'JU', name: 'Jodhpur Junction', city: 'Jodhpur', state: 'Rajasthan', aliases: ['jodhpur'] },
  { code: 'UDZ', name: 'Udaipur City', city: 'Udaipur', state: 'Rajasthan', aliases: ['udaipur'] },
];

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

function stationSearchText(station: IndianRailStation): string {
  return normalize([station.code, station.name, station.city, station.state, ...station.aliases].filter(Boolean).join(' '));
}

function isIndiaGeo(geo: RailGeo): boolean {
  const country = normalize(geo.country ?? '');
  const code = (geo.countryCode ?? '').trim().toUpperCase();
  return country === 'india' || code === 'IN';
}

function resolveIndianRailStation(candidates: Array<string | undefined>): IndianRailStation | null {
  const normalizedCandidates = candidates
    .map((candidate) => normalize(candidate ?? ''))
    .filter(Boolean);
  if (!normalizedCandidates.length) return null;

  let best: { station: IndianRailStation; score: number } | null = null;
  for (const station of INDIAN_RAIL_STATIONS) {
    const searchText = stationSearchText(station);
    const aliases = [station.code, station.name, station.city, ...station.aliases].map(normalize);
    for (const candidate of normalizedCandidates) {
      let score = 0;
      if (aliases.includes(candidate)) score = 100;
      else if (aliases.some((alias) => candidate.includes(alias) && alias.length >= 4)) score = 80;
      else if (searchText.includes(candidate) && candidate.length >= 4) score = 60;
      else if (candidate.includes(normalize(station.code))) score = 55;

      if (score > (best?.score ?? 0)) {
        best = { station, score };
      }
    }
  }

  return best && best.score >= 60 ? best.station : null;
}

function toActorId(value: string): string {
  return value.trim().replace('/', '~');
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function asFareMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const amount = asNumber(raw);
    if (amount != null && amount > 0) out[key] = Math.round(amount);
  }
  return out;
}

function mapApifyRecord(raw: unknown): IndianTrainOffer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const trainNumber = asString(record.train_number);
  const trainName = asString(record.train_name);
  const fromCode = asString(record.from_code);
  const toCode = asString(record.to_code);
  if (!trainNumber || !trainName || !fromCode || !toCode) return null;

  return {
    id: `apify-${trainNumber}-${fromCode}-${toCode}`,
    trainNumber,
    trainName,
    trainType: asString(record.train_type) || null,
    originStation: asString(record.origin_station),
    originCode: asString(record.origin_code),
    destinationStation: asString(record.destination_station),
    destinationCode: asString(record.destination_code),
    fromStation: asString(record.from_station),
    fromCode,
    toStation: asString(record.to_station),
    toCode,
    departureTime: asString(record.departure_time),
    arrivalTime: asString(record.arrival_time),
    durationMinutes: asNumber(record.duration_minutes),
    distanceKm: asNumber(record.distance_km),
    runsOn: asStringArray(record.runs_on),
    classesAvailable: asStringArray(record.classes_available),
    fareByClass: asFareMap(record.fare_by_class),
    seatAvailability: asStringArray(record.seat_availability),
    routeStations: asStringArray(record.route_stations),
    sourceUrl: asString(record.source_url) || null,
    scrapedAt: asString(record.scraped_at) || null,
    source: 'apify',
    raw: record,
  };
}

function firstFareLabel(fares: Record<string, number>): string | null {
  const preferred = ['2S', 'SL', 'CC', '3E', '3A', '2A', '1A', 'EC'];
  for (const key of preferred) {
    if (fares[key] != null) return `${key} ${formatInr(fares[key])}`;
  }
  const [key, value] = Object.entries(fares)[0] ?? [];
  return key && value != null ? `${key} ${formatInr(value)}` : null;
}

function durationLabel(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function trainSummary(offer: IndianTrainOffer): string {
  const fare = firstFareLabel(offer.fareByClass);
  const duration = durationLabel(offer.durationMinutes);
  const classes = offer.classesAvailable.length ? `classes ${offer.classesAvailable.join('/')}` : null;
  const runs = offer.runsOn.length ? `runs ${offer.runsOn.join('/')}` : null;
  const details = [duration, offer.distanceKm ? `${Math.round(offer.distanceKm)} km` : null, classes, runs, fare ? `fare ${fare}` : null]
    .filter(Boolean)
    .join(', ');
  return `${offer.trainNumber} ${offer.trainName}: ${offer.fromStation || offer.fromCode} (${offer.fromCode}) → ${offer.toStation || offer.toCode} (${offer.toCode}), ${offer.departureTime || '?'}-${offer.arrivalTime || '?'}${details ? ` (${details})` : ''}`;
}

export async function searchIndianTrains(params: {
  originName: string;
  destinationName: string;
  originGeo: RailGeo;
  destGeo: RailGeo;
  maxItems?: number;
}): Promise<IndianTrainSearchResult> {
  if (!isIndiaGeo(params.originGeo) || !isIndiaGeo(params.destGeo)) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      error: 'Indian Railways search only applies to routes where both endpoints geocode to India.',
    };
  }

  const origin = resolveIndianRailStation([
    params.originName,
    params.originGeo.name,
    params.originGeo.displayName,
  ]);
  const destination = resolveIndianRailStation([
    params.destinationName,
    params.destGeo.name,
    params.destGeo.displayName,
  ]);

  if (!origin || !destination) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      error: 'Could not confidently resolve Indian Railways station codes for this route.',
    };
  }

  if (origin.code === destination.code) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      stations: { origin, destination },
      error: 'Origin and destination resolved to the same rail station.',
    };
  }

  const token = env('APIFY_TOKEN') ?? env('INDIAN_RAIL_APIFY_TOKEN');
  if (!token) {
    return {
      offers: [],
      live: false,
      source: 'fallback',
      stations: { origin, destination },
      error: 'APIFY_TOKEN or INDIAN_RAIL_APIFY_TOKEN is not configured.',
      note: 'Set an Apify token to enable real Indian Railways train names, numbers, timings, and fares.',
    };
  }

  const actorId = toActorId(env('INDIAN_RAIL_APIFY_ACTOR') ?? APIFY_DEFAULT_ACTOR_ID);
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'train_search',
        originStation: origin.code,
        destinationStation: destination.code,
        maxItems: Math.max(1, Math.min(params.maxItems ?? DEFAULT_MAX_TRAINS, 20)),
        proxyConfiguration: { useApifyProxy: false },
      }),
    }, APIFY_TIMEOUT_MS);

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: unknown }).error)
          : `Apify Indian Railways request failed (${response.status})`;
      return {
        offers: [],
        live: false,
        source: 'fallback',
        stations: { origin, destination },
        error: message,
      };
    }

    const records = Array.isArray(data) ? data : [];
    const offers = records
      .map(mapApifyRecord)
      .filter((offer): offer is IndianTrainOffer => offer != null)
      .slice(0, Math.max(1, Math.min(params.maxItems ?? DEFAULT_MAX_TRAINS, 20)));

    return {
      offers,
      live: offers.length > 0,
      source: offers.length ? 'apify' : 'fallback',
      stations: { origin, destination },
      error: offers.length ? undefined : 'Indian Railways provider returned no direct trains for this station pair.',
    };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Indian Railways provider timed out.'
        : error instanceof Error
          ? error.message
          : 'Indian Railways provider failed.';
    return {
      offers: [],
      live: false,
      source: 'fallback',
      stations: { origin, destination },
      error: message,
    };
  }
}

export function buildIndianRailContext(
  result: IndianTrainSearchResult,
  fallbackFareInr: number,
): string {
  const stationLine = result.stations
    ? `Resolved stations: ${result.stations.origin.name} (${result.stations.origin.code}) → ${result.stations.destination.name} (${result.stations.destination.code}).`
    : 'Resolved stations: unavailable.';

  if (result.offers.length) {
    const sourceLine =
      'Source: Apify Indian Railways scraper using public eRail/running-status sources; train names, numbers, station codes, scheduled timings, classes, and listed fares are real provider data.';
    const trains = result.offers.map(trainSummary).join('; ');
    return [
      '[REAL INDIAN RAILWAYS DATA]',
      sourceLine,
      stationLine,
      'Use these trains verbatim for Indian train legs. Do not replace real train numbers/timings with estimates.',
      `Train options: ${trains}`,
    ].join('\n');
  }

  return [
    '[AI TRAIN FALLBACK]',
    stationLine,
    `Real Indian Railways API data unavailable: ${result.error ?? 'no direct live data returned'}.`,
    `Use generic train guidance only. Do not invent exact train names, train numbers, live platform data, seat availability, or precise timetable. Estimated planning fare: ${formatInr(fallbackFareInr)} total for this route/traveler count.`,
  ].join('\n');
}
