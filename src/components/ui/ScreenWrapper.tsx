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
      className="w-full mx-auto"
      style={[
        scroll ? undefined : { flex: 1 },
        Platform.OS === 'web' ? { maxWidth: MaxContentWidth, alignSelf: 'center' } : undefined,
      ]}
    >
      {children}
    </View>
  )

  if (scroll) {
    return (
      <SafeAreaView
        className={`flex-1 ${className}`}
        style={{ backgroundColor: theme.colors.background }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className={`${padding} ${contentContainerClassName}`}>
            {inner}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      className={`flex-1 ${padding} ${className}`}
      style={{ backgroundColor: theme.colors.background }}
    >
      {inner}
    </SafeAreaView>
  )
}
