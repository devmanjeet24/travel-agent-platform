import type { ChatToolEffect } from '@/utils/chat-trip-sync'

function hasPersistedTripEffect(effects?: ChatToolEffect[]): boolean {
  return Boolean(
    effects?.some(
      (e) =>
        (e.type === 'create_trip' || e.type === 'update_trip') && Boolean(e.tripId),
    ),
  )
}

const INTERNAL_CONTEXT_LINE_RE =
  /^(?:Known from this conversation|Still needed|Recent cross-conversation|Saved trip count|No prior cross-conversation|No saved trip matched|No active trip details|Do not call create_trip|Origin is already set|All required fields are present|The user has no saved trips|Current conversation persisted|destination=|origin=|start=|end=|duration=|budget INR=|travelers=|Recent saved trips|Trips matching this message|Active trip:|Use tools for saved-trip)/i

const INTERNAL_SECTION_HEADERS = [
  'CHAT MEMORY',
  'TRIP MEMORY',
  'GATHERED TRIP DETAILS',
  'CLIENT TRIP CONTEXT',
  'AUTO ACTION',
  'TOOLS',
  'LIVE TRAVEL DATA',
  'CONVERSATION SUMMARY',
  'TRIP CONFIRMATION REQUIRED',
  'TRIP CONFIRMATION',
]

function isInternalSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  return INTERNAL_SECTION_HEADERS.some((header) =>
    new RegExp(`^\\[${header.replace(/ /g, '\\s+')}\\]`, 'i').test(trimmed),
  )
}

function isInternalContextLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (INTERNAL_CONTEXT_LINE_RE.test(trimmed)) return true
  if (/^\[(?:CHAT|TRIP|GATHERED|CLIENT|AUTO|TOOLS|LIVE|CONVERSATION)/i.test(trimmed)) {
    return true
  }
  if (/^[•\-*]\s/.test(trimmed) && /\b(user:|assistant:|trip to|saved trip)\b/i.test(trimmed)) {
    return true
  }
  if (/\buser:\s*.+\|\s*assistant:/i.test(trimmed)) return true
  return false
}

/** Strip internal system/memory blocks the model sometimes echoes into chat. */
export function stripInternalChatContextFromReply(reply: string): string {
  const kept: string[] = []
  let inInternalSection = false

  for (const line of reply.split('\n')) {
    if (isInternalSectionHeader(line)) {
      inInternalSection = true
      continue
    }
    if (inInternalSection) {
      if (isInternalContextLine(line)) continue
      inInternalSection = false
    }
    if (!isInternalContextLine(line)) {
      kept.push(line)
    }
  }

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  return stripInternalChatContextFromReply(text)
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
