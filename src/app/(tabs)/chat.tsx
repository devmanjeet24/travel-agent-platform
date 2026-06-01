import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { Paperclip, Sparkles, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
import { loadChatSessionCache, saveChatSessionCache } from '@/lib/chat-offline-cache'
import { useIsOffline } from '@/hooks/use-offline-sync'
import { useDeviceOriginCity } from '@/hooks/use-device-origin-city'
import { buildTripContextForChat } from '@/utils/build-trip-context'
import { deriveChatTitle } from '@/utils/chat-title'
import type { ChatAttachment, ChatHistoryItem, ChatMessage } from '@/services/chat'
import { uploadChatAttachment } from '@/services/travel/travel-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const DEFAULT_HEADER_TITLE = 'AI Travel Agent'

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const MAX_CLIENT_HISTORY_TURNS = 4
const MAX_CLIENT_HISTORY_CHARS = 600

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
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { horizontalPadding } = useResponsive()
  const tabInsets = useTabScreenInsets()
  const params = useLocalSearchParams<{ tripId?: string; conversationId?: string }>()
  const isOffline = useIsOffline()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const speakReplyRef = useRef<(reply: string) => Promise<void>>(async () => {})
  const shouldSpeakRef = useRef(false)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(params.conversationId)
  const [conversationTitle, setConversationTitle] = useState(DEFAULT_HEADER_TITLE)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [originBarDismissed, setOriginBarDismissed] = useState(false)
  const {
    originCity,
    setOriginCity,
    status: originStatus,
    needsManualEntry,
    retryDetection,
    isDetecting,
  } = useDeviceOriginCity()

  const keyboardInset = useKeyboardBottomInset()
  const isKeyboardOpen = keyboardInset > 0
  const composerBottomPad =
    Platform.OS === 'android'
      ? isKeyboardOpen
        ? Math.max(keyboardInset, insets.bottom) + spacing.sm
        : tabInsets.composerBottomPadding
      : tabInsets.composerBottomPadding
  const keyboardOffset = Platform.OS === 'ios' ? tabBarHeight + insets.top : 0
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

      if (!conversationId && trimmed) {
        setConversationTitle(deriveChatTitle(trimmed))
      }

      const history = toHistory(messages)
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

      const tripContext = buildTripContextForChat({ message: trimmed, originCity })

      await sendChatWithStream(
        {
          message: (trimmed || 'Please review my attachments for trip planning.') + attachmentNote,
          history,
          conversationId,
          tripId: params.tripId,
          attachments: attachmentsToSend,
          tripContext,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + delta, streaming: true }
                  : m,
              ),
            )
            scrollToEnd()
          },
          onDone: ({ reply, conversationId: newConvId, title, warning: w, openTripId }) => {
            const resolvedConvId = newConvId ?? conversationId
            if (newConvId) setConversationId(newConvId)
            const resolvedTitle = title ?? conversationTitle
            if (title) setConversationTitle(title)
            if (w) setWarning(w)
            setMessages((prev) => {
              const next = prev.map((m) =>
                m.id === assistantId ? { ...m, content: reply, streaming: false } : m,
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
            if (shouldSpeakRef.current && reply.trim()) {
              shouldSpeakRef.current = false
              void speakReplyRef.current(reply)
            }
            if (openTripId) {
              router.push(`/trip/${openTripId}` as never)
            }
          },
          onError: (msg) => {
            setError(msg)
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            setIsSending(false)
            shouldSpeakRef.current = false
          },
          onWarning: (msg) => setWarning(msg),
        },
      )
    },
    [
      conversationId,
      isSending,
      messages,
      params.tripId,
      originCity,
      pendingAttachments,
      router,
      scrollToEnd,
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

  useEffect(() => {
    void (async () => {
      const cached = await loadChatSessionCache({
        conversationId: params.conversationId,
        tripId: params.tripId,
      })
      if (cached) {
        setMessages(cached.messages)
        setConversationId(cached.conversationId)
        setConversationTitle(cached.title)
      }

      if (isOffline) return

      try {
        const convId =
          params.conversationId ??
          cached?.conversationId ??
          (await fetchLatestConversation(params.tripId))?.id
        if (!convId) return

        const [conv, rows] = await Promise.all([
          fetchConversationById(convId),
          fetchConversationMessages(convId),
        ])
        const nextMessages = rows
          .filter((r) => r.role === 'user' || r.role === 'assistant')
          .map((r) => ({
            id: r.id,
            role: r.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: r.content,
            timestamp: formatTime(new Date(r.created_at)),
            attachments: r.attachments,
          }))
        setMessages(nextMessages)
        setConversationId(convId)
        const title = conv?.title ?? DEFAULT_HEADER_TITLE
        if (conv?.title) setConversationTitle(title)

        await saveChatSessionCache({
          conversationId: convId,
          title,
          messages: nextMessages,
          tripId: params.tripId,
          updatedAt: new Date().toISOString(),
        })
      } catch (e) {
        if (!cached) {
          setError(e instanceof Error ? e.message : 'Could not load history')
        }
      }
    })()
  }, [params.conversationId, params.tripId, user?.id, isOffline])

  const handleNewChat = useCallback(async () => {
    await voice.interrupt()
    setMessages([])
    setConversationId(undefined)
    setConversationTitle(DEFAULT_HEADER_TITLE)
    setInput('')
    setPendingAttachments([])
    setError(null)
    setWarning(null)
    setIsSending(false)
  }, [voice])

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
        enabled={Platform.OS === 'ios'}
      >
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

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: listPadX,
            paddingTop: spacing.md,
            paddingBottom:
              spacing.lg +
              (Platform.OS === 'android' && isKeyboardOpen
                ? keyboardInset + 72
                : tabInsets.composerBottomPadding * 0.35),
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
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
          />
        ) : null}

        <ChatComposer
          input={input}
          onChangeText={setInput}
          onSend={() => void sendMessage(input)}
          onPickAttachment={() => void pickAttachment()}
          onToggleVoice={() => void voice.toggleRecording()}
          onStopVoice={() => void stopSpeaking().then(() => voice.interrupt())}
          canSend={canSend}
          isSending={isSending}
          voicePhase={voice.phase}
          paddingBottom={composerBottomPad}
        />
      </KeyboardAvoidingView>
    </View>
  )
}
