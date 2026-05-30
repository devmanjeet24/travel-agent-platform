import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
import { horizontalRailContentStyle, horizontalRailItemStyle } from '@/lib/layout-native'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const iconMap: Record<(typeof discoveryCategories)[number]['icon'], LucideIcon> = {
  Globe,
  Waves,
  Mountain,
  Building2,
  Landmark,
}

const CHIP_ROW_HEIGHT = 44

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
  inactiveSurface,
}: {
  label: string
  icon: LucideIcon
  selected: boolean
  onPress: () => void
  inactiveSurface: string
}) {
  const theme = useThemedStyles()
  const inactiveIcon = theme.isDark ? '#94A3B8' : theme.colors.icon
  const inactiveText = theme.isDark ? '#E2E8F0' : theme.colors.text

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chipPressable,
        {
          backgroundColor: selected ? brand.primary : inactiveSurface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.chipRow}>
        <Icon
          size={15}
          color={selected ? '#FFFFFF' : inactiveIcon}
          strokeWidth={1.75}
        />
        <Text
          style={textWithWeight(typography.label, '600', {
            color: selected ? '#FFFFFF' : inactiveText,
            fontSize: 13,
            marginLeft: 6,
          })}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

export function CategoryChipRow({ width, selectedId = 'all', onSelect }: Props) {
  const theme = useThemedStyles()
  const inactiveSurface = theme.isDark ? '#131C2E' : theme.colors.card

  return (
    <View style={{ width, height: CHIP_ROW_HEIGHT }} collapsable={false}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        style={{ width, height: CHIP_ROW_HEIGHT }}
        contentContainerStyle={horizontalRailContentStyle({
          height: CHIP_ROW_HEIGHT,
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
              inactiveSurface={inactiveSurface}
              onPress={() => onSelect(item.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  chipPressable: {
    borderRadius: 999,
    height: CHIP_ROW_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 0,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  chipGap: {
    marginLeft: spacing.sm,
  },
})

export default CategoryChipRow
