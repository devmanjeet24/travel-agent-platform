import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  Map,
  MessageSquare,
  Wallet,
  Wand2,
  type LucideIcon,
} from 'lucide-react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  Wand2,
  Map,
  Wallet,
}

interface Props {
  label: string
  description?: string
  icon: keyof typeof iconMap
  featured?: boolean
  onPress?: () => void
  /** Fill available row width (use inside flex rows on Android). */
  flex?: number
  style?: StyleProp<ViewStyle>
}

export function QuickActionCard({
  label,
  description,
  icon,
  featured = false,
  onPress,
  flex,
  style,
}: Props) {
  const theme = useThemedStyles()
  const { scaleFont } = useResponsive()
  const Icon = iconMap[icon] ?? MessageSquare

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignSelf: 'stretch',
          borderRadius: radii.xl,
          padding: featured ? spacing.lg : spacing.md,
          backgroundColor: featured ? brand.primary : theme.colors.card,
          borderWidth: featured ? 0 : 1,
          borderColor: theme.colors.border,
          minHeight: featured ? 88 : 80,
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...(flex != null ? { flex, minWidth: 0 } : undefined),
        },
        cardShadow(theme.isDark, featured),
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: featured ? 'rgba(255,255,255,0.16)' : theme.colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={featured ? brand.onPrimary : brand.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0, flexShrink: 1 }}>
          <Text
            style={{
              ...typography.h3,
              color: featured ? brand.onPrimary : theme.colors.text,
              fontSize: scaleFont(15),
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {description ? (
            <Text
              style={{
                color: featured ? 'rgba(255,255,255,0.82)' : theme.colors.textMuted,
                fontSize: scaleFont(12),
                marginTop: 2,
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

export default QuickActionCard
