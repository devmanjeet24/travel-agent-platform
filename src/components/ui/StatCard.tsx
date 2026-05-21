import { Text, View } from 'react-native'

import { brand } from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  label: string
  value: string | number
  accent?: string
}

export function StatCard({ label, value, accent = brand.primaryDark }: Props) {
  const theme = useThemedStyles()
  const { scaleFont, isSmallPhone } = useResponsive()

  return (
    <View
      style={[
        {
          flexGrow: 1,
          flexBasis: isSmallPhone ? '30%' : '31%',
          minWidth: isSmallPhone ? 96 : 100,
          borderRadius: radii.lg,
          padding: 16,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        cardShadow(theme.isDark, false),
      ]}
    >
      <Text
        style={{
          color: accent,
          fontSize: scaleFont(28),
          fontWeight: '800',
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: scaleFont(12),
          marginTop: 4,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export default StatCard
