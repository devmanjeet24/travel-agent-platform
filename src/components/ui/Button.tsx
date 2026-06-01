import { useState } from 'react'
import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native'

import { brand } from '@/constants/design'
import { typography } from '@/constants/typography'
import { buttonShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ai'

interface Props extends PressableProps {
  title: string
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
}

function variantStyle(
  variant: Variant,
  colors: ReturnType<typeof useThemedStyles>['colors'],
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: brand.primary }
    case 'secondary':
      return { backgroundColor: brand.accent }
    case 'ai':
      return { backgroundColor: brand.ai }
    case 'outline':
      return {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1.5,
      }
    case 'ghost':
      return { backgroundColor: colors.muted }
    case 'danger':
      return { backgroundColor: brand.danger }
  }
}

function variantTextColor(variant: Variant, colors: ReturnType<typeof useThemedStyles>['colors']) {
  if (variant === 'primary' || variant === 'secondary' || variant === 'danger' || variant === 'ai') {
    return brand.onPrimary
  }
  return colors.text
}

const sizeStyles = {
  sm: { paddingVertical: 11, paddingHorizontal: 18, minHeight: 44, typo: typography.buttonSm },
  md: { paddingVertical: 14, paddingHorizontal: 22, minHeight: 52, typo: typography.button },
  lg: { paddingVertical: 16, paddingHorizontal: 26, minHeight: 56, typo: typography.button },
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  disabled,
  style: styleProp,
  ...props
}: Props) {
  const { colors, isDark } = useThemedStyles()
  const sizing = sizeStyles[size]
  const [pressed, setPressed] = useState(false)

  const flatExtra = typeof styleProp === 'function' ? undefined : styleProp

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
          width: '100%',
          minHeight: sizing.minHeight,
          paddingVertical: sizing.paddingVertical,
          paddingHorizontal: sizing.paddingHorizontal,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        variantStyle(variant, colors),
        variant === 'primary' || variant === 'ai' ? buttonShadow(isDark) : undefined,
        flatExtra,
      ]}
      {...props}
    >
      <Text style={{ ...sizing.typo, color: variantTextColor(variant, colors) }}>{title}</Text>
    </Pressable>
  )
}

export default Button
