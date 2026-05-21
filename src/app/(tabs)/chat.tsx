import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useLocalSearchParams } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Image as ImageIcon, Mic, Paperclip, Send, Sparkles, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChatBubble } from '@/components/ui/ChatBubble'
import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { useTabScreenInsets } from '@/hooks/use-tab-screen-insets'
import { cardShadow, radii } from '@/lib/ui-styles'
import { sendChatWithStream } from '@/lib/edge-fetch'
import { createVoiceRecorder } from '@/lib/voice-recording'
import {
  fetchConversationMessages,
  fetchLatestConversation,
} from '@/services/chat/chat-db'
import { parseTripContextFromMessage } from '@/utils/trip-context-parse'
import type { ChatAttachment, ChatHistoryItem, ChatMessage } from '@/services/chat'
import { transcribeFromUri } from '@/lib/voice-recording'
import { uploadChatAttachment } from '@/services/travel/travel-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'

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
  const { horizontalPadding, scaleFont, contentWidth, isSmallPhone } = useResponsive()
  const tabInsets = useTabScreenInsets()
  const params = useLocalSearchParams<{ tripId?: string; conversationId?: string }>()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const voiceRecorderRef = useRef<Awaited<ReturnType<typeof createVoiceRecorder>> | null>(null)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(params.conversationId)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])

  const composerBottomPad = tabInsets.composerBottomPadding
  const keyboardOffset =
    Platform.OS === 'ios' ? tabBarHeight + insets.top : Platform.OS === 'android' ? 0 : 0
  const listPadX = horizontalPadding

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const convId = params.conversationId ?? (await fetchLatestConversation())?.id
        if (!convId) return

        const rows = await fetchConversationMessages(convId)
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load history')
      }
    })()
  }, [params.conversationId, user?.id])

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !pendingAttachments.length) || isSending) return

    setError(null)
    setWarning(null)
    setIsSending(true)

    const attachmentNote = pendingAttachments.length
      ? `\n[Attachments: ${pendingAttachments.map((a) => `${a.name}: ${a.url}`).join(', ')}]`
      : ''

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: (text || 'See attachments') + attachmentNote,
      timestamp: formatTime(),
      attachments: [...pendingAttachments],
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

    const tripContext = parseTripContextFromMessage(text)

    await sendChatWithStream(
      {
        message: (text || 'Please review my attachments for trip planning.') + attachmentNote,
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
        onDone: ({ reply, conversationId: newConvId, warning: w }) => {
          if (newConvId) setConversationId(newConvId)
          if (w) setWarning(w)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: reply, streaming: false } : m,
            ),
          )
          setIsSending(false)
          scrollToEnd()
        },
        onError: (msg) => {
          setError(msg)
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          setIsSending(false)
        },
        onWarning: (msg) => setWarning(msg),
      },
    )
  }

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

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false)
      try {
        const rec = voiceRecorderRef.current
        const uri = rec ? await rec.stop() : null
        voiceRecorderRef.current = null
        if (!uri) return
        setIsSending(true)
        const text = await transcribeFromUri(uri)
        if (text) setInput((prev) => (prev ? `${prev} ${text}` : text))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transcription failed')
      } finally {
        setIsSending(false)
      }
      return
    }

    try {
      voiceRecorderRef.current = await createVoiceRecorder()
      await voiceRecorderRef.current.start()
      setIsRecording(true)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording')
    }
  }

  const removeAttachment = (url: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.url !== url))
  }

  const canSend = (input.trim().length > 0 || pendingAttachments.length > 0) && !isSending

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View
          style={{
            paddingTop: Platform.OS === 'android' ? 8 : insets.top + 8,
            paddingHorizontal: listPadX,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: brand.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} color={brand.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: scaleFont(18),
                  fontWeight: '800',
                }}
              >
                AI Travel Agent
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: scaleFont(13),
                  marginTop: 2,
                }}
              >
                Live weather · hotels · itineraries
              </Text>
            </View>
          </View>
        </View>

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
            paddingTop: 12,
            paddingBottom: 16,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: brand.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Sparkles size={32} color={brand.primaryDark} />
              </View>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                Start planning your trip
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 22,
                  fontSize: 15,
                }}
              >
                Try: &quot;5 days in Bali in August, 2 people, $3000 budget, flying from Delhi.&quot;
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <ChatBubble
                message={item.content || (item.streaming ? '…' : '')}
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
            paddingHorizontal: listPadX,
            paddingTop: 10,
            paddingBottom: composerBottomPad,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          }}
        >
          <View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'flex-end',
                backgroundColor: theme.colors.card,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: theme.colors.border,
                paddingHorizontal: 8,
                paddingVertical: 8,
                maxWidth: contentWidth,
                alignSelf: 'center',
                width: '100%',
              },
              cardShadow(theme.isDark),
            ]}
          >
            <Pressable style={{ padding: isSmallPhone ? 8 : 10 }} onPress={pickAttachment}>
              <Paperclip size={isSmallPhone ? 20 : 22} color={theme.colors.icon} />
            </Pressable>
            <Pressable style={{ padding: isSmallPhone ? 8 : 10 }} onPress={pickImage}>
              <ImageIcon size={isSmallPhone ? 20 : 22} color={brand.primaryDark} />
            </Pressable>
            <TextInput
              placeholder="Message your travel agent..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={input}
              onChangeText={setInput}
              editable={!isSending}
              onSubmitEditing={() => {
                if (canSend) void handleSend()
              }}
              blurOnSubmit={false}
              style={{
                flex: 1,
                color: theme.colors.text,
                fontSize: scaleFont(16),
                lineHeight: 22,
                maxHeight: 120,
                paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                paddingHorizontal: 4,
              }}
            />
            <Pressable
              style={{
                padding: 10,
                borderRadius: radii.pill,
                backgroundColor: isRecording ? `${brand.danger}18` : 'transparent',
              }}
              onPress={toggleRecording}
              disabled={isSending}
            >
              <Mic size={22} color={isRecording ? brand.danger : brand.primaryDark} />
            </Pressable>
            <Pressable
              onPress={() => void handleSend()}
              disabled={!canSend}
              style={{
                width: isSmallPhone ? 40 : 44,
                height: isSmallPhone ? 40 : 44,
                borderRadius: isSmallPhone ? 20 : 22,
                backgroundColor: canSend ? brand.primaryDark : theme.colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 4,
              }}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={brand.onPrimary} />
              ) : (
                <Send size={20} color={canSend ? brand.onPrimary : theme.colors.icon} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}
