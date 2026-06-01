import { Pressable, Text, View } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle?: string
  actionLabel?: string
  onActionPress?: () => void
  /** Less top margin for the first section under the hero header. */
  compactTop?: boolean
}

export default function SectionTitle({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  compactTop,
}: Props) {
  const theme = useThemedStyles()
  const top = compactTop ? spacing.md : spacing['3xl']

  return (
    <View style={{ marginTop: top, marginBottom: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, minWidth: 0, marginRight: spacing.md }}>
          <Text style={{ ...typography.h2, color: theme.colors.text }} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                ...typography.bodySm,
                color: theme.colors.textMuted,
                marginTop: spacing.xs,
              }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actionLabel && onActionPress ? (
          <Pressable
            onPress={onActionPress}
            hitSlop={8}
            style={{ flexShrink: 0, paddingTop: 2 }}
          >
            <Text style={{ ...typography.label, color: brand.primaryDark }}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
