import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Mic, Paperclip, RefreshCw, Send } from 'lucide-react-native'

import { ChatBubble } from '@/components/ui/ChatBubble'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const mockMessages = [
  {
    role: 'user' as const,
    message: 'Plan a 7-day trip to Bali for two people in August.',
    timestamp: '10:02 AM',
  },
  {
    role: 'assistant' as const,
    message:
      'Great choice! To tailor your itinerary, could you share your budget range and whether you prefer beaches, culture, or adventure?',
    timestamp: '10:02 AM',
  },
  {
    role: 'user' as const,
    message: 'Mid-range budget, mix of beach and culture.',
    timestamp: '10:03 AM',
  },
  {
    role: 'assistant' as const,
    message:
      'Perfect. I will search destinations, weather, and hotels — then generate your day-wise plan and budget.',
    timestamp: '10:03 AM',
  },
]

export default function ChatScreen() {
  const theme = useThemedStyles()

  return (
    <ScreenWrapper padded={false}>
      <View className="px-5 pt-2 pb-3">
        <Text className={`${theme.text} text-2xl font-bold`}>AI Travel Agent</Text>
        <Text className={`${theme.textMuted} text-sm mt-0.5`}>
          Ask anything · voice & attachments supported
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-4">
          {mockMessages.map((msg, i) => (
            <ChatBubble key={i} {...msg} />
          ))}
          <Pressable className="flex-row items-center gap-2 mb-4 self-start">
            <RefreshCw size={16} color="#0EA5E9" />
            <Text className="text-sky-500 text-sm font-medium">Regenerate response</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View className={`px-5 pb-4 pt-2 border-t ${theme.border}`}>
        <View className={`${theme.bgCard} ${theme.border} border rounded-3xl px-4 py-3 flex-row items-end gap-2`}>
          <Pressable className="p-2">
            <Paperclip size={22} color={theme.isDark ? '#94A3B8' : '#64748B'} />
          </Pressable>
          <TextInput
            placeholder="Describe your trip..."
            placeholderTextColor={theme.isDark ? '#94A3B8' : '#64748B'}
            multiline
            className={`flex-1 ${theme.text} text-base max-h-28 py-2`}
          />
          <Pressable className="p-2">
            <Mic size={22} color="#0EA5E9" />
          </Pressable>
          <Pressable className="bg-sky-500 p-2.5 rounded-full">
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  )
}
