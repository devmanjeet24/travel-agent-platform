import { Pressable, View, type PressableProps, type ViewProps } from 'react-native'

import { layout, spacing } from '@/constants/design'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Variant = 'elevated' | 'outlined' | 'filled'

interface Props extends ViewProps {
  onPress?: PressableProps['onPress']
  padded?: boolean
  variant?: Variant
}

export function Card({
  children,
  onPress,
  padded = true,
  variant = 'elevated',
  className = '',
  style,
  ...props
}: Props) {
  const theme = useThemedStyles()
  const borderWidth = variant === 'outlined' ? 1 : variant === 'elevated' ? 1 : 0
  const backgroundColor =
    variant === 'filled' ? theme.colors.muted : theme.colors.card

  const baseStyle = [
    {
      backgroundColor,
      borderRadius: radii.xl,
      borderColor: theme.colors.border,
      borderWidth,
      padding: padded ? layout.cardPadding : 0,
      overflow: 'hidden' as const,
    },
    variant === 'elevated' ? cardShadow(theme.isDark) : undefined,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`active:opacity-95 ${className}`}
        style={({ pressed }) => [
          baseStyle,
          pressed ? { opacity: 0.96, transform: [{ scale: 0.995 }] } : undefined,
        ]}
        {...(props as PressableProps)}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View className={className} style={baseStyle} {...props}>
      {children}
    </View>
  )
}

export default Card
