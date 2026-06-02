export type ChatToolEffect = {
  type:
    | 'read'
    | 'create_trip'
    | 'update_trip'
    | 'regenerate_trip'
    | 'refresh_travel'
    | 'delete_trip';
  tripId?: string;
  openTripId?: string;
  summary: string;
};

export function parseChatToolEffects(data: unknown): ChatToolEffect[] | undefined {
  if (!data || typeof data !== 'object' || !('effects' in data)) return undefined;
  const effects = (data as { effects?: unknown }).effects;
  if (!Array.isArray(effects)) return undefined;
  return effects.filter(
    (item): item is ChatToolEffect =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as ChatToolEffect).type === 'string' &&
      typeof (item as ChatToolEffect).summary === 'string',
  );
}

export function chatEffectsMutateTrips(effects?: ChatToolEffect[]): boolean {
  if (!effects?.length) return false;
  return effects.some((effect) =>
    ['create_trip', 'update_trip', 'regenerate_trip', 'delete_trip'].includes(effect.type),
  );
}

export function primaryTripIdFromEffects(effects?: ChatToolEffect[]): string | undefined {
  if (!effects?.length) return undefined;
  for (const effect of [...effects].reverse()) {
    if (effect.openTripId) return effect.openTripId;
    if (effect.tripId) return effect.tripId;
  }
  return undefined;
}
