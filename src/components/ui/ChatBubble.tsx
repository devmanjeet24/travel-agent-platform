import { ActivityIndicator, Text, View } from 'react-native'

import { brand } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  message: string
  role: 'user' | 'assistant'
  timestamp?: string
  streaming?: boolean
}

export function ChatBubble({ message, role, timestamp, streaming }: Props) {
  const theme = useThemedStyles()
  const isUser = role === 'user'

  return (
    <View
      style={{
        marginBottom: 14,
        maxWidth: '88%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
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
        {streaming && !message ? (
          <ActivityIndicator size="small" color={brand.primaryDark} />
        ) : (
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: isUser ? brand.onPrimary : theme.colors.text,
            }}
          >
            {message}
          </Text>
        )}
      </View>
      {timestamp ? (
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
