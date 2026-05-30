import { Platform, type TextStyle } from 'react-native'

import { Fonts } from '@/constants/theme'

/**
 * Map typography preset weight → @expo-google-fonts/inter PostScript names (native only).
 * Web keeps CSS `var(--font-display)` + fontWeight from `Fonts.sans`.
 */
export function interFontFamilyForPreset(style: TextStyle): string {
  const w = style.fontWeight
  if (w === '800' || w === 800) return 'Inter_800ExtraBold'
  if (w === '700' || w === 700) return 'Inter_700Bold'
  if (w === '600' || w === 600) return 'Inter_600SemiBold'
  if (w === '500' || w === 500) return 'Inter_500Medium'
  return 'Inter_400Regular'
}

/** Apply web CSS font stack on web; Inter file names on native (after useFonts in NativeSplashGate). */
export function t(style: TextStyle): TextStyle {
  if (Platform.OS === 'web') {
    return Fonts.sans ? { ...style, fontFamily: Fonts.sans } : style
  }
  return {
    ...style,
    fontFamily: interFontFamilyForPreset(style),
    fontWeight: undefined,
  }
}

/**
 * Merge a typography preset with a weight override (native picks the correct Inter file).
 * Use instead of `{ ...typography.bodySm, fontWeight: '800' }` which leaves the wrong font on APK.
 */
export function textWithWeight(
  preset: TextStyle,
  fontWeight: NonNullable<TextStyle['fontWeight']>,
  extra?: TextStyle,
): TextStyle {
  const merged = { ...preset, ...extra, fontWeight }
  if (Platform.OS === 'web') {
    return Fonts.sans ? { ...merged, fontFamily: Fonts.sans } : merged
  }
  return {
    ...merged,
    fontFamily: interFontFamilyForPreset({ fontWeight }),
    fontWeight: undefined,
  }
}
