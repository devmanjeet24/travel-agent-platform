import { Platform, type TextStyle, type ViewStyle } from 'react-native'

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  pill: 999,
} as const

export function cardShadow(isDark: boolean, elevated = true): ViewStyle {
  if (!elevated) {
    return Platform.OS === 'android' ? { elevation: 0 } : {}
  }

  return Platform.select({
    ios: {
      shadowColor: isDark ? '#000000' : '#0F172A',
      shadowOffset: { width: 0, height: elevated ? 8 : 4 },
      shadowOpacity: isDark ? 0.24 : 0.06,
      shadowRadius: elevated ? 16 : 10,
    },
    android: {
      elevation: elevated ? 3 : 0,
    },
    default: {},
  }) ?? {}
}

export function surfaceCard(isDark: boolean, elevated = true): ViewStyle {
  return {
    backgroundColor: isDark ? '#131C2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDark ? '#243044' : '#E8ECF1',
    ...cardShadow(isDark, elevated),
  }
}

export function buttonShadow(isDark: boolean): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: '#1D4ED8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    android: { elevation: 2 },
    default: {},
  }) ?? {}
}

export function tabBarShadow(isDark: boolean): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0.28 : 0.06,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {},
  }) ?? {}
}

export function textStyle(base: TextStyle, color: string): TextStyle {
  return { ...base, color }
}
