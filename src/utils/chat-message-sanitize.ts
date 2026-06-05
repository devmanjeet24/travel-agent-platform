import type { ChatToolEffect } from '@/utils/chat-trip-sync'

function hasPersistedTripEffect(effects?: ChatToolEffect[]): boolean {
  return Boolean(
    effects?.some(
      (e) =>
        (e.type === 'create_trip' || e.type === 'update_trip') && Boolean(e.tripId),
    ),
  )
}

/** Remove raw tool/function markup the model sometimes prints as plain text. */
export function stripRawToolMarkupFromReply(reply: string): string {
  let text = reply.trim()
  text = text.replace(/<function[^>]*>[\s\S]*?<\/function>/gi, '').trim()
  text = text.replace(/<function[^>]*>\s*\{[\s\S]*?\}\s*/gi, '').trim()
  text = text.replace(/<function[^>]*>[\s\S]*/gi, '').trim()
  text = text
    .replace(
      /this function call failed\.?\s*(?:i need|i still need|please provide)[\s\S]*$/i,
      '',
    )
    .trim()
  return text
}

const BROKEN_PERSISTED_REPLY_RE =
  /function call failed|still need|missing:|cannot create|tool call validation/i

export function polishAssistantTripReply(
  reply: string,
  effects?: ChatToolEffect[],
  destination?: string,
): string {
  let text = stripRawToolMarkupFromReply(reply)
  if (effects?.some((e) => e.type === 'delete_trip' && e.tripId)) {
    return 'Your trip has been deleted. The Trips tab has been updated.'
  }
  if (!hasPersistedTripEffect(effects)) return text
  if (!text || BROKEN_PERSISTED_REPLY_RE.test(text) || text.length < 24) {
    const dest = destination?.trim() || 'your destination'
    return `Your trip to ${dest} is saved. Open the Trips tab below to view it.`
  }
  return text
}

export function sanitizeChatDisplayContent(
  content: string,
  role: 'user' | 'assistant',
  effects?: ChatToolEffect[],
  destination?: string,
): string {
  if (role !== 'assistant') return content
  return polishAssistantTripReply(content, effects)
}
