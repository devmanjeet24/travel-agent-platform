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

  const sizeStyle =
    size === 'sm'
      ? { paddingVertical: 10, paddingHorizontal: 16, minHeight: 44 }
      : size === 'lg'
        ? { paddingVertical: 16, paddingHorizontal: 24, minHeight: 56 }
        : { paddingVertical: 14, paddingHorizontal: 20, minHeight: 52 }

  return (
    <Pressable
      className={`${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
      style={[
        {
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        },
        sizeStyle,
        variantStyle(variant, colors),
        disabled ? { opacity: 0.5 } : undefined,
        style,
      ]}
      disabled={disabled}
      {...props}
    >
      <Text
        className={textClasses[variant]}
        style={{
          color: variantTextColor(variant, colors),
          fontSize: 16,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export default Button
