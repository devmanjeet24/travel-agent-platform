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
    tabBarHeight = useBottomTabBarHeight()
  } catch {
    tabBarHeight = Platform.OS === 'ios' ? 84 : 64
  }

  const scrollBottomPadding = isWeb
    ? tabBarHeight + 24
    : tabBarHeight + Math.max(insets.bottom, 8) + 8

  return {
    insets,
    tabBarHeight,
    horizontalPadding,
    scrollBottomPadding,
    composerBottomPadding: tabBarHeight + Math.max(insets.bottom, Platform.OS === 'ios' ? 4 : 12),
  }
}

export default useTabScreenInsets
