import { Platform, Pressable, Text, View } from 'react-native'
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
  const { scaleFont, horizontalPadding, isSmallPhone } = useResponsive()

  const headerText = theme.isDark ? theme.colors.text : brand.onPrimary
  const headerMuted = theme.isDark ? theme.colors.textMuted : 'rgba(255,255,255,0.78)'
  const iconBg = theme.isDark ? theme.colors.aiMuted : 'rgba(255,255,255,0.16)'
  const iconColor = theme.isDark ? brand.ai : brand.onPrimary
  const newBtnBg = theme.isDark ? theme.colors.muted : 'rgba(255,255,255,0.14)'
  const newBtnBorder = theme.isDark ? theme.colors.border : 'rgba(255,255,255,0.28)'
  const newBtnPressed = theme.isDark ? theme.colors.cardElevated : 'rgba(255,255,255,0.22)'

  const shellStyle = {
    paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 6 : 8) + spacing.sm,
    paddingHorizontal: horizontalPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? theme.colors.border : 'rgba(255,255,255,0.12)',
  } as const

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: isSmallPhone ? 40 : 44,
          height: isSmallPhone ? 40 : 44,
          borderRadius: radii.pill,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={isSmallPhone ? 20 : 22} color={iconColor} />
      </View>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: spacing.xs }}>
        <Text
          style={textWithWeight(typography.h2, '700', {
            color: headerText,
            fontSize: scaleFont(isSmallPhone ? 17 : 18),
            letterSpacing: -0.3,
          })}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        <Text
          style={{
            ...typography.caption,
            color: headerMuted,
            marginTop: 2,
            fontSize: scaleFont(12),
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subtitle ?? 'Live weather · hotels · itineraries'}
        </Text>
      </View>

      <Pressable
        onPress={onNewChat}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="New chat"
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={{ flexShrink: 0, flexGrow: 0, opacity: disabled ? 0.5 : 1 }}
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isSmallPhone ? 68 : 72,
              minHeight: 36,
              paddingHorizontal: isSmallPhone ? 10 : spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.pill,
              backgroundColor: pressed ? newBtnPressed : newBtnBg,
              borderWidth: 1,
              borderColor: newBtnBorder,
            }}
          >
            <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={15} color={headerText} strokeWidth={2.5} />
            </View>
            <Text
              style={textWithWeight(typography.caption, '700', {
                color: headerText,
                fontSize: scaleFont(13),
                lineHeight: 16,
                marginLeft: 5,
                flexShrink: 0,
              })}
              numberOfLines={1}
              allowFontScaling={false}
            >
              New
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  )

  if (theme.isDark) {
    return (
      <View
        style={[
          shellStyle,
          {
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        {content}
      </View>
    )
  }

  return (
    <LinearGradient
      colors={[brand.primary, brand.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={shellStyle}
    >
      {content}
    </LinearGradient>
  )
}

export default ChatHeader
