import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { ReactNode } from 'react'

import { useResponsive } from '@/hooks/use-responsive'
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset'
import { useTabScreenInsets } from '@/hooks/use-tab-screen-insets'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  centered?: boolean
  tabInset?: boolean
  edges?: SafeAreaEdge[]
  scrollFlexGrow?: boolean
  keyboardAvoiding?: boolean
  keyboardVerticalOffset?: number
  subtleBackground?: boolean
  refreshing?: boolean
  onRefresh?: () => void
}

export default function ScreenWrapper({
  children,
  scroll = false,
  padded = true,
  centered = false,
  tabInset = false,
  edges = ['top', 'left', 'right'],
  scrollFlexGrow = false,
  keyboardAvoiding,
  keyboardVerticalOffset = 0,
  refreshing,
  onRefresh,
}: Props) {
  const avoidKeyboard = keyboardAvoiding ?? (scroll && Platform.OS === 'ios')
  const theme = useThemedStyles()
  const { horizontalPadding, contentWidth } = useResponsive()
  const keyboardInset = useKeyboardBottomInset()
  const tabInsets = useTabScreenInsets()
  const padX = padded ? horizontalPadding : 0
  const padBottom = scroll ? (tabInset ? tabInsets.scrollBottomPadding : 48) : undefined
  const keyboardBottomPadding =
    avoidKeyboard && Platform.OS === 'android' ? keyboardInset : 0

  const inner = (
    <View
      style={[
        scroll ? undefined : { flex: 1 },
        {
          width: contentWidth,
          alignSelf: 'center',
          flexGrow: scroll ? undefined : 1,
        },
        centered ? { flex: 1, justifyContent: 'center' } : undefined,
      ]}
      collapsable={false}
    >
      {children}
    </View>
  )

  const scrollView = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: (padBottom ?? 0) + keyboardBottomPadding,
        paddingHorizontal: padX,
        flexGrow: scrollFlexGrow ? 1 : undefined,
        alignItems: 'center',
        justifyContent: centered ? 'center' : undefined,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={avoidKeyboard && Platform.OS === 'ios'}
      nestedScrollEnabled
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={brand.primaryDark}
            colors={[brand.primaryDark]}
          />
        ) : undefined
      }
    >
      {inner}
    </ScrollView>
  ) : null

  const content = scroll ? (
    avoidKeyboard ? (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={
          keyboardVerticalOffset || (Platform.OS === 'android' ? tabInsets.insets.top : 0)
        }
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
        alignItems: 'center',
        justifyContent: centered ? 'center' : undefined,
      }}
    >
      {inner}
    </View>
  )

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={edges}
    >
      {content}
    </SafeAreaView>
  )
}
