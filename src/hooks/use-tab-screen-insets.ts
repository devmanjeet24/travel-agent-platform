import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  TAB_BAR_CONTENT_HEIGHT,
  TAB_COMPOSER_BOTTOM_EXTRA,
  fixedTabBarScrollPadding,
  fixedTabBarTotalHeight,
} from '@/lib/layout-parity'
import { useResponsive } from '@/hooks/use-responsive'

/**
 * Bottom inset for scrollable tab screens (clears fixed tab bar on all platforms).
 */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets()
  const { horizontalPadding } = useResponsive()
  let measuredTabBarHeight = 0

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    measuredTabBarHeight = useBottomTabBarHeight()
  } catch {
    measuredTabBarHeight = fixedTabBarTotalHeight(insets.bottom)
  }

  const tabBarHeight = Math.max(measuredTabBarHeight, fixedTabBarTotalHeight(insets.bottom))
  const scrollBottomPadding = fixedTabBarScrollPadding(insets.bottom)
  const composerBottomPadding = scrollBottomPadding + TAB_COMPOSER_BOTTOM_EXTRA

  return {
    insets,
    tabBarHeight,
    horizontalPadding,
    scrollBottomPadding,
    composerBottomPadding,
  }
}

export default useTabScreenInsets
