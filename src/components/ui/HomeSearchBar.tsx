import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronRight, Search } from 'lucide-react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const BAR_HEIGHT = 54

interface Props {
  width: number
  onPress: () => void
}

/** Home search field — elevated pill with icon badge and clear affordance. */
export function HomeSearchBar({ width, onPress }: Props) {
  const theme = useThemedStyles()
  const isDark = theme.isDark

  const surface = isDark ? '#131C2E' : theme.colors.card
  const borderColor = isDark ? 'rgba(148,163,184,0.14)' : theme.colors.border
  const iconBg = isDark ? 'rgba(37,99,235,0.18)' : brand.primaryLight
  const iconColor = isDark ? '#60A5FA' : brand.primary
  const placeholderColor = isDark ? '#94A3B8' : theme.colors.textMuted
  const chevronBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'
  const chevronColor = isDark ? '#CBD5E1' : theme.colors.icon

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Search destinations, flights, hotels"
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      <View
        style={[
          styles.bar,
          cardShadow(isDark, true),
          {
            width,
            height: BAR_HEIGHT,
            backgroundColor: surface,
            borderColor,
          },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
          <Search size={18} color={iconColor} strokeWidth={2.25} />
        </View>

        <Text style={[styles.placeholder, { color: placeholderColor }]} numberOfLines={1}>
          Search destinations, flights, hotels…
        </Text>

        <View style={[styles.chevronBadge, { backgroundColor: chevronBg }]}>
          <ChevronRight size={16} color={chevronColor} strokeWidth={2.25} />
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    overflow: 'hidden',
    elevation: 0,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
  },
  chevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default HomeSearchBar
