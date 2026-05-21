import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  Map,
  MessageSquare,
  Wallet,
  Wand2,
  type LucideIcon,
} from 'lucide-react-native'

import { brand } from '@/constants/design'
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
  style?: StyleProp<ViewStyle>
}

export function QuickActionCard({
  label,
  description,
  icon,
  featured = false,
  onPress,
  style,
}: Props) {
  const theme = useThemedStyles()
  const { scaleFont, isSmallPhone } = useResponsive()
  const Icon = iconMap[icon] ?? MessageSquare

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: radii.lg,
          padding: featured ? 20 : 16,
          backgroundColor: featured ? brand.primaryDark : theme.colors.card,
          borderWidth: featured ? 0 : 1,
          borderColor: theme.colors.border,
          minHeight: featured ? 108 : 96,
        },
        cardShadow(theme.isDark, featured),
        style,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.md,
          backgroundColor: featured ? 'rgba(255,255,255,0.2)' : brand.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Icon size={22} color={featured ? brand.onPrimary : brand.primaryDark} />
      </View>
      <Text
        style={{
          color: featured ? brand.onPrimary : theme.colors.text,
          fontWeight: '700',
          fontSize: scaleFont(15),
        }}
      >
        {label}
      </Text>
      {description ? (
        <Text
          style={{
            color: featured ? 'rgba(255,255,255,0.85)' : theme.colors.textMuted,
            fontSize: scaleFont(13),
            marginTop: 4,
            lineHeight: 18,
          }}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default QuickActionCard
