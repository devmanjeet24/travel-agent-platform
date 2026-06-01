import { Text, View } from 'react-native'
import Markdown from 'react-native-markdown-display'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
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
    heading1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, color: theme.colors.text },
    heading2: { fontSize: 18, fontWeight: '700' as const, marginBottom: 6, color: theme.colors.text },
    strong: { fontWeight: '700' as const, color: theme.colors.text },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    link: { color: brand.primaryDark },
    code_inline: {
      backgroundColor: theme.colors.muted,
      color: theme.colors.text,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    fence: {
      backgroundColor: theme.colors.muted,
      color: theme.colors.text,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: radii.sm,
      padding: spacing.sm,
      marginVertical: spacing.sm,
    },
  }

  return (
    <View
      style={{
        marginBottom: spacing.md,
        maxWidth: isUser ? '86%' : '94%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {showTyping ? (
        <TypingIndicator />
      ) : (
        <View
          style={{
            borderRadius: radii.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: isUser ? brand.primaryDark : theme.colors.card,
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.colors.border,
            borderBottomRightRadius: isUser ? radii.xs : radii.lg,
            borderBottomLeftRadius: isUser ? radii.lg : radii.xs,
          }}
        >
          {isUser ? (
            <Text
              style={{
                ...typography.body,
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
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: brand.ai,
                marginTop: spacing.sm,
                opacity: 0.7,
              }}
            />
          ) : null}
        </View>
      )}
      {timestamp && !showTyping ? (
        <Text
          style={{
            ...typography.caption,
            color: theme.colors.textMuted,
            marginTop: spacing.xs,
            paddingHorizontal: spacing.xs,
          }}
        >
          {timestamp}
        </Text>
      ) : null}
    </View>
  )
}

export default ChatBubble
