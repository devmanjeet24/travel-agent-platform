import { Pressable, Text, type PressableProps, type ViewStyle } from 'react-native'

import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

interface Props extends PressableProps {
  title: string
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variantClasses: Record<Variant, string> = {
  primary: 'active:opacity-90',
  secondary: 'active:opacity-90',
  outline: 'border-2',
  ghost: '',
  danger: 'active:opacity-90',
}

const textClasses: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: '',
  ghost: '',
  danger: 'text-white',
}

const sizeClasses = {
  sm: 'py-2.5 px-4',
  md: 'py-3.5 px-5',
  lg: 'py-4 px-6',
}

function variantStyle(
  variant: Variant,
  colors: ReturnType<typeof useThemedStyles>['colors'],
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primaryDark }
    case 'secondary':
      return { backgroundColor: colors.accent }
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.primaryDark,
      }
    case 'ghost':
      return { backgroundColor: 'transparent' }
    case 'danger':
      return { backgroundColor: brand.danger }
  }
}

function variantTextColor(variant: Variant, colors: ReturnType<typeof useThemedStyles>['colors']) {
  if (variant === 'outline' || variant === 'ghost') return colors.primaryDark
  return '#FFFFFF'
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  style,
  ...props
}: Props) {
  const { colors } = useThemedStyles()

  return (
    <Pressable
      className={`rounded-2xl items-center justify-center ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
      style={[variantStyle(variant, colors), style]}
      disabled={disabled}
      {...props}
    >
      <Text
        className={`font-semibold text-base ${textClasses[variant]}`}
        style={{ color: variantTextColor(variant, colors) }}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export default Button
