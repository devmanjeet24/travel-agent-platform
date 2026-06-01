import type { AirportPoint, FlightOffer, GeoResult } from './travel-apis.ts';
import { findAirportsNear } from './travel-apis.ts';

const DUFFEL_API = 'https://api.duffel.com/air';
const DUFFEL_VERSION = 'v2';
const DUFFEL_TIMEOUT_MS = 25_000;
const DUFFEL_SUPPLIER_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_OFFERS = 8;

type DuffelCarrier = {
  name?: string | null;
  iata_code?: string | null;
};

type DuffelAirport = {
  id?: string | null;
  name?: string | null;
  iata_code?: string | null;
  iata_city_code?: string | null;
  city_name?: string | null;
  time_zone?: string | null;
};

type DuffelSegment = {
  id?: string | null;
  departing_at?: string | null;
  arriving_at?: string | null;
  duration?: string | null;
  distance?: string | null;
  origin?: DuffelAirport | null;
  destination?: DuffelAirport | null;
  operating_carrier?: DuffelCarrier | null;
  operating_carrier_flight_number?: string | null;
  marketing_carrier?: DuffelCarrier | null;
  marketing_carrier_flight_number?: string | null;
  stops?: unknown[] | null;
};

type DuffelSlice = {
  id?: string | null;
  duration?: string | null;
  fare_brand_name?: string | null;
  origin?: DuffelAirport | null;
  destination?: DuffelAirport | null;
  segments?: DuffelSegment[] | null;
};

type DuffelOffer = {
  id?: string | null;
  total_amount?: string | null;
  total_currency?: string | null;
  total_emissions_kg?: string | null;
  expires_at?: string | null;
  live_mode?: boolean | null;
  owner?: DuffelCarrier | null;
  slices?: DuffelSlice[] | null;
};

type DuffelOfferRequestResponse = {
  data?: {
    id?: string | null;
    live_mode?: boolean | null;
    offers?: DuffelOffer[] | null;
  };
  errors?: { title?: string; detail?: string; message?: string; code?: string }[];
  error?: { message?: string } | string;
};

function clampTravelerCount(travelers?: number): number {
  if (!Number.isFinite(travelers ?? NaN)) return 1;
  return Math.max(1, Math.min(9, Math.floor(travelers!)));
}

function validIata(airport: AirportPoint | undefined): airport is AirportPoint & { iata: string } {
  return Boolean(airport?.iata && /^[A-Z]{3}$/.test(airport.iata));
}

function pickAirport(airports: AirportPoint[]): (AirportPoint & { iata: string }) | null {
  return airports.find(validIata) ?? null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function duffelErrorMessage(data: DuffelOfferRequestResponse | null): string {
  const first = data?.errors?.[0];
  if (first) {
    return first.detail ?? first.message ?? first.title ?? first.code ?? 'Duffel flight search failed';
  }
  const error = data?.error;
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'Duffel flight search failed';
}

function parseAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : null;
}

function localClock(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = value.includes('T') ? value.split('T')[1] : value;
  return time?.slice(0, 5) || null;
}

function datePart(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function dayOffsetLabel(departingAt: string | null | undefined, arrivingAt: string | null | undefined): string {
  const departDate = datePart(departingAt);
  const arriveDate = datePart(arrivingAt);
  if (!departDate || !arriveDate || arriveDate <= departDate) return '';
  const diffMs = Date.parse(`${arriveDate}T00:00:00Z`) - Date.parse(`${departDate}T00:00:00Z`);
  const days = Math.round(diffMs / 86_400_000);
  return days > 0 ? ` (+${days} day${days === 1 ? '' : 's'})` : '';
}

function parseIsoDurationMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return (days * 24 * 60) + (hours * 60) + minutes + Math.round(seconds / 60);
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))];
}

function airportName(airport: DuffelAirport | null | undefined): string {
  return airport?.name?.trim() || airport?.city_name?.trim() || 'Airport';
}

function airportPlace(airport: DuffelAirport | null | undefined): string {
  return airport?.city_name?.trim() || airportName(airport);
}

function airportCode(airport: DuffelAirport | null | undefined): string | null {
  return airport?.iata_code?.trim().toUpperCase() || airport?.iata_city_code?.trim().toUpperCase() || null;
}

function flightNumber(segment: DuffelSegment): string | null {
  const carrier = segment.marketing_carrier?.iata_code?.trim() ??
    segment.operating_carrier?.iata_code?.trim();
  const number = segment.marketing_carrier_flight_number?.trim() ??
    segment.operating_carrier_flight_number?.trim();
  if (!carrier || !number) return null;
  return `${carrier}${number}`;
}

function stopLabel(segments: DuffelSegment[]): string {
  const connectionStops = Math.max(segments.length - 1, 0);
  const technicalStops = segments.reduce((count, segment) => count + (segment.stops?.length ?? 0), 0);
  const stops = connectionStops + technicalStops;
  if (stops <= 0) return 'Non-stop';
  return `${stops} stop${stops === 1 ? '' : 's'}`;
}

function mapDuffelOffer(
  offer: DuffelOffer,
  offerRequestId: string | null | undefined,
  departDate: string,
): FlightOffer | null {
  const slice = offer.slices?.[0];
  const segments = slice?.segments?.filter(Boolean) ?? [];
  if (!offer.id || !segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const departingAt = first.departing_at ?? null;
  const arrivingAt = last.arriving_at ?? null;
  const departTime = localClock(departingAt);
  const arriveTime = localClock(arrivingAt);
  if (!departTime || !arriveTime) return null;

  const operatingCarriers = unique(segments.map((segment) => segment.operating_carrier?.name));
  const marketingCarriers = unique(segments.map((segment) => segment.marketing_carrier?.name));
  const airline = operatingCarriers.length
    ? operatingCarriers.join(' / ')
    : offer.owner?.name?.trim() || marketingCarriers.join(' / ') || 'Flight option';
  const originCode = airportCode(first.origin);
  const destCode = airportCode(last.destination);
  const route = `${airportPlace(first.origin)}${originCode ? ` (${originCode})` : ''} → ${airportPlace(last.destination)}${destCode ? ` (${destCode})` : ''}`;
  const totalAmount = parseAmount(offer.total_amount);
  const totalCurrency = offer.total_currency?.trim().toUpperCase() || null;
  const segmentDurationMinutes = segments.reduce(
    (sum, segment) => sum + (parseIsoDurationMinutes(segment.duration) ?? 0),
    0,
  );
  const durationMinutes = parseIsoDurationMinutes(slice?.duration) ??
    (segmentDurationMinutes || null);

  return {
    id: offer.id,
    airline,
    route,
    departTime,
    arriveTime: `${arriveTime}${dayOffsetLabel(departingAt, arrivingAt)}`,
    priceUsd: totalCurrency === 'INR' ? totalAmount : null,
    stops: stopLabel(segments),
    source: 'duffel',
    raw: {
      source: 'duffel',
      duffelOfferId: offer.id,
      duffelOfferRequestId: offerRequestId ?? null,
      liveMode: offer.live_mode ?? null,
      available: true,
      availability: 'Offer returned by Duffel at search time. Re-check before booking because airline availability can change.',
      expiresAt: offer.expires_at ?? null,
      priceAmount: totalAmount,
      priceCurrency: totalCurrency,
      totalAmount,
      totalCurrency,
      totalEmissionsKg: offer.total_emissions_kg ? Number.parseFloat(offer.total_emissions_kg) : null,
      fareBrandName: slice?.fare_brand_name ?? null,
      originAirport: airportName(first.origin),
      destAirport: airportName(last.destination),
      originAirportCode: originCode,
      destAirportCode: destCode,
      durationMinutes,
      departDate,
      airlineNames: operatingCarriers,
      marketingCarrierNames: marketingCarriers,
      flightNumbers: unique(segments.map(flightNumber)),
      segments: segments.map((segment) => ({
        id: segment.id ?? null,
        flightNumber: flightNumber(segment),
        origin: airportCode(segment.origin),
        originName: airportName(segment.origin),
        destination: airportCode(segment.destination),
        destinationName: airportName(segment.destination),
        departingAt: segment.departing_at ?? null,
        arrivingAt: segment.arriving_at ?? null,
        duration: segment.duration ?? null,
        distanceKm: segment.distance ? Number.parseFloat(segment.distance) : null,
        operatingCarrier: segment.operating_carrier?.name ?? null,
        marketingCarrier: segment.marketing_carrier?.name ?? null,
      })),
      note: 'Live Duffel offer. Price and availability can change until booking.',
    },
  };
}

export async function searchFlightsDuffel(params: {
  originGeo: GeoResult;
  destGeo: GeoResult;
  departDate: string;
  travelers?: number;
  accessToken?: string;
  maxOffers?: number;
}): Promise<{ offers: FlightOffer[]; error?: string; source: 'duffel' }> {
  const accessToken = params.accessToken?.trim();
  if (!accessToken) {
    return { offers: [], error: 'DUFFEL_ACCESS_TOKEN is not set', source: 'duffel' };
  }

  const [originAirports, destAirports] = await Promise.all([
    findAirportsNear(params.originGeo),
    findAirportsNear(params.destGeo),
  ]);
  const originAirport = pickAirport(originAirports);
  const destAirport = pickAirport(destAirports);

  if (!originAirport || !destAirport) {
    return {
      offers: [],
      error: 'Could not find IATA airport codes near the origin and destination for Duffel search.',
      source: 'duffel',
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${DUFFEL_API}/offer_requests?return_offers=true&supplier_timeout=${DUFFEL_SUPPLIER_TIMEOUT_MS}&view=offers`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Duffel-Version': DUFFEL_VERSION,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data: {
            slices: [{
              origin: originAirport.iata,
              destination: destAirport.iata,
              departure_date: params.departDate,
            }],
            passengers: Array.from({ length: clampTravelerCount(params.travelers) }, () => ({
              type: 'adult',
            })),
            cabin_class: 'economy',
            max_connections: 2,
          },
        }),
      },
      DUFFEL_TIMEOUT_MS,
    );

    const data = (await res.json().catch(() => null)) as DuffelOfferRequestResponse | null;
    if (!res.ok) {
      return { offers: [], error: duffelErrorMessage(data), source: 'duffel' };
    }

    const offerRequest = data?.data;
    const offers = (offerRequest?.offers ?? [])
      .map((offer) => mapDuffelOffer(offer, offerRequest?.id, params.departDate))
      .filter((offer): offer is FlightOffer => Boolean(offer))
      .sort((a, b) => {
        const aAmount = typeof a.raw.priceAmount === 'number' ? a.raw.priceAmount : Number.MAX_VALUE;
        const bAmount = typeof b.raw.priceAmount === 'number' ? b.raw.priceAmount : Number.MAX_VALUE;
        return aAmount - bAmount;
      })
      .slice(0, params.maxOffers ?? DEFAULT_MAX_OFFERS);

    return {
      offers,
      error: offers.length ? undefined : 'Duffel returned no live flight offers for this route/date.',
      source: 'duffel',
    };
  } catch (e) {
    const message = e instanceof DOMException && e.name === 'AbortError'
      ? 'Duffel flight search timed out. Please try again.'
      : e instanceof Error
        ? e.message
        : 'Duffel flight search failed';
    return { offers: [], error: message, source: 'duffel' };
  }
}
