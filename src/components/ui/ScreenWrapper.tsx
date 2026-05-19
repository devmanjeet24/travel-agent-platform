import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'

import { useThemedStyles } from '@/hooks/use-themed-styles'
import { MaxContentWidth } from '@/constants/theme'

interface Props {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  className?: string
  contentContainerClassName?: string
}

export default function ScreenWrapper({
  children,
  scroll = false,
  padded = true,
  className = '',
  contentContainerClassName = '',
}: Props) {
  const theme = useThemedStyles()
  const padding = padded ? 'px-5' : ''

  const inner = (
    <View
      className="w-full mx-auto flex-1"
      style={Platform.OS === 'web' ? { maxWidth: MaxContentWidth } : undefined}
    >
      {children}
    </View>
  )

  if (scroll) {
    return (
      <SafeAreaView className={`flex-1 ${theme.bg} ${className}`}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className={`${padding} pb-8 ${contentContainerClassName}`}>
            {inner}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className={`flex-1 ${theme.bg} ${padding} ${className}`}>
      {inner}
    </SafeAreaView>
  )
}
