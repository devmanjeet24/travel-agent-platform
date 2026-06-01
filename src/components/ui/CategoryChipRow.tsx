import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import {
  Building2,
  Globe,
  Landmark,
  Mountain,
  Waves,
  type LucideIcon,
} from 'lucide-react-native'

import { brand, discoveryCategories, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import {
  horizontalRailContentStyle,
  horizontalRailItemStyle,
  surfaceBorder,
} from '@/lib/layout-native'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const iconMap: Record<(typeof discoveryCategories)[number]['icon'], LucideIcon> = {
  Globe,
  Waves,
  Mountain,
  Building2,
  Landmark,
}

/** Matches SectionTitle `compactTop` — offsets gap before Explore without changing Home. */
const EXPLORE_TITLE_OFFSET = spacing['2xl']

const CHIP_HEIGHT = 44
const CHIP_ICON_SIZE = 15
const CHIP_FONT_SIZE = 13
const CHIP_PAD_H = 14
const CHIP_ICON_GAP = 6
const CHIP_FONT_WEIGHT = '600' as const

interface Props {
  width: number
  selectedId?: string
  onSelect: (id: string) => void
}

function CategoryChip({
  label,
  icon: Icon,
  selected,
  onPress,
  isDark,
}: {
  label: string
  icon: LucideIcon
  selected: boolean
  onPress: () => void
  isDark: boolean
}) {
  const theme = useThemedStyles()
  const inactiveIcon = theme.isDark ? '#94A3B8' : theme.colors.icon
  const inactiveText = theme.isDark ? '#E2E8F0' : theme.colors.text

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected
          ? styles.chipSelected
          : surfaceBorder(isDark),
      ]}
    >
      <Icon
        size={CHIP_ICON_SIZE}
        color={selected ? '#FFFFFF' : inactiveIcon}
        strokeWidth={1.75}
      />
      <Text
        style={textWithWeight(typography.label, CHIP_FONT_WEIGHT, {
          color: selected ? '#FFFFFF' : inactiveText,
          fontSize: CHIP_FONT_SIZE,
          marginLeft: CHIP_ICON_GAP,
        })}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export function CategoryChipRow({ width, selectedId = 'all', onSelect }: Props) {
  const theme = useThemedStyles()

  return (
    <View
      style={{
        width,
        marginTop: spacing.md,
        marginBottom: -EXPLORE_TITLE_OFFSET,
      }}
      collapsable={false}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        style={{ width, height: CHIP_HEIGHT }}
        contentContainerStyle={horizontalRailContentStyle({
          height: CHIP_HEIGHT,
          alignItems: 'center',
          paddingRight: spacing.md,
        })}
      >
        {discoveryCategories.map((item, index) => (
          <View
            key={item.id}
            style={[horizontalRailItemStyle(), index > 0 ? styles.chipGap : undefined]}
            collapsable={false}
          >
            <CategoryChip
              label={item.label}
              icon={iconMap[item.icon]}
              selected={item.id === selectedId}
              isDark={theme.isDark}
              onPress={() => onSelect(item.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    height: CHIP_HEIGHT,
    paddingHorizontal: CHIP_PAD_H,
    borderRadius: radii.pill,
    elevation: 0,
  },
  chipSelected: {
    backgroundColor: brand.primary,
    borderWidth: 0,
  },
  chipGap: {
    marginLeft: spacing.sm,
  },
})

export default CategoryChipRow
