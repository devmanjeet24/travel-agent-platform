import { Pressable, View, type PressableProps, type ViewProps } from 'react-native'

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
  const borderWidth = variant === 'outlined' ? 1 : 0
  const backgroundColor =
    variant === 'filled' ? theme.colors.muted : theme.colors.card

  const baseStyle = [
    {
      backgroundColor,
      borderRadius: radii.lg,
      borderColor: theme.colors.border,
      borderWidth,
      padding: padded ? (variant === 'elevated' ? 20 : 16) : 0,
      overflow: 'hidden' as const,
    },
    variant === 'elevated' ? cardShadow(theme.isDark) : undefined,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`active:opacity-92 ${className}`}
        style={baseStyle}
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
