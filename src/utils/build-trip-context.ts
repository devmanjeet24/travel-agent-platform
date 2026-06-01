import type { SendChatVariables } from '@/services/chat/chat-types'
import { parseTripContextFromMessage } from '@/utils/trip-context-parse'

export function buildTripContextForChat(params: {
  message: string
  originCity: string
}): SendChatVariables['tripContext'] | undefined {
  const parsed = parseTripContextFromMessage(params.message)
  const merged = {
    ...(params.originCity.trim() ? { origin: params.originCity.trim() } : {}),
    ...parsed,
  }
  return Object.keys(merged).length ? merged : undefined
}
