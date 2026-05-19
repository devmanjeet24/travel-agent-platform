import { Pressable, Text, type PressableProps } from 'react-native'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

interface Props extends PressableProps {
  title: string
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-sky-500 active:bg-sky-600',
  secondary: 'bg-violet-600 active:bg-violet-700',
  outline: 'bg-transparent border-2 border-sky-500',
  ghost: 'bg-transparent',
  danger: 'bg-red-500 active:bg-red-600',
}

const textClasses: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-sky-500',
  ghost: 'text-sky-500',
  danger: 'text-white',
}

const sizeClasses = {
  sm: 'py-2.5 px-4',
  md: 'py-3.5 px-5',
  lg: 'py-4 px-6',
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}: Props) {
  return (
    <Pressable
      className={`rounded-2xl items-center justify-center ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      <Text className={`font-semibold text-base ${textClasses[variant]}`}>
        {title}
      </Text>
    </Pressable>
  )
}

export default Button
