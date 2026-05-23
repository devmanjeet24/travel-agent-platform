/** Budget-aware transport recommendations for AI itinerary planning (INR / India-first). */

import {
  formatInr,
  LOW_BUDGET_PER_DAY_INR,
  LOW_BUDGET_TOTAL_INR,
  MEDIUM_BUDGET_PER_DAY_INR,
  MEDIUM_BUDGET_TOTAL_INR,
} from './currency.ts';
import type { GeoResult } from './travel-apis.ts';

export type BudgetTier = 'low' | 'medium' | 'high' | 'flexible';

export type TransportMode =
  | 'bus'
  | 'train'
  | 'metro'
  | 'ferry'
  | 'flight'
  | 'car'
  | 'taxi'
  | 'walk'
  | 'other';

export type RouteAnalysis = {
  distanceKm: number;
  sameCountry: boolean;
  originCountry: string;
  destCountry: string;
  budgetTier: BudgetTier;
  preferGround: boolean;
  flightRecommended: boolean;
  recommendedModes: TransportMode[];
  guidanceLines: string[];
};

const SHORT_DISTANCE_KM = 400;
const MEDIUM_DISTANCE_KM = 1200;
const LONG_FLIGHT_DISTANCE_KM = 1500;
const CROSS_BORDER_FLIGHT_KM = 800;

/** budgetInr: trip budget in INR (stored in trips.budget_usd column). */
export function classifyBudgetTier(
  budgetInr?: number,
  travelers = 1,
  tripDays = 7,
): BudgetTier {
  if (!budgetInr || budgetInr <= 0) return 'flexible';
  const pax = Math.max(1, travelers);
  const days = Math.max(1, tripDays);
  const perPersonPerDay = budgetInr / pax / days;
  if (perPersonPerDay < LOW_BUDGET_PER_DAY_INR || budgetInr < LOW_BUDGET_TOTAL_INR) {
    return 'low';
  }
  if (
    perPersonPerDay < MEDIUM_BUDGET_PER_DAY_INR ||
    budgetInr < MEDIUM_BUDGET_TOTAL_INR
  ) {
    return 'medium';
  }
  return 'high';
}

export function haversineKm(
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

function normalizeCountry(c: string): string {
  return c.trim().toLowerCase();
}

/** Approximate inter-city bus fare in INR (not live booking). */
export function estimateBusPriceInr(distanceKm: number, travelers = 1): number {
  const base = Math.max(300, Math.round(distanceKm * 1.2));
  return Math.round(base * Math.max(1, travelers) * 0.9);
}

/** Approximate train fare in INR (sleeper/AC chair class). */
export function estimateTrainPriceInr(distanceKm: number, travelers = 1): number {
  const base = Math.max(500, Math.round(distanceKm * 2.5));
  return Math.round(base * Math.max(1, travelers) * 0.95);
}

/** Approximate domestic / short-haul flight fare in INR (India-first bands). */
export function estimateFlightPriceInr(distanceKm: number): number {
  if (distanceKm < 350) {
    return Math.round(3000 + distanceKm * 5);
  }
  if (distanceKm < 1200) {
    return Math.round(4000 + distanceKm * 5.5);
  }
  if (distanceKm < 2500) {
    return Math.round(5500 + distanceKm * 6);
  }
  return Math.round(8000 + distanceKm * 6.5);
}

/** Cab / taxi / auto for local or inter-city legs (INR, approximate). */
export function estimateTaxiPriceInr(distanceKm: number, travelers = 1): number {
  const km = Math.max(1, distanceKm);
  const pax = Math.max(1, travelers);
  if (km <= 5) return Math.round(180 * pax);
  if (km <= 30) return Math.round((220 + km * 18) * pax);
  return Math.round((600 + km * 14) * pax);
}

function parseDistanceKmFromText(text: string): number | undefined {
  const kmMatch = text.match(/(\d{2,4})\s*km\b/i);
  if (kmMatch) return Number(kmMatch[1]);
  const hourMatch = text.match(/~?\s*(\d{1,2})\s*h(?:ours?)?\)?/i);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (hours >= 4) return Math.round(hours * 55);
  }
  return undefined;
}

function isInterCityLeg(text: string): boolean {
  return (
    /\b(from|to|→|–|—|between)\b/i.test(text) ||
    /\b(board|inter-?city|long journey|overnight)\b/i.test(text) ||
    /\d+\s*km\b/i.test(text) ||
    /~\s*\d+\s*h/i.test(text)
  );
}

/** Fill missing/zero activity costs using transport mode and route distance. */
export function resolveActivityCostInr(params: {
  cost?: number | null;
  name: string;
  transport?: string | null;
  distanceKm?: number;
  travelers?: number;
}): number {
  const stored = Number(params.cost ?? 0);
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored);
  }

  const travelers = Math.max(1, params.travelers ?? 1);
  const combined = `${params.name} ${params.transport ?? ''}`.trim();
  const kind = detectTransportKind(combined);
  const parsedDistance =
    parseDistanceKmFromText(combined) ?? params.distanceKm ?? undefined;
  const distanceKm = parsedDistance ?? 80;
  const interCity = isInterCityLeg(combined);

  switch (kind) {
    case 'train':
      return interCity
        ? estimateTrainPriceInr(distanceKm, travelers)
        : Math.round(80 * travelers);
    case 'bus':
      return interCity
        ? estimateBusPriceInr(distanceKm, travelers)
        : Math.round(50 * travelers);
    case 'flight':
      return Math.round(estimateFlightPriceInr(distanceKm) * travelers);
    case 'taxi':
    case 'car':
      return estimateTaxiPriceInr(
        interCity ? distanceKm : Math.min(distanceKm, 40),
        travelers,
      );
    case 'metro':
      return Math.round(60 * travelers);
    case 'ferry':
      return interCity
        ? Math.max(200, Math.round(distanceKm * 8 * travelers))
        : Math.round(200 * travelers);
    case 'walk':
      return 0;
    default:
      if (interCity && /\b(travel|arrive|depart|journey|transfer)\b/i.test(combined)) {
        return estimateTrainPriceInr(distanceKm, travelers);
      }
      if (/\b(dinner|lunch|breakfast|meal|food|restaurant)\b/i.test(params.name)) {
        return Math.round(400 * travelers);
      }
      if (/\b(beach|museum|visit|tour|sightseeing|explore)\b/i.test(params.name)) {
        return Math.round(200 * travelers);
      }
      return Math.round(200 * travelers);
  }
}

export function analyzeRoute(params: {
  originGeo: GeoResult;
  destGeo: GeoResult;
  budgetInr?: number;
  travelers?: number;
  tripDays?: number;
}): RouteAnalysis {
  const distanceKm = haversineKm(
    params.originGeo.lat,
    params.originGeo.lon,
    params.destGeo.lat,
    params.destGeo.lon,
  );
  const originCountry = params.originGeo.country || '';
  const destCountry = params.destGeo.country || '';
  const sameCountry =
    Boolean(originCountry && destCountry) &&
    normalizeCountry(originCountry) === normalizeCountry(destCountry);
  const budgetTier = classifyBudgetTier(
    params.budgetInr,
    params.travelers,
    params.tripDays,
  );

  const guidanceLines: string[] = [];
  const recommendedModes: TransportMode[] = [];

  let preferGround = false;
  let flightRecommended = false;

  if (budgetTier === 'low') {
    preferGround = true;
    guidanceLines.push(
      'LOW BUDGET: Prefer bus, train, metro, and public transport. Avoid flights unless unavoidable.',
    );
  }

  if (sameCountry) {
    preferGround = true;
    guidanceLines.push(
      `SAME COUNTRY (${originCountry}): Prefer train or bus over flights for inter-city travel.`,
    );
    recommendedModes.push('train', 'bus');
  }

  if (distanceKm < SHORT_DISTANCE_KM) {
    preferGround = true;
    guidanceLines.push(
      `SHORT DISTANCE (~${Math.round(distanceKm)} km): Use bus, train, or local transit — do not suggest flights.`,
    );
    recommendedModes.push('bus', 'train', 'metro');
  } else if (distanceKm < MEDIUM_DISTANCE_KM) {
    preferGround = budgetTier !== 'high';
    guidanceLines.push(
      `MEDIUM DISTANCE (~${Math.round(distanceKm)} km): Train/bus often best value; flights only for tight schedules or high budget.`,
    );
    recommendedModes.push('train', 'bus');
  }

  const international = !sameCountry && Boolean(originCountry && destCountry);
  if (
    international &&
    distanceKm >= CROSS_BORDER_FLIGHT_KM &&
    (budgetTier === 'high' || budgetTier === 'flexible' || distanceKm >= LONG_FLIGHT_DISTANCE_KM)
  ) {
    flightRecommended = true;
    recommendedModes.push('flight');
    guidanceLines.push(
      `INTERNATIONAL (~${Math.round(distanceKm)} km): Flights can be reasonable; still mention train/bus if a viable alternative exists.`,
    );
  } else if (distanceKm >= LONG_FLIGHT_DISTANCE_KM && budgetTier === 'high') {
    flightRecommended = true;
    recommendedModes.push('flight');
    guidanceLines.push(
      `LONG HAUL (~${Math.round(distanceKm)} km): Flight may be appropriate for luxury or time-saving travel.`,
    );
  }

  if (preferGround && !flightRecommended) {
    if (!recommendedModes.includes('ferry') && distanceKm < 600) {
      recommendedModes.push('ferry');
    }
    guidanceLines.push(
      'Examples: Delhi→Jaipur train/bus; Mumbai→Goa train/bus; Bangalore→Chennai train; Kerala backwaters ferry where relevant.',
    );
  }

  if (!recommendedModes.length) {
    recommendedModes.push('train', 'bus', 'flight');
  }

  return {
    distanceKm,
    sameCountry,
    originCountry,
    destCountry,
    budgetTier,
    preferGround,
    flightRecommended,
    recommendedModes: [...new Set(recommendedModes)],
    guidanceLines,
  };
}

const MODE_DETECT: { kind: TransportMode; re: RegExp }[] = [
  { kind: 'bus', re: /\b(bus|coach|shuttle)\b/i },
  { kind: 'metro', re: /\b(metro|subway|tube|mrt|bts|tram|light rail)\b/i },
  { kind: 'train', re: /\b(train|rail|railway|express)\b/i },
  { kind: 'ferry', re: /\b(ferry|boat|catamaran|speedboat)\b/i },
  { kind: 'flight', re: /\b(flight|fly|flying|airline|plane|airport)\b/i },
  { kind: 'taxi', re: /\b(taxi|cab|uber|ola|auto|rickshaw|tuk)\b/i },
  { kind: 'car', re: /\b(car|drive|rental|self-drive|private transfer)\b/i },
  { kind: 'walk', re: /\b(walk|walking|on foot|foot)\b/i },
];

const MODE_LABEL: Record<TransportMode, string> = {
  bus: 'Bus',
  train: 'Train',
  metro: 'Metro',
  ferry: 'Ferry',
  flight: 'Flight',
  car: 'Car',
  taxi: 'Taxi',
  walk: 'Walk',
  other: 'Transport',
};

export function detectTransportKind(text: string): TransportMode {
  const first = text.split(/[·•|–—-]/)[0]?.trim() ?? text;
  for (const { kind, re } of MODE_DETECT) {
    if (re.test(first) || re.test(text)) return kind;
  }
  return 'other';
}

export function shouldIncludeFlights(route: RouteAnalysis): boolean {
  return route.flightRecommended || (!route.preferGround && route.distanceKm >= 1200);
}

/** Canonicalize activity transport text and swap flights for ground when route prefers it. */
export function normalizeActivityTransport(
  raw: string | null | undefined,
  route: RouteAnalysis | null,
): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  let kind = detectTransportKind(text);
  const segments = text.split(/[·•|–—-]/).map((s) => s.trim()).filter(Boolean);
  const routePart = segments.length > 1 ? segments.slice(1).join(' · ') : '';

  if (route?.preferGround && !route.flightRecommended && kind === 'flight') {
    const replacement =
      route.recommendedModes.find((m) => m !== 'flight' && m !== 'other') ?? 'train';
    kind = replacement;
  }

  const label = MODE_LABEL[kind];
  const detail =
    routePart ||
    (segments[0] && !new RegExp(`^${label}$`, 'i').test(segments[0]) ? segments.join(' · ') : '');

  if (text.toLowerCase().startsWith(label.toLowerCase())) return text;
  return detail ? `${label} · ${detail}` : label;
}

export function buildTransportGuidanceBlock(analysis: RouteAnalysis): string {
  const modes = analysis.recommendedModes.join(', ');
  const lines = [
    `[TRANSPORT GUIDANCE]`,
    `Route distance: ~${Math.round(analysis.distanceKm)} km.`,
    `Budget tier: ${analysis.budgetTier}.`,
    `Same country: ${analysis.sameCountry ? 'yes' : 'no'}.`,
    `Prefer ground transport: ${analysis.preferGround ? 'yes' : 'no'}.`,
    `Flight recommended: ${analysis.flightRecommended ? 'yes' : 'no'}.`,
    `Recommended modes: ${modes}.`,
    ...analysis.guidanceLines,
    `For each activity "transport" field, start with the mode (Bus, Train, Metro, Ferry, Flight, etc.) then a short route description.`,
    `Allocate budget "Transport" and "Flights" categories to match these choices — keep Flights near ₹0 when ground transport is used.`,
  ];
  return lines.join('\n');
}

export function tripDaysFromDates(start?: string, end?: string): number {
  if (!start || !end) return 7;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 7;
  return Math.max(1, Math.ceil((b - a) / 86400000));
}

export function groundTransportEstimates(
  distanceKm: number,
  travelers = 1,
): string {
  const bus = estimateBusPriceInr(distanceKm, travelers);
  const train = estimateTrainPriceInr(distanceKm, travelers);
  return (
    `Ground transport estimates (${Math.round(distanceKm)} km, ${travelers} traveler(s)): ` +
    `Bus ~${formatInr(bus)}; Train ~${formatInr(train)} (approximate INR, not live fares).`
  );
}
