import { Platform, type ViewStyle } from 'react-native'

/** Each child in a horizontal rail — prevents Android width collapse to 0. */
export function horizontalRailItemStyle(): ViewStyle {
  return {
    flexShrink: 0,
    flexGrow: 0,
  }
}

/** contentContainerStyle for horizontal rails. */
export function horizontalRailContentStyle(extra?: ViewStyle): ViewStyle {
  return {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    ...extra,
  }
}

/** Card/input surface — border only on Android (elevation breaks flex in scroll rows). */
export function surfaceBorder(isDark: boolean): ViewStyle {
  return {
    backgroundColor: isDark ? '#131C2E' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDark ? '#243044' : '#E8ECF1',
    ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
  }
}
