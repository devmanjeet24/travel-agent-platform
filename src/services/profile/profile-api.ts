import { getSupabaseOrNull } from '@/lib/supabase';
import type { ProfileRow } from '@/types/database';

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}

export async function updateProfileSettings(
  userId: string,
  patch: Partial<
    Pick<
      ProfileRow,
      'push_notifications_enabled' | 'offline_sync_enabled' | 'display_name' | 'avatar_url'
    >
  >,
): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}
