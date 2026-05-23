import { Text, View } from 'react-native'
import Markdown from 'react-native-markdown-display'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { TypingIndicator } from '@/components/chat/TypingIndicator'

interface Props {
  message: string
  role: 'user' | 'assistant'
  timestamp?: string
  streaming?: boolean
}

export function ChatBubble({ message, role, timestamp, streaming }: Props) {
  const theme = useThemedStyles()
  const isUser = role === 'user'
  const showTyping = streaming && !message.trim()

  const markdownStyles = {
    body: {
      color: theme.colors.text,
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8 },
    heading2: { fontSize: 18, fontWeight: '700' as const, marginBottom: 6 },
    strong: { fontWeight: '700' as const },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    link: { color: brand.primaryDark },
  }

  return (
    <View
      style={{
        marginBottom: 14,
        maxWidth: isUser ? '84%' : '92%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {showTyping ? (
        <TypingIndicator />
      ) : (
        <View
          style={{
            borderRadius: radii.xl,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isUser ? brand.primaryDark : theme.colors.card,
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.colors.border,
            borderBottomRightRadius: isUser ? radii.sm : radii.xl,
            borderBottomLeftRadius: isUser ? radii.xl : radii.sm,
          }}
        >
          {isUser ? (
            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: brand.onPrimary,
              }}
            >
              {message}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{message}</Markdown>
          )}
          {streaming && message ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: brand.primaryDark,
                marginTop: 8,
                opacity: 0.6,
              }}
            />
          ) : null}
        </View>
      )}
      {timestamp && !showTyping ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 11,
            marginTop: 6,
            paddingHorizontal: 4,
          }}
        >
          {timestamp}
        </Text>
      ) : null}
    </View>
  )
}

export default ChatBubble
