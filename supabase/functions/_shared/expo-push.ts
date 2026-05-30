import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type ExpoPushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
};

export function createServiceSupabase(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Send Expo push to all registered devices when profile allows push. */
export async function sendExpoPushToUser(
  admin: SupabaseClient,
  userId: string,
  message: ExpoPushMessage,
): Promise<{ sent: number; skipped?: string }> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('push_notifications_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('[expo-push] profile lookup failed:', profileError.message);
    return { sent: 0, skipped: 'profile_error' };
  }

  if (profile && profile.push_notifications_enabled === false) {
    return { sent: 0, skipped: 'push_disabled' };
  }

  const { data: tokens, error: tokenError } = await admin
    .from('device_push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  if (tokenError) {
    console.warn('[expo-push] token lookup failed:', tokenError.message);
    return { sent: 0, skipped: 'token_error' };
  }

  const pushTokens = (tokens ?? [])
    .map((row) => row.expo_push_token as string)
    .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

  if (!pushTokens.length) {
    return { sent: 0, skipped: 'no_tokens' };
  }

  const payloads = pushTokens.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
    sound: message.sound ?? 'default',
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payloads),
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn('[expo-push] Expo API error:', response.status, text);
    return { sent: 0, skipped: 'expo_api_error' };
  }

  return { sent: pushTokens.length };
}
