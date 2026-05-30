import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useIsOffline } from '@/hooks/use-offline-sync'
import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

/** Subtle banner when offline sync is on and the device has no connection. */
export function OfflineBanner() {
  const theme = useThemedStyles()
  const insets = useSafeAreaInsets()
  const offline = useIsOffline()

  if (!offline) return null

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, spacing.sm),
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.15)' : brand.warningMuted,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
      accessibilityRole="text"
      accessibilityLabel="You are offline. Showing saved trips and chat."
    >
      <Text
        style={{
          ...typography.caption,
          color: theme.isDark ? '#FCD34D' : '#B45309',
          textAlign: 'center',
        }}
      >
        Offline — showing saved data. Changes sync when you are back online.
      </Text>
    </View>
  )
}
