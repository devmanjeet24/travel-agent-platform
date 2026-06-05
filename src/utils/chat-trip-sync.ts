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

export const TRIP_SAVE_FAILURE_REPLY =
  'I could not save your trip to your account. Please try again in a moment.';

const TRIP_SAVED_CLAIM_RE =
  /\b(successfully created|has been created|trip (?:is |was |has been )?saved|saved in your (system|account)|created and saved|your trip has been saved|you can (?:now )?view.*(?:trips tab|your account)|trip to .+ has been successfully|will (?:now )?create|i(?:'|’)?ll create|i will create|creating your trip|create your trip(?:\s+now)?|create your trip automatically|automatically create(?:d)?(?:\s+your)?\s+trip|have all the required information|trip is now saved|updated the trip details)\b/i;

const TRIP_DELETED_CLAIM_RE =
  /\b(?:i(?:'|’)?ve\s+)?(?:deleted|removed|cancelled)\s+(?:the\s+)?trip\b/i;

export const TRIP_DELETE_FAILURE_REPLY =
  'I could not delete that trip from your account. Please try again from the Trips tab.';

import {
  polishAssistantTripReply,
  stripRawToolMarkupFromReply,
} from '@/utils/chat-message-sanitize';

export { stripRawToolMarkupFromReply, polishAssistantTripReply };

/** Align streamed/final assistant text with verified trip persist effects. */
function tripWasDeletedFromEffects(effects?: ChatToolEffect[]): boolean {
  return Boolean(effects?.some((e) => e.type === 'delete_trip' && e.tripId));
}

export function reconcileClientTripPersistReply(
  reply: string,
  effects?: ChatToolEffect[],
  destination?: string,
): string {
  const cleaned = stripRawToolMarkupFromReply(reply);
  if (tripWasDeletedFromEffects(effects)) {
    return polishAssistantTripReply(cleaned, effects, destination);
  }
  if (TRIP_DELETED_CLAIM_RE.test(cleaned)) return TRIP_DELETE_FAILURE_REPLY;
  if (chatEffectsMutateTrips(effects)) {
    return polishAssistantTripReply(cleaned, effects, destination);
  }
  if (!TRIP_SAVED_CLAIM_RE.test(cleaned)) return cleaned;
  return TRIP_SAVE_FAILURE_REPLY;
}
