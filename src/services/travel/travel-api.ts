import { edgeFunctionUrl, getEdgeAuthHeaders } from '@/lib/edge-fetch';
import { uploadChatAttachmentFile } from '@/lib/storage-upload';
import { transcribeFromUri } from '@/lib/voice-recording';
import type { WeatherResult } from '@/types/database';

export async function invokeTravelSearch(body: Record<string, unknown>) {
  const headers = await getEdgeAuthHeaders();
  if (!headers) throw new Error('Sign in required');

  const res = await fetch(edgeFunctionUrl('travel-search'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'travel-search function not deployed. Run: supabase functions deploy travel-search',
      );
    }
    throw new Error((data as { error?: string }).error ?? 'Travel search failed');
  }
  return data;
}

export async function fetchWeatherForDestination(
  destination: string,
): Promise<WeatherResult | null> {
  const data = await invokeTravelSearch({ action: 'weather', destination });
  return (data as { weather?: WeatherResult }).weather ?? null;
}

export async function searchAndCacheHotels(params: {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
}) {
  return invokeTravelSearch({
    action: 'hotels',
    tripId: params.tripId,
    destination: params.destination,
    startDate: params.startDate,
    endDate: params.endDate,
  });
}

export async function searchAndCacheFlights(params: {
  tripId: string;
  origin: string;
  destination: string;
  departDate: string;
  budgetUsd?: number;
}) {
  return invokeTravelSearch({
    action: 'flights',
    tripId: params.tripId,
    origin: params.origin,
    destination: params.destination,
    departDate: params.departDate,
    budgetUsd: params.budgetUsd,
  });
}

export async function planTrip(tripId: string) {
  const headers = await getEdgeAuthHeaders();
  if (!headers) throw new Error('Sign in required');

  const res = await fetch(edgeFunctionUrl('plan-trip'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ tripId }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'plan-trip function not deployed. Run: supabase functions deploy plan-trip',
      );
    }
    throw new Error((data as { error?: string }).error ?? 'Plan trip failed');
  }
  return data;
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
