import AsyncStorage from '@react-native-async-storage/async-storage';

import { isOfflineSyncEnabled } from '@/lib/offline-sync-state';
import type { ChatMessage } from '@/services/chat';

const CACHE_PREFIX = '@travel/chat_cache/';

export type CachedChatSession = {
  conversationId: string;
  title: string;
  messages: ChatMessage[];
  tripId?: string;
  updatedAt: string;
};

function cacheKey(conversationId: string): string {
  return `${CACHE_PREFIX}${conversationId}`;
}

function latestKey(tripId?: string): string {
  return `${CACHE_PREFIX}latest:${tripId ?? 'global'}`;
}

export async function saveChatSessionCache(session: CachedChatSession): Promise<void> {
  if (!isOfflineSyncEnabled()) return;
  const payload = JSON.stringify(session);
  await AsyncStorage.setItem(cacheKey(session.conversationId), payload);
  await AsyncStorage.setItem(
    latestKey(session.tripId),
    JSON.stringify({ conversationId: session.conversationId, updatedAt: session.updatedAt }),
  );
}

export async function loadChatSessionCache(params: {
  conversationId?: string;
  tripId?: string;
}): Promise<CachedChatSession | null> {
  if (!isOfflineSyncEnabled()) return null;

  let conversationId = params.conversationId;
  if (!conversationId) {
    const latestRaw = await AsyncStorage.getItem(latestKey(params.tripId));
    if (latestRaw) {
      try {
        conversationId = (JSON.parse(latestRaw) as { conversationId: string }).conversationId;
      } catch {
        return null;
      }
    }
  }

  if (!conversationId) return null;

  const raw = await AsyncStorage.getItem(cacheKey(conversationId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CachedChatSession;
  } catch {
    return null;
  }
}

export async function clearChatOfflineCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const chatKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  if (chatKeys.length) {
    await AsyncStorage.multiRemove(chatKeys);
  }
}
