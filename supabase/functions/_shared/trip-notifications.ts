type SupabaseClient = {
  from: (table: string) => {
    insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => Promise<{ error?: { message?: string } | null }>;
  };
};

export type TripNotificationKind =
  | 'trip_created'
  | 'trip_saved'
  | 'trip_updated'
  | 'itinerary_generated'
  | 'budget_generated'
  | 'packing_generated';

const KIND_COPY: Record<
  TripNotificationKind,
  { type: 'itinerary' | 'packing' | 'flight' | 'booking' | 'general'; title: string; body: (d: string) => string }
> = {
  trip_created: {
    type: 'general',
    title: 'Trip created',
    body: (d) => `Your ${d} trip was created. Open Trips to view details.`,
  },
  trip_saved: {
    type: 'itinerary',
    title: 'Trip saved',
    body: (d) => `Your ${d} itinerary is saved and ready in Trips.`,
  },
  trip_updated: {
    type: 'general',
    title: 'Trip updated',
    body: (d) => `Your ${d} trip was updated.`,
  },
  itinerary_generated: {
    type: 'itinerary',
    title: 'Itinerary ready',
    body: (d) => `Your ${d} day-by-day plan is ready to view.`,
  },
  budget_generated: {
    type: 'booking',
    title: 'Budget ready',
    body: (d) => `Your ${d} budget breakdown is ready.`,
  },
  packing_generated: {
    type: 'packing',
    title: 'Packing list ready',
    body: (d) => `Review packing suggestions for ${d}.`,
  },
};

/** In-app notification rows for trip lifecycle events (Alerts tab). */
export async function insertTripActivityNotifications(
  supabase: SupabaseClient,
  input: {
    userId: string;
    tripId: string;
    destination: string;
    startDate?: string | null;
    kinds: TripNotificationKind[];
  },
): Promise<void> {
  const destination = input.destination.trim() || 'your trip';
  const rows = input.kinds.map((kind) => {
    const copy = KIND_COPY[kind];
    return {
      user_id: input.userId,
      trip_id: input.tripId,
      type: copy.type,
      title: copy.title,
      body: copy.body(destination),
    };
  });

  if (input.startDate && input.kinds.includes('trip_saved')) {
    rows.push({
      user_id: input.userId,
      trip_id: input.tripId,
      type: 'flight',
      title: 'Upcoming trip',
      body: `${destination} starts on ${input.startDate}. Check flights and hotels.`,
    });
  }

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.warn('[trip-notifications] insert failed:', error.message ?? error);
  }
}

/** Alerts-tab row after AI or manual trip deletion (no trip_id — row survives trip delete). */
export async function insertTripDeletedNotification(
  supabase: SupabaseClient,
  input: { userId: string; destination: string },
): Promise<void> {
  const destination = input.destination.trim() || 'your trip';
  const { error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    trip_id: null,
    type: 'general',
    title: 'Trip deleted successfully',
    body: `Your ${destination} trip was removed.`,
  });
  if (error) {
    console.warn('[trip-notifications] delete notification failed:', error.message ?? error);
  }
}
