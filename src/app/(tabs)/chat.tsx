import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { Paperclip, Sparkles, X } from 'lucide-react-native'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { OriginCityBar } from '@/components/chat/OriginCityBar'
import { ChatBubble } from '@/components/ui/ChatBubble'
import { brand, spacing } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset'
import { useTabScreenInsets } from '@/hooks/use-tab-screen-insets'
import { useVoiceAssistant } from '@/hooks/use-voice-assistant'
import { radii } from '@/lib/ui-styles'
import { sendChatWithStream } from '@/lib/edge-fetch'
import { stopSpeaking } from '@/lib/voice-tts'
import {
  fetchConversationById,
  fetchConversationMessages,
  fetchLatestConversation,
} from '@/services/chat/chat-db'
import {
  clearLatestChatSessionPointer,
  loadChatSessionCache,
  saveChatSessionCache,
} from '@/lib/chat-offline-cache'
import { useIsOffline } from '@/hooks/use-offline-sync'
import { useDeviceOriginCity } from '@/hooks/use-device-origin-city'
import { loadStoredOriginCity } from '@/lib/origin-city-storage'
import { deriveChatTitle } from '@/utils/chat-title'
import type { ChatAttachment, ChatHistoryItem, ChatMessage } from '@/services/chat'
import { uploadChatAttachment } from '@/services/travel/travel-api'
import { useAuth } from '@/providers/auth-provider'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { notificationKeys } from '@/hooks/notifications/use-notifications-query'
import { tripKeys } from '@/services/trips/trip-keys'
import {
  chatEffectsMutateTrips,
  primaryTripIdFromEffects,
  reconcileClientTripPersistReply,
  stripRawToolMarkupFromReply,
  TRIP_SAVE_FAILURE_REPLY,
  TRIP_DELETE_FAILURE_REPLY,
} from '@/utils/chat-trip-sync'
import { buildTripContextForChat } from '@/utils/build-trip-context'
import { fetchTripById } from '@/services/trips/trip-api'
import type { TripRow } from '@/types/database'

const DEFAULT_HEADER_TITLE = 'AI Travel Agent'

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const MAX_CLIENT_HISTORY_TURNS = 4
const MAX_CLIENT_HISTORY_CHARS = 600

/** Visual gap between the composer block and the top of the software keyboard. */
const CHAT_KEYBOARD_GAP = spacing.sm + 2

function toHistory(messages: ChatMessage[]): ChatHistoryItem[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_CLIENT_HISTORY_TURNS)
    .map(({ role, content }) => {
      const trimmed = content.trim()
      const clipped =
        trimmed.length > MAX_CLIENT_HISTORY_CHARS
          ? `${trimmed.slice(0, MAX_CLIENT_HISTORY_CHARS - 1)}…`
          : trimmed
      return { role, content: clipped }
    })
}

export default function ChatScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { horizontalPadding } = useResponsive()
  const tabInsets = useTabScreenInsets()
  const params = useLocalSearchParams<{ tripId?: string; conversationId?: string }>()
  const isOffline = useIsOffline()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const speakReplyRef = useRef<(reply: string) => Promise<void>>(async () => {})
  const shouldSpeakRef = useRef(false)
  /** Authoritative conversation target for sends; updated synchronously on New Chat. */
  const conversationIdRef = useRef<string | undefined>(params.conversationId)
  /** True after New Chat until the next outbound message (ref avoids reload races). */
  const isFreshChatRef = useRef(false)
  /** Bumped on New Chat so in-flight history loads cannot restore the previous thread. */
  const chatLoadGenerationRef = useRef(0)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(params.conversationId)
  const [conversationTitle, setConversationTitle] = useState(DEFAULT_HEADER_TITLE)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [originBarDismissed, setOriginBarDismissed] = useState(false)

  const setActiveConversationId = useCallback((id: string | undefined) => {
    conversationIdRef.current = id
    setConversationId(id)
  }, [])

  useEffect(() => {
    if (!params.conversationId) return
    isFreshChatRef.current = false
    setActiveConversationId(params.conversationId)
  }, [params.conversationId, setActiveConversationId])
  const {
    originCity,
    setOriginCity,
    status: originStatus,
    needsManualEntry,
    retryDetection,
    ensureOriginCity,
    isDetecting,
  } = useDeviceOriginCity()

  const keyboardInset = useKeyboardBottomInset()
  const isKeyboardOpen = keyboardInset > 0

  const tabBarClearance = tabInsets.tabBarHeight
  const footerSurfaceColor = theme.tabBar
  const safeBottomInset = Math.max(tabInsets.insets.bottom, Platform.OS === 'android' ? spacing.sm : 0)
  const composerShellPadBottom = isKeyboardOpen
    ? keyboardInset + CHAT_KEYBOARD_GAP + safeBottomInset
    : tabBarClearance

  const listPadX = horizontalPadding

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  const sendMessage = useCallback(
    async (text: string, options?: { speakReply?: boolean }) => {
      const trimmed = text.trim()
      if ((!trimmed && !pendingAttachments.length) || isSending) return

      if (isOffline) {
        setError(
          'You are offline. Connect to the internet to chat with the agent and save trips to your account.',
        )
        return
      }

      const storedOrigin = (await loadStoredOriginCity())?.trim() ?? ''
      const resolvedOriginCity =
        originCity.trim() || storedOrigin || (await ensureOriginCity())

      if (options?.speakReply) shouldSpeakRef.current = true

      setError(null)
      setWarning(null)
      setIsSending(true)

      const attachmentNote = pendingAttachments.length
        ? `\n[Attachments: ${pendingAttachments.map((a) => `${a.name}: ${a.url}`).join(', ')}]`
        : ''

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: (trimmed || 'See attachments') + attachmentNote,
        timestamp: formatTime(),
        attachments: [...pendingAttachments],
      }

      const startingFreshChat = isFreshChatRef.current
      if (startingFreshChat) isFreshChatRef.current = false

      const outboundConversationId = startingFreshChat
        ? undefined
        : conversationIdRef.current

      if (!outboundConversationId && trimmed) {
        setConversationTitle(deriveChatTitle(trimmed))
      }

      const history = startingFreshChat ? [] : toHistory(messages)
      const assistantId = `assistant-${Date.now()}`
      const attachmentsToSend = [...pendingAttachments]

      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: formatTime(),
          streaming: true,
        },
      ])
      setInput('')
      setPendingAttachments([])
      scrollToEnd()

      const tripContext = buildTripContextForChat({
        message: trimmed,
        originCity: resolvedOriginCity,
        history,
        conversationId: outboundConversationId,
      })

      if (__DEV__) {
        console.warn('[chat-persist] client tripContext send', {
          startDate: tripContext?.startDate ?? null,
          endDate: tripContext?.endDate ?? null,
          tripDurationDays: tripContext?.tripDurationDays ?? null,
          origin: tripContext?.origin ?? null,
          destination: tripContext?.destination ?? null,
        })
      }

      await sendChatWithStream(
        {
          message: (trimmed || 'Please review my attachments for trip planning.') + attachmentNote,
          history,
          conversationId: outboundConversationId,
          tripId: params.tripId,
          attachments: attachmentsToSend,
          tripContext,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: stripRawToolMarkupFromReply(m.content + delta),
                      streaming: true,
                    }
                  : m,
              ),
            )
            scrollToEnd()
          },
          onDone: async ({ reply, conversationId: newConvId, title, warning: w, openTripId, effects }) => {
            const resolvedConvId = newConvId ?? conversationIdRef.current
            if (newConvId) setActiveConversationId(newConvId)
            const resolvedTitle = title ?? conversationTitle
            if (title) setConversationTitle(title)
            if (w) setWarning(w)

            let resolvedReply = reconcileClientTripPersistReply(
              reply,
              effects,
              tripContext?.destination,
            )
            let resolvedOpenTripId = openTripId
            const persistedTripId = primaryTripIdFromEffects(effects)

            if (chatEffectsMutateTrips(effects)) {
              await queryClient.refetchQueries({ queryKey: tripKeys.all })
              void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
            } else if (__DEV__ && tripContext?.destination) {
              console.warn('[chat-persist] no trip effects in response', {
                destination: tripContext.destination,
                origin: tripContext.origin,
                startDate: tripContext.startDate,
                endDate: tripContext.endDate,
                effects: effects?.map((e) => e.type),
              })
            }

            if (persistedTripId) {
              const trip =
                (await fetchTripById(persistedTripId)) ??
                queryClient
                  .getQueryData<TripRow[]>(tripKeys.list())
                  ?.find((t) => t.id === persistedTripId)
              if (!trip) {
                resolvedReply = TRIP_SAVE_FAILURE_REPLY
                resolvedOpenTripId = undefined
                setError('Trip could not be saved. Please try again.')
              }
            }

            const deletedTripId = effects?.find(
              (e) => e.type === 'delete_trip' && e.tripId,
            )?.tripId
            if (deletedTripId) {
              const stillExists = await fetchTripById(deletedTripId)
              if (stillExists) {
                resolvedReply = TRIP_DELETE_FAILURE_REPLY
                setError('Trip could not be deleted. Please try again.')
              }
            }

            const deletedActiveTrip = effects?.some(
              (effect) =>
                effect.type === 'delete_trip' &&
                params.tripId &&
                effect.tripId === params.tripId,
            )
            if (deletedActiveTrip) {
              router.replace('/(tabs)/chat' as never)
            }
            setMessages((prev) => {
              const next = prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: resolvedReply, streaming: false }
                  : m,
              )
              if (resolvedConvId) {
                void saveChatSessionCache({
                  conversationId: resolvedConvId,
                  title: resolvedTitle,
                  messages: next,
                  tripId: params.tripId,
                  updatedAt: new Date().toISOString(),
                })
              }
              return next
            })
            setIsSending(false)
            scrollToEnd()
            if (shouldSpeakRef.current && resolvedReply.trim()) {
              shouldSpeakRef.current = false
              void speakReplyRef.current(resolvedReply)
            }
            if (resolvedOpenTripId && !deletedActiveTrip) {
              router.push('/(tabs)/trips' as never)
            }
          },
          onError: (msg) => {
            const isRateLimit =
              /rate limit|429|tokens per minute|briefly busy|tool call validation/i.test(
                msg,
              ) || /try again in [\d.]+s/i.test(msg)
            if (isRateLimit) {
              setWarning('Still planning your trip — one moment, then try sending again.')
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          'Still working on your trip plan — please wait a moment and tap send again.',
                        streaming: false,
                      }
                    : m,
                ),
              )
            } else {
              setError(msg)
              setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            }
            setIsSending(false)
            shouldSpeakRef.current = false
          },
          onWarning: (msg) => setWarning(msg),
        },
      )
    },
    [
      setActiveConversationId,
      isSending,
      messages,
      isOffline,
      params.tripId,
      ensureOriginCity,
      originCity,
      pendingAttachments,
      queryClient,
      router,
      scrollToEnd,
      conversationTitle,
    ],
  )

  const voice = useVoiceAssistant({
    onTranscript: async (text) => {
      await sendMessage(text, { speakReply: true })
    },
    onError: (msg) => setError(msg),
  })

  useEffect(() => {
    speakReplyRef.current = voice.speakReply
  }, [voice.speakReply])

  const reloadChatHistory = useCallback(async () => {
    if (isFreshChatRef.current) return

    const loadGen = chatLoadGenerationRef.current

    const cached = await loadChatSessionCache({
      conversationId: params.conversationId,
      tripId: params.tripId,
    })
    if (loadGen !== chatLoadGenerationRef.current) return
    if (isFreshChatRef.current) return

    if (cached) {
      setMessages(
        cached.messages.map((m) =>
          m.role === 'assistant'
            ? { ...m, content: stripRawToolMarkupFromReply(m.content) }
            : m,
        ),
      )
      setActiveConversationId(cached.conversationId)
      setConversationTitle(cached.title)
    }

    if (isOffline) return

    const convId =
      params.conversationId ??
      cached?.conversationId ??
      (await fetchLatestConversation(params.tripId))?.id
    if (loadGen !== chatLoadGenerationRef.current) return
    if (isFreshChatRef.current) return
    if (!convId) return

    const [conv, rows] = await Promise.all([
      fetchConversationById(convId),
      fetchConversationMessages(convId),
    ])
    if (loadGen !== chatLoadGenerationRef.current) return
    if (isFreshChatRef.current) return

    const nextMessages = rows
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .map((r) => ({
        id: r.id,
        role: r.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content:
          r.role === 'assistant'
            ? stripRawToolMarkupFromReply(r.content)
            : r.content,
        timestamp: formatTime(new Date(r.created_at)),
        attachments: r.attachments,
      }))
    setMessages(nextMessages)
    setActiveConversationId(convId)
    const title = conv?.title ?? DEFAULT_HEADER_TITLE
    if (conv?.title) setConversationTitle(title)

    await saveChatSessionCache({
      conversationId: convId,
      title,
      messages: nextMessages,
      tripId: params.tripId,
      updatedAt: new Date().toISOString(),
    })
  }, [isOffline, params.conversationId, params.tripId, setActiveConversationId])

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    try {
      setError(null)
      await reloadChatHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh chat')
    }
  })

  useEffect(() => {
    void reloadChatHistory().catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not load history')
    })
  }, [reloadChatHistory, user?.id])

  useEffect(() => {
    if (keyboardInset > 0) {
      scrollToEnd()
    }
  }, [keyboardInset, scrollToEnd])

  const handleNewChat = useCallback(async () => {
    chatLoadGenerationRef.current += 1
    isFreshChatRef.current = true
    conversationIdRef.current = undefined
    setMessages([])
    setActiveConversationId(undefined)
    setConversationTitle(DEFAULT_HEADER_TITLE)
    setInput('')
    setPendingAttachments([])
    setError(null)
    setWarning(null)
    setIsSending(false)
    void clearLatestChatSessionPointer(params.tripId)
    await voice.interrupt()
  }, [params.tripId, setActiveConversationId, voice])

  const pickAttachment = async () => {
    if (!user) {
      setError('Sign in to attach files')
      return
    }
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
    if (result.canceled) return
    const file = result.assets[0]
    try {
      const url = await uploadChatAttachment(
        user.id,
        file.uri,
        file.name,
        file.mimeType ?? 'application/octet-stream',
      )
      setPendingAttachments((prev) => [
        ...prev,
        { url, name: file.name, type: file.mimeType ?? 'file' },
      ])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url))
  }

  const canSend =
    (input.trim().length > 0 || pendingAttachments.length > 0) &&
    !isSending &&
    !voice.isBusy

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1 }}>
        <ChatHeader
          title={conversationTitle}
          subtitle={
            messages.length === 0
              ? 'Live weather · hotels · itineraries'
              : `${messages.length} message${messages.length === 1 ? '' : 's'}`
          }
          onNewChat={() => void handleNewChat()}
          disabled={isSending || voice.isBusy}
        />

        {error ? (
          <View
            style={{
              marginHorizontal: listPadX,
              marginTop: 8,
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: `${brand.danger}15`,
              borderWidth: 1,
              borderColor: `${brand.danger}40`,
            }}
          >
            <Text style={{ color: brand.danger, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {warning ? (
          <View
            style={{
              marginHorizontal: listPadX,
              marginTop: 8,
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: `${brand.warning}15`,
              borderWidth: 1,
              borderColor: `${brand.warning}40`,
            }}
          >
            <Text style={{ color: brand.warning, fontSize: 13 }}>{warning}</Text>
          </View>
        ) : null}

        {pendingAttachments.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              margin: 12,
              marginHorizontal: listPadX,
            }}
          >
            {pendingAttachments.map((a) => (
              <View
                key={a.url}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: radii.md,
                  padding: 8,
                }}
              >
                {a.type.startsWith('image/') ? (
                  <Image source={{ uri: a.url }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                ) : (
                  <Paperclip size={18} color={brand.primaryDark} />
                )}
                <Text
                  style={{ color: theme.colors.textMuted, fontSize: 12, maxWidth: 80, marginLeft: 8 }}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
                <Pressable onPress={() => removeAttachment(a.url)} style={{ marginLeft: 8, padding: 4 }}>
                  <X size={14} color={theme.colors.icon} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: listPadX,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
              flexGrow: 1,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={brand.primaryDark}
                colors={[brand.primaryDark]}
              />
            }
            onContentSizeChange={scrollToEnd}
            ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: spacing.xl }}>
              <View
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  backgroundColor: theme.colors.aiMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Sparkles size={30} color={theme.isDark ? brand.ai : brand.primaryDark} />
              </View>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 20,
                  fontWeight: '700',
                  textAlign: 'center',
                  letterSpacing: -0.3,
                }}
              >
                Where should we go?
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  textAlign: 'center',
                  marginTop: spacing.sm + 2,
                  lineHeight: 22,
                  fontSize: 15,
                  maxWidth: 300,
                }}
              >
                Ask about destinations, budgets, or day-by-day plans. Tap the mic for voice chat
                with spoken replies.
              </Text>
              <Pressable
                onPress={() =>
                  setInput('5 days in Goa in August, 2 people, ₹50000 budget, from Delhi.')
                }
                style={({ pressed }) => ({
                  marginTop: spacing.lg,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radii.pill,
                  backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                })}
              >
                <Text
                  style={{
                    color: theme.isDark ? '#93C5FD' : brand.primaryDark,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  Try a sample prompt
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <ChatBubble
                message={item.content}
                role={item.role}
                timestamp={item.timestamp}
                streaming={item.streaming}
              />
              {item.attachments?.map((a) =>
                a.type.startsWith('image/') ? (
                  <Image
                    key={a.url}
                    source={{ uri: a.url }}
                    style={{
                      width: 160,
                      height: 112,
                      borderRadius: radii.md,
                      marginTop: 4,
                      marginBottom: 12,
                      alignSelf: 'flex-end',
                    }}
                  />
                ) : null,
              )}
            </View>
          )}
          />

          <View
            style={{
              backgroundColor: footerSurfaceColor,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.tabBarBorder,
              paddingBottom: composerShellPadBottom,
            }}
          >
            {!originBarDismissed ? (
              <OriginCityBar
                originCity={originCity}
                onChangeOriginCity={setOriginCity}
                status={originStatus}
                needsManualEntry={needsManualEntry}
                isDetecting={isDetecting}
                onRetryDetection={() => void retryDetection()}
                onDismiss={() => setOriginBarDismissed(true)}
                horizontalPadding={listPadX}
                backgroundColor={footerSurfaceColor}
              />
            ) : null}

            <ChatComposer
              embedded
              input={input}
              onChangeText={setInput}
              onSend={() => void sendMessage(input)}
              onPickAttachment={() => void pickAttachment()}
              onToggleVoice={() => void voice.toggleRecording()}
              onStopVoice={() => void stopSpeaking().then(() => voice.interrupt())}
              canSend={canSend}
              isSending={isSending}
              voicePhase={voice.phase}
              paddingBottom={0}
            />
          </View>
        </View>
      </View>
    </View>
  )
}
