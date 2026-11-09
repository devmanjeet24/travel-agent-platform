import { Text, View } from 'react-native'
import Markdown from 'react-native-markdown-display'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
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
  const { isSmallPhone } = useResponsive()
  const isUser = role === 'user'
  const showTyping = streaming && !message.trim()

  const userBubbleBg = theme.isDark ? brand.primary : brand.primaryDark

  const markdownStyles = {
    body: {
      color: theme.colors.text,
      fontSize: isSmallPhone ? 15 : 16,
      lineHeight: isSmallPhone ? 22 : 24,
    },
    heading1: {
      fontSize: 20,
      fontWeight: '700' as const,
      marginBottom: 8,
      color: theme.colors.text,
    },
    heading2: {
      fontSize: 18,
      fontWeight: '700' as const,
      marginBottom: 6,
      color: theme.colors.text,
    },
    strong: { fontWeight: '700' as const, color: theme.colors.text },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    link: { color: theme.isDark ? '#93C5FD' : brand.primaryDark },
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
        maxWidth: isUser ? (isSmallPhone ? '88%' : '86%') : isSmallPhone ? '96%' : '94%',
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
            paddingHorizontal: isSmallPhone ? spacing.md : spacing.lg,
            paddingVertical: isSmallPhone ? spacing.sm + 2 : spacing.md,
            backgroundColor: isUser ? userBubbleBg : theme.colors.card,
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.colors.border,
            borderBottomRightRadius: isUser ? radii.xs : radii.lg,
            borderBottomLeftRadius: isUser ? radii.lg : radii.xs,
            ...(isUser && !theme.isDark
              ? {
                  shadowColor: brand.primaryDark,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 3,
                  elevation: 2,
                }
              : {}),
          }}
        >
          {isUser ? (
            <Text
              style={{
                ...typography.body,
                fontSize: isSmallPhone ? 15 : 16,
                lineHeight: isSmallPhone ? 22 : 24,
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
            marginTop: 4,
            paddingHorizontal: spacing.xs,
            fontSize: 11,
          }}
        >
          {timestamp}
        </Text>
      ) : null}
    </View>
  )
}

export default ChatBubble
