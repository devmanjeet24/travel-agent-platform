import { edgeFunctionUrl, getEdgeAuthHeaders } from '@/lib/edge-fetch';
import { isValidCoordinate } from '@/lib/map-coordinates';
import { uploadChatAttachmentFile } from '@/lib/storage-upload';
import { transcribeFromUri } from '@/lib/voice-recording';
import type { WeatherResult } from '@/types/database';

export type CitySuggestion = {
  id: string;
  label: string;
  subtitle: string;
  value: string;
};

export type DestinationSyncResult = {
  geo?: {
    name: string;
    country: string;
    lat: number;
    lon: number;
    displayName: string;
    imageUrl?: string | null;
  };
  updated?: boolean;
};

const TRAVEL_SEARCH_TIMEOUT_MS = 45_000;
const PLAN_TRIP_TIMEOUT_MS = 120_000;

function getEdgeErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const error = 'error' in data ? (data as { error?: unknown }).error : undefined;
    if (typeof error === 'string' && error.trim()) return error;
    const message = 'message' in data ? (data as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function parseEdgeResponse(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 240) };
  }
}

async function postEdgeFunction(
  name: string,
  body: Record<string, unknown>,
  options: {
    timeoutMs: number;
    fallbackError: string;
    notFoundError: string;
    timeoutError: string;
  },
) {
  const headers = await getEdgeAuthHeaders();
  if (!headers) throw new Error('Sign in required');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  let res: Response;
  try {
    res = await fetch(edgeFunctionUrl(name), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(options.timeoutError);
    }
    throw new Error(`Network error while contacting ${name}. Check your connection and try again.`);
  } finally {
    clearTimeout(timeout);
  }

  const data = await parseEdgeResponse(res);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(options.notFoundError);
    }
    throw new Error(getEdgeErrorMessage(data, options.fallbackError));
  }
  return data;
}

export async function invokeTravelSearch(body: Record<string, unknown>) {
  return postEdgeFunction('travel-search', body, {
    timeoutMs: TRAVEL_SEARCH_TIMEOUT_MS,
    fallbackError: 'Travel search failed',
    notFoundError: 'travel-search function not deployed. Run: supabase functions deploy travel-search',
    timeoutError: 'Travel search timed out. Please try again.',
  });
}

export async function searchCitySuggestions(query: string): Promise<CitySuggestion[]> {
  const data = await invokeTravelSearch({ action: 'cities', query });
  return (data as { suggestions?: CitySuggestion[] }).suggestions ?? [];
}

export async function syncTripDestination(params: {
  tripId: string;
  destination: string;
}): Promise<DestinationSyncResult> {
  const data = await invokeTravelSearch({
    action: 'geocode',
    tripId: params.tripId,
    destination: params.destination,
  });
  return data as DestinationSyncResult;
}

export async function fetchWeatherForDestination(
  destination: string,
): Promise<WeatherResult | null> {
  const data = await invokeTravelSearch({ action: 'weather', destination });
  return (data as { weather?: WeatherResult }).weather ?? null;
}

export type SearchHotelsResult = {
  hotels?: unknown[];
  error?: string | null;
  source?: string;
  geocodedAs?: string;
};

export type SearchPlacesResult = {
  places?: unknown[];
  context?: string;
  error?: string | null;
  geocodedAs?: string;
};

export async function searchAndCacheHotels(params: {
  tripId: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  budgetInr?: number;
  travelers?: number;
  destinationLat?: number | null;
  destinationLon?: number | null;
}): Promise<SearchHotelsResult> {
  const hasValidDestinationCoordinate =
    params.destinationLat != null &&
    params.destinationLon != null &&
    isValidCoordinate(params.destinationLat, params.destinationLon);
  if (params.destinationLat != null || params.destinationLon != null) {
    console.debug('[travel-api] hotel search destination coordinates', {
      destination: params.destination,
      destinationLat: params.destinationLat,
      destinationLon: params.destinationLon,
      accepted: hasValidDestinationCoordinate,
    });
  }
  return invokeTravelSearch({
    action: 'hotels',
    tripId: params.tripId,
    destination: params.destination,
    ...(params.startDate ? { startDate: params.startDate } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
    budgetInr: params.budgetInr,
    travelers: params.travelers,
    ...(hasValidDestinationCoordinate
      ? { lat: params.destinationLat, lon: params.destinationLon }
      : {}),
  }) as Promise<SearchHotelsResult>;
}

export async function searchPlacesForDestination(params: {
  destination: string;
  destinationLat?: number | null;
  destinationLon?: number | null;
}): Promise<SearchPlacesResult> {
  const hasValidDestinationCoordinate =
    params.destinationLat != null &&
    params.destinationLon != null &&
    isValidCoordinate(params.destinationLat, params.destinationLon);
  return invokeTravelSearch({
    action: 'places',
    destination: params.destination,
    ...(hasValidDestinationCoordinate
      ? { lat: params.destinationLat, lon: params.destinationLon }
      : {}),
  }) as Promise<SearchPlacesResult>;
}

export type RoutePolicy = {
  includeFlights: boolean;
  preferGround: boolean;
  flightRecommended: boolean;
  recommendedModes: string[];
  distanceKm: number;
  budgetTier: string;
  sameCountry: boolean;
};

export async function fetchRoutePolicy(params: {
  origin: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  budgetInr?: number;
  travelers?: number;
}): Promise<RoutePolicy | null> {
  const data = await invokeTravelSearch({
    action: 'route',
    origin: params.origin,
    destination: params.destination,
    startDate: params.startDate,
    endDate: params.endDate,
    budgetInr: params.budgetInr,
    travelers: params.travelers,
  });
  return (data as { route?: RoutePolicy }).route ?? null;
}

export async function searchAndCacheFlights(params: {
  tripId: string;
  origin: string;
  destination: string;
  departDate: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  /** Budget in INR (API field budgetUsd accepted for compatibility). */
  budgetInr?: number;
  budgetUsd?: number;
}) {
  return invokeTravelSearch({
    action: 'flights',
    tripId: params.tripId,
    origin: params.origin,
    destination: params.destination,
    departDate: params.departDate,
    ...(params.startDate ? { startDate: params.startDate } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
    budgetInr: params.budgetInr ?? params.budgetUsd,
    travelers: params.travelers,
  });
}

export type IndianTrainSearchResult = {
  trains?: unknown[];
  stations?: unknown;
  error?: string | null;
  note?: string | null;
  source?: 'apify' | 'fallback' | string;
  live?: boolean;
};

export async function searchIndianTrains(params: {
  origin: string;
  destination: string;
}): Promise<IndianTrainSearchResult> {
  return invokeTravelSearch({
    action: 'trains',
    origin: params.origin,
    destination: params.destination,
  }) as Promise<IndianTrainSearchResult>;
}

export async function geocodeTripItinerary(tripId: string): Promise<{
  attempted?: number;
  updated?: number;
}> {
  const data = await invokeTravelSearch({
    action: 'geocode-itinerary',
    tripId,
  });
  return data as { attempted?: number; updated?: number };
}

export async function planTrip(tripId: string) {
  return postEdgeFunction('plan-trip', { tripId }, {
    timeoutMs: PLAN_TRIP_TIMEOUT_MS,
    fallbackError: 'Plan trip failed',
    notFoundError: 'plan-trip function not deployed. Run: supabase functions deploy plan-trip',
    timeoutError: 'Trip planning timed out. Please try again.',
  });
}

export async function transcribeAudio(uri: string): Promise<string> {
  return transcribeFromUri(uri);
}

export async function uploadChatAttachment(
  userId: string,
  localUri: string,
  fileName: string,
  mimeType: string,
): Promise<string> {
  return uploadChatAttachmentFile({ userId, localUri, fileName, mimeType });
}
