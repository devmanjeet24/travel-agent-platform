import type { LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  label: string
  icon: LucideIcon
  width: number
  onPress?: () => void
  accent?: boolean
}

export function ShortcutTile({ label, icon: Icon, width, onPress, accent = false }: Props) {
  const theme = useThemedStyles()
  const surface = theme.isDark ? '#131C2E' : theme.colors.card
  const iconBg = theme.isDark ? 'rgba(37, 99, 235, 0.18)' : theme.colors.primaryLight

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width, opacity: pressed ? 0.92 : 1 })}
    >
      <View
        style={[
          styles.tile,
          {
            width,
            backgroundColor: accent ? brand.primary : surface,
            borderColor: accent ? brand.primary : theme.colors.border,
            borderWidth: accent ? 0 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: accent ? 'rgba(255,255,255,0.18)' : iconBg },
          ]}
        >
          <Icon
            size={22}
            color={accent ? '#FFFFFF' : brand.primary}
            strokeWidth={1.75}
          />
        </View>
        <Text
          style={textWithWeight(typography.caption, '700', {
            color: accent ? '#FFFFFF' : theme.isDark ? '#E2E8F0' : theme.colors.text,
            textAlign: 'center',
            fontSize: 12,
          })}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    elevation: 0,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
})

export default ShortcutTile
