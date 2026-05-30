/** Native app layout constants — tab bar, scroll insets, auth spacing. */

export const TAB_BAR_CONTENT_HEIGHT = 68

export const TAB_SCROLL_BOTTOM_EXTRA = 16
export const TAB_COMPOSER_BOTTOM_EXTRA = 4

export const AUTH_FOOTER_MARGIN_TOP = 24

/** Total tab bar height including bottom safe-area inset. */
export function fixedTabBarTotalHeight(insetsBottom: number) {
  const bottomInset = Math.max(insetsBottom, 10)
  return TAB_BAR_CONTENT_HEIGHT + bottomInset
}

/** Bottom padding for scrollable tab screens (content clears fixed tab bar). */
export function fixedTabBarScrollPadding(insetsBottom: number) {
  return fixedTabBarTotalHeight(insetsBottom) + TAB_SCROLL_BOTTOM_EXTRA
}
