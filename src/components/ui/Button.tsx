import { useState } from 'react'
import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native'

import { brand } from '@/constants/design'
import { buttonShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

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
      return { backgroundColor: brand.primaryDark }
    case 'secondary':
      return { backgroundColor: brand.accent }
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
  if (variant === 'primary' || variant === 'secondary' || variant === 'danger') {
    return brand.onPrimary
  }
  return colors.text
}

const sizeStyles = {
  sm: { paddingVertical: 10, paddingHorizontal: 18, minHeight: 44, fontSize: 14 },
  md: { paddingVertical: 14, paddingHorizontal: 22, minHeight: 52, fontSize: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, minHeight: 56, fontSize: 17 },
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

  const flatExtra =
    typeof styleProp === 'function' ? undefined : styleProp

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
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        },
        variantStyle(variant, colors),
        variant === 'primary' ? buttonShadow(isDark) : undefined,
        flatExtra,
      ]}
      {...props}
    >
      <Text
        style={{
          color: variantTextColor(variant, colors),
          fontSize: sizing.fontSize,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export default Button
