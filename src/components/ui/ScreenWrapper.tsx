import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'

import { useResponsive } from '@/hooks/use-responsive'
import { useTabScreenInsets } from '@/hooks/use-tab-screen-insets'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { isWeb } from '@/lib/ui-styles'
import { MaxContentWidth } from '@/constants/theme'

type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  className?: string
  contentContainerClassName?: string
  centered?: boolean
  /** Add extra bottom padding for tab bar (use on tab stack screens). */
  tabInset?: boolean
  /** Safe area edges; use without `top` on stack screens that already show a header. */
  edges?: SafeAreaEdge[]
  /** When scroll=true, grow content so lists scroll on short viewports (default true). */
  scrollFlexGrow?: boolean
  /** Shift scroll content when the software keyboard is open (default true when scroll). */
  keyboardAvoiding?: boolean
  /** Extra offset for stack headers / tab bars (iOS KeyboardAvoidingView). */
  keyboardVerticalOffset?: number
}

function MeshBackground({ isDark, width }: { isDark: boolean; width: number }) {
  const blob = Math.min(width * 0.75, 280)
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -blob * 0.4,
          right: -blob * 0.25,
          width: blob,
          height: blob,
          borderRadius: blob / 2,
          backgroundColor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(56,189,248,0.22)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: blob * 0.2,
          left: -blob * 0.2,
          width: blob * 0.8,
          height: blob * 0.8,
          borderRadius: blob * 0.4,
          backgroundColor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.1)',
        }}
      />
    </>
  )
}

export default function ScreenWrapper({
  children,
  scroll = false,
  padded = true,
  className = '',
  contentContainerClassName = '',
  centered = false,
  tabInset = false,
  edges = ['top', 'left', 'right'],
  scrollFlexGrow = true,
  keyboardAvoiding,
  keyboardVerticalOffset = 0,
}: Props) {
  const avoidKeyboard = keyboardAvoiding ?? scroll
  const theme = useThemedStyles()
  const { width, horizontalPadding, contentWidth } = useResponsive()
  const tabInsets = useTabScreenInsets()
  const padX = padded ? horizontalPadding : 0
  const padBottom = scroll
    ? tabInset
      ? tabInsets.scrollBottomPadding
      : isWeb
        ? 48
        : 24 + tabInsets.insets.bottom
    : undefined

  const inner = (
    <View
      style={[
        scroll ? undefined : { flex: 1 },
        {
          width: '100%',
          maxWidth: Math.min(contentWidth, MaxContentWidth),
          alignSelf: 'center',
        },
        centered && isWeb ? { flex: 1, justifyContent: 'center' } : undefined,
      ]}
    >
      {children}
    </View>
  )

  const scrollView = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: padBottom,
        paddingHorizontal: padX,
        flexGrow: centered || scrollFlexGrow ? 1 : undefined,
        justifyContent: centered ? 'center' : undefined,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={avoidKeyboard && Platform.OS !== 'web'}
      nestedScrollEnabled
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className={contentContainerClassName}>{inner}</View>
    </ScrollView>
  ) : null

  const content = scroll ? (
    avoidKeyboard ? (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        enabled={Platform.OS === 'ios'}
      >
        {scrollView}
      </KeyboardAvoidingView>
    ) : (
      scrollView
    )
  ) : (
    <View
      style={{
        flex: 1,
        paddingHorizontal: padX,
        paddingBottom: tabInset ? tabInsets.scrollBottomPadding : undefined,
        justifyContent: centered ? 'center' : undefined,
      }}
      className={contentContainerClassName}
    >
      {inner}
    </View>
  )

  return (
    <SafeAreaView
      className={`flex-1 ${className}`}
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
      edges={edges}
    >
      <MeshBackground isDark={theme.isDark} width={width} />
      {content}
    </SafeAreaView>
  )
}
