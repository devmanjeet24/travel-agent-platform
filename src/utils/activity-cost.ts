import {
  detectTransportKind,
  estimateBusPriceInr,
  estimateFlightPriceInr,
  estimateTaxiPriceInr,
  estimateTrainPriceInr,
  type TransportMode,
} from '@/utils/transport-pricing';

export type ActivityCostInput = {
  cost: number | null | undefined;
  name: string;
  transport?: string | null;
  /** Route distance when origin/destination are known (km). */
  distanceKm?: number;
  travelers?: number;
};

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

function defaultLocalCost(kind: TransportMode, travelers: number): number {
  switch (kind) {
    case 'metro':
      return 60 * travelers;
    case 'bus':
      return 50 * travelers;
    case 'train':
      return 80 * travelers;
    case 'taxi':
    case 'car':
      return 250 * travelers;
    case 'ferry':
      return 200 * travelers;
    case 'walk':
      return 0;
    default:
      return 0;
  }
}

function defaultActivityCost(name: string, travelers: number): number {
  const n = name.toLowerCase();
  if (/\b(dinner|lunch|breakfast|brunch|meal|food|restaurant|eat|cafe)\b/.test(n)) {
    return 400 * travelers;
  }
  if (/\b(hotel|check-?in|check-?out|stay|resort|hostel|lodge)\b/.test(n)) {
    return 0;
  }
  if (/\b(beach|museum|temple|fort|park|trek|tour|sightseeing|visit|explore|entry)\b/.test(n)) {
    return 200 * travelers;
  }
  return 200 * travelers;
}

/**
 * Returns a realistic INR estimate when the stored cost is missing or zero.
 */
export function resolveActivityCostInr(input: ActivityCostInput): number {
  const stored = Number(input.cost ?? 0);
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored);
  }

  const travelers = Math.max(1, input.travelers ?? 1);
  const combined = `${input.name} ${input.transport ?? ''}`.trim();
  const kind = detectTransportKind(combined);
  const parsedDistance =
    parseDistanceKmFromText(combined) ?? input.distanceKm ?? undefined;
  const distanceKm = parsedDistance ?? 80;
  const interCity = isInterCityLeg(combined);

  switch (kind) {
    case 'train':
      return interCity
        ? estimateTrainPriceInr(distanceKm, travelers)
        : defaultLocalCost('train', travelers);
    case 'bus':
      return interCity
        ? estimateBusPriceInr(distanceKm, travelers)
        : defaultLocalCost('bus', travelers);
    case 'flight':
      return Math.round(estimateFlightPriceInr(distanceKm) * travelers);
    case 'taxi':
    case 'car':
      return estimateTaxiPriceInr(interCity ? distanceKm : Math.min(distanceKm, 40), travelers);
    case 'metro':
      return defaultLocalCost('metro', travelers);
    case 'ferry':
      return interCity
        ? Math.max(200, Math.round(distanceKm * 8 * travelers))
        : defaultLocalCost('ferry', travelers);
    case 'walk':
      return 0;
    default:
      if (interCity && /\b(travel|arrive|depart|journey|transfer)\b/i.test(combined)) {
        return estimateTrainPriceInr(distanceKm, travelers);
      }
      return defaultActivityCost(input.name, travelers);
  }
}
