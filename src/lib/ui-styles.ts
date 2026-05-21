import { Platform, type ViewStyle } from 'react-native'

export const isWeb = Platform.OS === 'web'

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const

export function cardShadow(isDark: boolean, elevated = true): ViewStyle {
  if (!elevated) return {}

  if (isWeb) {
    return {
      boxShadow: isDark
        ? '0 8px 32px rgba(0, 0, 0, 0.25)'
        : '0 8px 28px rgba(14, 165, 233, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
    } as ViewStyle
  }

  return Platform.select({
    ios: {
      shadowColor: isDark ? '#000000' : '#0EA5E9',
      shadowOffset: { width: 0, height: elevated ? 8 : 4 },
      shadowOpacity: isDark ? 0.2 : 0.12,
      shadowRadius: elevated ? 16 : 8,
    },
    android: { elevation: elevated ? 6 : 2 },
    default: {},
  }) ?? {}
}

export function buttonShadow(isDark: boolean): ViewStyle {
  if (isWeb) {
    return {
      boxShadow: '0 6px 20px rgba(14, 165, 233, 0.35)',
    } as ViewStyle
  }

  return Platform.select({
    ios: {
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    android: { elevation: 4 },
    default: {},
  }) ?? {}
}

export const webContentWidth = isWeb ? 1120 : undefined
