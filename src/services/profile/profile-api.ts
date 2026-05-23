import { getSupabaseOrNull } from '@/lib/supabase';
import { fetchTripIdsWithItinerary, fetchTrips } from '@/services/trips/trip-api';
import type { ProfileRow } from '@/types/database';
import { computeJourneyStats } from '@/utils/journey-stats';

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
): Promise<ProfileRow> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const updatedAt = new Date().toISOString();
  const row = { ...patch, updated_at: updatedAt };

  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data as ProfileRow;

  const { data: upserted, error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch, updated_at: updatedAt })
    .select('*')
    .single();

  if (upsertError) {
    throw new Error(
      upsertError.message.includes('row-level security')
        ? 'Could not save profile photo. Sign out and back in, or contact support.'
        : upsertError.message,
    );
  }

  return upserted as ProfileRow;
}

/**
 * Reconcile profile counters with actual trips + itinerary data.
 * Fixes stale zeros when trips exist but counters were never updated.
 */
export async function syncProfileStats(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;

  const [trips, itineraryTripIds] = await Promise.all([
    fetchTrips(),
    fetchTripIdsWithItinerary(),
  ]);

  const stats = computeJourneyStats(trips, itineraryTripIds);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      trips_count: stats.tripsCount,
      countries_visited: stats.countriesCount,
      ai_plans_generated: stats.aiPlansCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProfileRow | null;
}
