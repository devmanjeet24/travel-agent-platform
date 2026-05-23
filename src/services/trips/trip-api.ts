import { getSupabaseOrNull } from '@/lib/supabase';
import type {
  BudgetCategoryRow,
  ItineraryActivityRow,
  ItineraryDayRow,
  PackingItemRow,
  TripFlightRow,
  TripHotelRow,
  TripRow,
} from '@/types/database';

export type CreateTripInput = {
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  /** Budget in INR (persisted in trips.budget_usd). */
  budgetUsd?: number;
  status?: TripRow['status'];
  originCity?: string;
};

/** Trip IDs that have at least one saved itinerary day (AI plan generated). */
export async function fetchTripIdsWithItinerary(): Promise<Set<string>> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return new Set();

  const { data: trips, error: tripsErr } = await supabase.from('trips').select('id');
  if (tripsErr) throw new Error(tripsErr.message);
  const tripIds = (trips ?? []).map((t) => t.id as string);
  if (!tripIds.length) return new Set();

  const { data: days, error } = await supabase
    .from('itinerary_days')
    .select('trip_id')
    .in('trip_id', tripIds);

  if (error) throw new Error(error.message);
  return new Set((days ?? []).map((d) => d.trip_id as string));
}

export async function fetchTrips(): Promise<TripRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TripRow[];
}

export async function fetchTripById(id: string): Promise<TripRow | null> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as TripRow | null;
}

export async function createTrip(input: CreateTripInput): Promise<TripRow> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to create a trip');

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title: input.title,
      destination: input.destination,
      origin_city: input.originCity ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      travelers: input.travelers ?? 1,
      budget_usd: input.budgetUsd ?? null,
      status: input.status ?? 'draft',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const { data: profile } = await supabase
    .from('profiles')
    .select('trips_count')
    .eq('id', user.id)
    .single();

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      trips_count: (profile?.trips_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileErr) {
    console.warn('Could not update profile trips_count:', profileErr.message);
  }

  return data as TripRow;
}

export async function deleteTrip(id: string): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to delete a trip');

  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateTrip(
  id: string,
  patch: Partial<CreateTripInput & { status: TripRow['status']; image_url: string }>,
): Promise<TripRow> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('trips')
    .update({
      title: patch.title,
      destination: patch.destination,
      start_date: patch.startDate,
      end_date: patch.endDate,
      travelers: patch.travelers,
      budget_usd: patch.budgetUsd,
      status: patch.status,
      image_url: patch.image_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as TripRow;
}

export async function fetchItinerary(tripId: string): Promise<
  Array<ItineraryDayRow & { activities: ItineraryActivityRow[] }>
> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data: days, error } = await supabase
    .from('itinerary_days')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number');

  if (error) throw new Error(error.message);
  if (!days?.length) return [];

  const dayIds = days.map((d) => d.id);
  const { data: activities } = await supabase
    .from('itinerary_activities')
    .select('*')
    .in('day_id', dayIds)
    .order('sort_order');

  return (days as ItineraryDayRow[]).map((day) => ({
    ...day,
    activities: ((activities ?? []) as ItineraryActivityRow[]).filter(
      (a) => a.day_id === day.id,
    ),
  }));
}

export async function fetchBudgetCategories(
  tripId: string,
): Promise<BudgetCategoryRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as BudgetCategoryRow[];
}

export async function fetchTripHotels(tripId: string): Promise<TripHotelRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_hotels')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as TripHotelRow[];
}

export async function fetchTripFlights(tripId: string): Promise<TripFlightRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_flights')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at');

  if (error) throw new Error(error.message);
  return (data ?? []) as TripFlightRow[];
}

export async function fetchPackingItems(tripId: string): Promise<PackingItemRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as PackingItemRow[];
}

export async function togglePackingItem(
  id: string,
  packed: boolean,
): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('packing_items')
    .update({ packed })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export function tripDaysUntil(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function formatTripDates(start: string | null, end: string | null): string {
  if (!start) return 'Dates TBD';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start).toLocaleDateString(undefined, opts);
  if (!end) return s;
  const e = new Date(end).toLocaleDateString(undefined, opts);
  return `${s} – ${e}`;
}
