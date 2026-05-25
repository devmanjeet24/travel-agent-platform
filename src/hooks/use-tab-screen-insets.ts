import { Platform } from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useResponsive } from '@/hooks/use-responsive'
import { isWeb } from '@/lib/ui-styles'

/**
 * Bottom inset for scrollable tab screens (clears floating tab bar on web + native tab bar).
 */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets()
  const { horizontalPadding } = useResponsive()
  let tabBarHeight = 0

  try {
    // ScreenWrapper is also used outside tab navigators; keep the runtime fallback.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    tabBarHeight = useBottomTabBarHeight()
  } catch {
    tabBarHeight = Platform.OS === 'ios' ? 84 : 64
  }

  const scrollBottomPadding = isWeb
    ? tabBarHeight + 24
    : tabBarHeight + Math.max(insets.bottom, 8) + 8

  /** Web tab bar floats over content; native tab screens end above the bar (no tabBarHeight offset). */
  const composerBottomPadding = isWeb
    ? tabBarHeight + Math.max(insets.bottom, 16) + 12
    : 10

  return {
    insets,
    tabBarHeight,
    horizontalPadding,
    scrollBottomPadding,
    composerBottomPadding,
  }
}

export default useTabScreenInsets
