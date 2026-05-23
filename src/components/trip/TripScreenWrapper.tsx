import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'

import { useResponsive } from '@/hooks/use-responsive'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { MaxContentWidth } from '@/constants/theme'

/** Gutter below the trip stack header (top inset is on TripStackHeader). */
const HEADER_CONTENT_GAP = 8

interface Props {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  centered?: boolean
  className?: string
  /** Adjust scroll when the software keyboard is open (default true). */
  keyboardAvoiding?: boolean
}

const TRIP_SAFE_EDGES = ['left', 'right', 'bottom'] as const

/**
 * Safe area + scroll for trip Stack child screens (native header shown).
 * Top inset is omitted — the stack header covers the status bar; we only pad below it.
 */
export default function TripScreenWrapper({
  children,
  scroll = true,
  padded = true,
  centered = false,
  className = '',
  keyboardAvoiding = true,
}: Props) {
  const theme = useThemedStyles()
  const insets = useSafeAreaInsets()
  const { horizontalPadding, contentWidth } = useResponsive()
  const padX = padded ? horizontalPadding : 0
  const padBottom = 24 + insets.bottom
  const padTop = HEADER_CONTENT_GAP
  const avoidKeyboard = keyboardAvoiding && Platform.OS !== 'web'

  const inner = (
    <View
      style={{
        width: '100%',
        maxWidth: Math.min(contentWidth, MaxContentWidth),
        alignSelf: 'center',
        ...(centered ? { flexGrow: 1, justifyContent: 'center' } : undefined),
      }}
    >
      {children}
    </View>
  )

  const contentStyle = {
    paddingTop: padTop,
    paddingBottom: padBottom,
    paddingHorizontal: padX,
    flexGrow: centered ? 1 : undefined,
    justifyContent: centered ? ('center' as const) : undefined,
  }

  const scrollBody = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={contentStyle}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={avoidKeyboard}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {inner}
    </ScrollView>
  ) : null

  const body = scroll ? (
    avoidKeyboard ? (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        {scrollBody}
      </KeyboardAvoidingView>
    ) : (
      scrollBody
    )
  ) : (
    <View style={{ flex: 1, ...contentStyle }}>{inner}</View>
  )

  return (
    <SafeAreaView
      className={`flex-1 ${className}`}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={TRIP_SAFE_EDGES}
    >
      {body}
    </SafeAreaView>
  )
}
