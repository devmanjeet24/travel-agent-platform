import { getEdgeAuthHeaders, edgeFunctionUrl } from '@/lib/edge-fetch';

export async function sendRemotePushNotification(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const headers = await getEdgeAuthHeaders();
  if (!headers) return;

  const response = await fetch(edgeFunctionUrl('push-notify'), {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    console.warn(
      '[push-notify]',
      payload.error ?? `HTTP ${response.status}`,
    );
  }
}
