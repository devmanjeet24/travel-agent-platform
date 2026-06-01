import { Pressable, Text, View } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export interface SegmentOption<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useThemedStyles()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'stretch',
        backgroundColor: theme.colors.muted,
        borderRadius: radii.pill,
        padding: 4,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: spacing.xl,
      }}
    >
      {options.map((option) => {
        const selected = option.id === value
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: radii.pill,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.card : 'transparent',
              ...(selected
                ? {
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }
                : undefined),
            }}
          >
            <Text
              style={textWithWeight(typography.label, selected ? '700' : '600', {
                color: selected ? brand.primary : theme.colors.textMuted,
                fontSize: 13,
              })}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default SegmentTabs
