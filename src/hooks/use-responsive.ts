import { useWindowDimensions } from 'react-native'

import { layout } from '@/constants/design'
import { isWeb } from '@/lib/ui-styles'

/** Breakpoints aligned with common phone / tablet widths */
const BP = {
  sm: 380,
  md: 768,
  lg: 1024,
} as const

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions()

  const isSmallPhone = width < BP.sm
  const isPhone = width < BP.md
  const isTablet = width >= BP.md && width < BP.lg
  const isDesktop = width >= BP.lg

  const horizontalPadding = isWeb
    ? isDesktop
      ? 32
      : isTablet
        ? 28
        : 24
    : isSmallPhone
      ? 16
      : 20

  const contentWidth = Math.min(width - horizontalPadding * 2, layout.maxContentWidth)

  /** Clamp font scale so system accessibility does not break layouts */
  const fs = Math.min(Math.max(fontScale, 1), 1.2)

  const scaleFont = (size: number) => Math.round(size * fs)

  const bannerWidth = isWeb
    ? Math.min(300, width * 0.42)
    : Math.min(width * 0.82, 320)

  const destinationCardWidth = isWeb
    ? isDesktop
      ? 200
      : 170
    : Math.min(width * 0.52, 200)

  const quickActionColumns = isPhone && !isWeb ? (isSmallPhone ? 1 : 2) : isDesktop ? 3 : 2

  return {
    width,
    height,
    fontScale: fs,
    scaleFont,
    isSmallPhone,
    isPhone,
    isTablet,
    isDesktop,
    isWeb,
    horizontalPadding,
    contentWidth,
    bannerWidth,
    destinationCardWidth,
    quickActionColumns,
    useCompactAuth: !isWeb || width < BP.md,
  }
}

export default useResponsive
