import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getSupabaseOrNull } from '@/lib/supabase';
import type { DevicePushTokenRow } from '@/types/database';

function platformLabel(): DevicePushTokenRow['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export async function upsertDevicePushToken(
  userId: string,
  expoPushToken: string,
): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();
  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: platformLabel(),
      device_name: Device.modelName ?? null,
      updated_at: now,
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  if (error) throw new Error(error.message);
}

export async function removeAllDevicePushTokens(userId: string): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return;

  const { error } = await supabase.from('device_push_tokens').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
