import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  label: string
  value: string | number
  accent?: string
  width?: number
  style?: StyleProp<ViewStyle>
}

export function StatCard({ label, value, accent = brand.primaryDark, width, style }: Props) {
  const theme = useThemedStyles()
  const { scaleFont } = useResponsive()

  return (
    <View
      style={[
        styles.card,
        {
          width,
          flex: width ? undefined : 1,
          minWidth: width ? undefined : 0,
          backgroundColor: theme.isDark ? '#131C2E' : theme.colors.card,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      <Text
        style={textWithWeight(typography.display, '800', {
          color: accent,
          fontSize: scaleFont(24),
          letterSpacing: -0.5,
          lineHeight: scaleFont(28),
        })}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          ...typography.caption,
          color: theme.colors.textMuted,
          marginTop: spacing.xs,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 0,
  },
})

export default StatCard
