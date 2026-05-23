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
import { useLocalSearchParams } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Paperclip, Sparkles, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChatComposer } from '@/components/chat/ChatComposer'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatBubble } from '@/components/ui/ChatBubble'
import { brand } from '@/constants/design'
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
import { parseTripContextFromMessage } from '@/utils/trip-context-parse'
import { deriveChatTitle } from '@/utils/chat-title'
import type { ChatAttachment, ChatHistoryItem, ChatMessage } from '@/services/chat'
import { uploadChatAttachment } from '@/services/travel/travel-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const DEFAULT_HEADER_TITLE = 'AI Travel Agent'

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function toHistory(messages: ChatMessage[]): ChatHistoryItem[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map(({ role, content }) => ({ role, content }))
}

export default function ChatScreen() {
  const theme = useThemedStyles()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { horizontalPadding, contentWidth } = useResponsive()
  const tabInsets = useTabScreenInsets()
  const params = useLocalSearchParams<{ tripId?: string; conversationId?: string }>()
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

  const keyboardInset = useKeyboardBottomInset()
  const composerBottomPad =
    Platform.OS === 'android'
      ? tabInsets.composerBottomPadding + keyboardInset
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

      const tripContext = parseTripContextFromMessage(trimmed)

      await sendChatWithStream(
        {
          message: (trimmed || 'Please review my attachments for trip planning.') + attachmentNote,
          history,
          conversationId,
          tripId: params.tripId,
          attachments: attachmentsToSend,
          tripContext: Object.keys(tripContext).length ? tripContext : undefined,
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
          onDone: ({ reply, conversationId: newConvId, title, warning: w }) => {
            if (newConvId) setConversationId(newConvId)
            if (title) setConversationTitle(title)
            if (w) setWarning(w)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: reply, streaming: false } : m,
              ),
            )
            setIsSending(false)
            scrollToEnd()
            if (shouldSpeakRef.current && reply.trim()) {
              shouldSpeakRef.current = false
              void speakReplyRef.current(reply)
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
      pendingAttachments,
      scrollToEnd,
    ],
  )

  const voice = useVoiceAssistant({
    onTranscript: async (text) => {
      await sendMessage(text, { speakReply: true })
    },
    onError: (msg) => setError(msg),
  })

  speakReplyRef.current = voice.speakReply

  useEffect(() => {
    void (async () => {
      try {
        const convId = params.conversationId ?? (await fetchLatestConversation())?.id
        if (!convId) return

        const [conv, rows] = await Promise.all([
          fetchConversationById(convId),
          fetchConversationMessages(convId),
        ])
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role === 'assistant' ? 'assistant' : 'user',
            content: r.content,
            timestamp: formatTime(new Date(r.created_at)),
            attachments: r.attachments,
          })),
        )
        setConversationId(convId)
        if (conv?.title) setConversationTitle(conv.title)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load history')
      }
    })()
  }, [params.conversationId, user?.id])

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

  const pickImage = async () => {
    if (!user) {
      setError('Sign in to attach images')
      return
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setError('Photo library permission is required')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    try {
      const url = await uploadChatAttachment(user.id, asset.uri, `photo.${ext}`, mime)
      setPendingAttachments((prev) => [...prev, { url, name: `photo.${ext}`, type: mime }])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed')
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
            paddingTop: 16,
            paddingBottom: 12 + (Platform.OS === 'android' ? keyboardInset : 0),
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 56, paddingHorizontal: 28 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: brand.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Sparkles size={32} color={brand.primaryDark} />
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
                  marginTop: 10,
                  lineHeight: 24,
                  fontSize: 15,
                }}
              >
                Ask about destinations, budgets, or day-by-day plans. Tap the mic for a voice
                conversation with spoken replies.
              </Text>
              <Pressable
                onPress={() =>
                  setInput('5 days in Goa in August, 2 people, ₹50000 budget, from Delhi.')
                }
                style={{
                  marginTop: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: radii.pill,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text style={{ color: brand.primaryDark, fontSize: 14, fontWeight: '600' }}>
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

        <ChatComposer
          input={input}
          onChangeText={setInput}
          onSend={() => void sendMessage(input)}
          onPickAttachment={() => void pickAttachment()}
          onPickImage={() => void pickImage()}
          onToggleVoice={() => void voice.toggleRecording()}
          onStopVoice={() => void stopSpeaking().then(() => voice.interrupt())}
          canSend={canSend}
          isSending={isSending}
          voicePhase={voice.phase}
          paddingHorizontal={listPadX}
          paddingBottom={composerBottomPad}
          contentWidth={contentWidth}
        />
      </KeyboardAvoidingView>
    </View>
  )
}
