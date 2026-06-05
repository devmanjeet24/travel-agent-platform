import type { ChatHistoryItem, SendChatVariables } from '@/services/chat/chat-types'
import { parseTripContextFromMessage } from '@/utils/trip-context-parse'

export function buildTripContextForChat(params: {
  message: string
  originCity: string
  history?: ChatHistoryItem[]
  /** When omitted, only the current message is parsed (new chat must not reuse prior turns). */
  conversationId?: string
}): SendChatVariables['tripContext'] | undefined {
  let merged: NonNullable<SendChatVariables['tripContext']> = {}
  if (params.conversationId) {
    for (const item of params.history ?? []) {
      if (item.role !== 'user') continue
      merged = { ...merged, ...parseTripContextFromMessage(item.content) }
    }
  }
  const fromMessage = parseTripContextFromMessage(params.message)
  const deviceOrigin = params.originCity.trim()
  merged = {
    ...merged,
    ...fromMessage,
  }
  if (!merged.origin?.trim() && deviceOrigin) {
    merged.origin = deviceOrigin
  }
  return Object.keys(merged).length ? merged : undefined
}
