import { Text, View } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  message: string
  role: 'user' | 'assistant'
  timestamp?: string
}

export function ChatBubble({ message, role, timestamp }: Props) {
  const theme = useThemedStyles()
  const isUser = role === 'user'

  return (
    <View
      className={`mb-4 max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
    >
      <View
        className={`rounded-3xl px-5 py-4 ${
          isUser
            ? 'bg-sky-500 rounded-br-md'
            : `${theme.bgCard} ${theme.border} border rounded-bl-md`
        }`}
      >
        <Text className={`text-base leading-6 ${isUser ? 'text-white' : theme.text}`}>
          {message}
        </Text>
      </View>
      {timestamp ? (
        <Text className={`${theme.textMuted} text-xs mt-1.5 px-1`}>
          {timestamp}
        </Text>
      ) : null}
    </View>
  )
}

export default ChatBubble
