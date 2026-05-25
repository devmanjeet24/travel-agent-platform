import { getSupabaseOrNull } from '@/lib/supabase';
import type { NotificationRow } from '@/types/database';

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function deleteNotification(id: string): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createTripNotifications(params: {
  userId: string;
  tripId: string;
  destination: string;
  startDate: string | null;
}): Promise<void> {
  const supabase = getSupabaseOrNull();
  if (!supabase) return;

  const rows: Array<{
    user_id: string;
    trip_id: string;
    type: NotificationRow['type'];
    title: string;
    body: string;
  }> = [
    {
      user_id: params.userId,
      trip_id: params.tripId,
      type: 'itinerary',
      title: 'Trip saved',
      body: `Your ${params.destination} itinerary is ready to view.`,
    },
    {
      user_id: params.userId,
      trip_id: params.tripId,
      type: 'packing',
      title: 'Packing list',
      body: `Review weather-based packing for ${params.destination}.`,
    },
  ];

  if (params.startDate) {
    rows.push({
      user_id: params.userId,
      trip_id: params.tripId,
      type: 'flight',
      title: 'Upcoming trip',
      body: `${params.destination} starts on ${params.startDate}. Check flights and hotels.`,
    });
  }

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw new Error(error.message);
}

export function formatNotificationTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
