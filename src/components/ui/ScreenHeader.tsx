import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle?: string
  showBack?: boolean
  rightElement?: React.ReactNode
}

export function ScreenHeader({ title, subtitle, showBack, rightElement }: Props) {
  const router = useRouter()
  const theme = useThemedStyles()

  return (
    <View className="flex-row items-center justify-between mb-4 pt-2">
      <View className="flex-row items-center flex-1">
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            className={`${theme.bgMuted} p-2 rounded-full mr-3`}
            hitSlop={8}
          >
            <ChevronLeft size={24} color={theme.isDark ? '#fff' : '#0f172a'} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <Text className={`${theme.text} text-2xl font-bold`}>{title}</Text>
          {subtitle ? (
            <Text className={`${theme.textMuted} text-sm mt-0.5`}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {rightElement}
    </View>
  )
}

export default ScreenHeader
