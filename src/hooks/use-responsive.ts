import { useWindowDimensions } from 'react-native'

import { layout } from '@/constants/design'

const BP = {
  sm: 380,
  md: 768,
} as const

/** Mobile-first layout tokens for native app screens. */
export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions()

  const isSmallPhone = width < BP.sm
  const isTablet = width >= BP.md

  const horizontalPadding = isTablet ? 28 : 20
  const contentWidth = width - horizontalPadding * 2
  const fs = Math.min(Math.max(fontScale, 1), 1.2)
  const scaleFont = (size: number) => Math.round(size * fs)

  const bannerWidth = Math.min(280, Math.round(contentWidth * 0.72))
  const destinationCardWidth = isTablet ? 180 : 156

  return {
    width,
    height,
    fontScale: fs,
    scaleFont,
    isSmallPhone,
    isTablet,
    horizontalPadding,
    contentWidth: Math.min(contentWidth, layout.maxContentWidth),
    bannerWidth,
    destinationCardWidth,
    useCompactAuth: width < BP.md,
  }
}

export default useResponsive
