import type { LucideIcon } from 'lucide-react-native'
import { ChevronRight } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  label: string
  description?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  onPress?: () => void
  destructive?: boolean
  showChevron?: boolean
  /** Space below the row — use 0 on the last item in a list. */
  gapAfter?: number
}

export function MenuRow({
  label,
  description,
  icon: Icon,
  iconColor = brand.primary,
  iconBg,
  onPress,
  destructive = false,
  showChevron = true,
  gapAfter = spacing.md,
}: Props) {
  const theme = useThemedStyles()
  const bg = iconBg ?? (destructive ? brand.dangerMuted : theme.colors.primaryLight)
  const surface = theme.isDark ? '#131C2E' : theme.colors.card

  return (
    <View style={{ marginBottom: gapAfter }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => ({
          opacity: pressed && onPress ? 0.94 : 1,
        })}
      >
        <View
          style={[
            styles.row,
            {
              backgroundColor: surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: bg }]}>
            <Icon size={20} color={destructive ? brand.danger : iconColor} strokeWidth={1.75} />
          </View>

          <View style={styles.textBlock}>
            <Text
              style={{
                ...typography.h3,
                color: destructive ? brand.danger : theme.colors.text,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {description ? (
              <Text
                style={{
                  ...typography.caption,
                  color: theme.colors.textMuted,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {description}
              </Text>
            ) : null}
          </View>

          {showChevron && onPress ? (
            <View style={styles.chevronWrap}>
              <ChevronRight size={20} color={theme.colors.icon} strokeWidth={1.75} />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    elevation: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chevronWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
})

export default MenuRow
