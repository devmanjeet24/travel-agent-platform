/** Client-side transport fare estimates (INR). Mirrors supabase/functions/_shared/transport-guidance.ts */

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

export function detectTransportKind(text: string): TransportMode {
  const first = text.split(/[·•|–—-]/)[0]?.trim() ?? text;
  for (const { kind, re } of MODE_DETECT) {
    if (re.test(first) || re.test(text)) return kind;
  }
  return 'other';
}

export function estimateBusPriceInr(distanceKm: number, travelers = 1): number {
  const base = Math.max(300, Math.round(distanceKm * 1.2));
  return Math.round(base * Math.max(1, travelers) * 0.9);
}

export function estimateTrainPriceInr(distanceKm: number, travelers = 1): number {
  const base = Math.max(500, Math.round(distanceKm * 2.5));
  return Math.round(base * Math.max(1, travelers) * 0.95);
}

export function estimateFlightPriceInr(distanceKm: number): number {
  if (distanceKm < 350) return Math.round(3000 + distanceKm * 5);
  if (distanceKm < 1200) return Math.round(4000 + distanceKm * 5.5);
  if (distanceKm < 2500) return Math.round(5500 + distanceKm * 6);
  return Math.round(8000 + distanceKm * 6.5);
}

export function estimateTaxiPriceInr(distanceKm: number, travelers = 1): number {
  const km = Math.max(1, distanceKm);
  if (km <= 5) return Math.round(180 * Math.max(1, travelers));
  if (km <= 30) return Math.round((220 + km * 18) * Math.max(1, travelers));
  return Math.round((600 + km * 14) * Math.max(1, travelers));
}
