import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus, Sparkles } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { radii } from '@/lib/ui-styles'

type Props = {
  title: string
  subtitle?: string
  onNewChat: () => void
  disabled?: boolean
}

export function ChatHeader({ title, subtitle, onNewChat, disabled }: Props) {
  const theme = useThemedStyles()
  const insets = useSafeAreaInsets()
  const { scaleFont, horizontalPadding } = useResponsive()

  return (
    <LinearGradient
      colors={
        theme.isDark
          ? [theme.colors.card, theme.colors.background]
          : [brand.primary, brand.primaryDark]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: Math.max(insets.top, 8) + spacing.sm,
        paddingHorizontal: horizontalPadding,
        paddingBottom: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={22} color={brand.onPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={textWithWeight(typography.h2, '700', {
              color: brand.onPrimary,
              fontSize: scaleFont(18),
            })}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={{
              ...typography.caption,
              color: 'rgba(255,255,255,0.82)',
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {subtitle ?? 'Live weather · hotels · itineraries'}
          </Text>
        </View>
        <Pressable
          onPress={onNewChat}
          disabled={disabled}
          accessibilityLabel="New chat"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: 40,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.pill,
            backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
            opacity: disabled ? 0.5 : 1,
            flexShrink: 0,
          })}
        >
          <Plus size={18} color={brand.onPrimary} strokeWidth={2.5} />
          <Text style={textWithWeight(typography.caption, '700', { color: brand.onPrimary })}>
            New
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  )
}

export default ChatHeader
