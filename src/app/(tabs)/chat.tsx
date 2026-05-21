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
import { useLocalSearchParams } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Image as ImageIcon, Mic, Paperclip, Send, X } from 'lucide-react-native'

import { ChatBubble } from '@/components/ui/ChatBubble'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
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
  const params = useLocalSearchParams<{ tripId?: string; conversationId?: string }>()
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const voiceRecorderRef = useRef<Awaited<ReturnType<typeof createVoiceRecorder>> | null>(
    null,
  )

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(
    params.conversationId,
  )
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const convId =
          params.conversationId ??
          (await fetchLatestConversation())?.id
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
              m.id === assistantId
                ? { ...m, content: reply, streaming: false }
                : m,
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
      const url = await uploadChatAttachment(
        user.id,
        asset.uri,
        `photo.${ext}`,
        mime,
      )
      setPendingAttachments((prev) => [
        ...prev,
        { url, name: `photo.${ext}`, type: mime },
      ])
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

  return (
    <ScreenWrapper padded={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View className="px-5 pt-2 pb-3">
          <Text className={`${theme.text} text-2xl font-bold`}>AI Travel Agent</Text>
          <Text className={`${theme.textMuted} text-sm mt-0.5`}>
            Open-Meteo weather · OSM hotels · streaming · voice · saved history
          </Text>
        </View>

        {error ? (
          <View className="mx-5 mb-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30">
            <Text className="text-red-500 text-sm">{error}</Text>
          </View>
        ) : null}

        {warning ? (
          <View className="mx-5 mb-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <Text className="text-amber-600 text-sm">{warning}</Text>
          </View>
        ) : null}

        {pendingAttachments.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mx-5 mb-2">
            {pendingAttachments.map((a) => (
              <View
                key={a.url}
                className={`${theme.bgCard} border ${theme.border} rounded-xl p-2 flex-row items-center`}
              >
                {a.type.startsWith('image/') ? (
                  <Image source={{ uri: a.url }} className="w-10 h-10 rounded-lg mr-2" />
                ) : (
                  <Paperclip size={18} color="#0EA5E9" />
                )}
                <Text className={`${theme.textMuted} text-xs max-w-[100px]`} numberOfLines={1}>
                  {a.name}
                </Text>
                <Pressable onPress={() => removeAttachment(a.url)} className="ml-2 p-1">
                  <X size={14} color="#94A3B8" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          className="flex-1"
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-4 grow"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <Text className={`${theme.textMuted} text-center mt-8 px-4 leading-6`}>
              Plan a trip with live data — e.g. &quot;5 days in Bali in August, 2 people,
              $3000 budget, flying from Delhi.&quot;
            </Text>
          }
          renderItem={({ item }) => (
            <View>
              <ChatBubble
                message={item.content || (item.streaming ? '…' : '')}
                role={item.role}
                timestamp={item.timestamp}
              />
              {item.attachments?.length
                ? item.attachments.map((a) =>
                    a.type.startsWith('image/') ? (
                      <Image
                        key={a.url}
                        source={{ uri: a.url }}
                        className="w-40 h-28 rounded-xl mt-1 mb-3 self-end"
                      />
                    ) : null,
                  )
                : null}
            </View>
          )}
        />

        <View className={`px-5 pb-4 pt-2 border-t ${theme.border}`}>
          <View
            className={`${theme.bgCard} ${theme.border} border rounded-3xl px-4 py-3 flex-row items-end gap-2`}
          >
            <Pressable className="p-2" onPress={pickAttachment} accessibilityLabel="Attach file">
              <Paperclip size={22} color={theme.isDark ? '#94A3B8' : '#64748B'} />
            </Pressable>
            <Pressable className="p-2" onPress={pickImage} accessibilityLabel="Attach image">
              <ImageIcon size={22} color="#0EA5E9" />
            </Pressable>
            <TextInput
              placeholder="Describe your trip..."
              placeholderTextColor={theme.isDark ? '#94A3B8' : '#64748B'}
              multiline
              value={input}
              onChangeText={setInput}
              editable={!isSending}
              className={`flex-1 ${theme.text} text-base max-h-28 py-2`}
            />
            <Pressable
              className={`p-2 ${isRecording ? 'bg-red-500/20 rounded-full' : ''}`}
              onPress={toggleRecording}
              disabled={isSending}
              accessibilityLabel="Voice input"
            >
              <Mic size={22} color={isRecording ? '#EF4444' : '#0EA5E9'} />
            </Pressable>
            <Pressable
              className={`bg-sky-500 p-2.5 rounded-full ${!input.trim() && !pendingAttachments.length ? 'opacity-50' : ''}`}
              onPress={handleSend}
              disabled={(!input.trim() && !pendingAttachments.length) || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}
