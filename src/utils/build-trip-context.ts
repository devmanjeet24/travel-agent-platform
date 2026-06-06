import type { ChatHistoryItem, SendChatVariables } from '@/services/chat/chat-types'
import { mergeTripContextFromMessages, parseTripContextFromMessage, type ParsedTripContext } from '@/utils/trip-context-parse'

export function buildTripContextForChat(params: {
  message: string
  originCity: string
  history?: ChatHistoryItem[]
  /** When omitted, only the current message is parsed (new chat must not reuse prior turns). */
  conversationId?: string
}): SendChatVariables['tripContext'] | undefined {
  const historyMessages = (params.history ?? []).map((item) => ({
    role: item.role,
    content: item.content,
  }))
  let merged: ParsedTripContext = {}
  if (params.conversationId) {
    merged = mergeTripContextFromMessages(historyMessages)
  }
  const fromMessage = parseTripContextFromMessage(params.message)
  merged = {
    ...merged,
    ...fromMessage,
  }
  const deviceOrigin = params.originCity.trim()
  if (!merged.origin?.trim() && deviceOrigin) {
    merged.origin = deviceOrigin
  }
  return Object.keys(merged).length ? merged : undefined
}
