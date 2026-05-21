import { Pressable, View, type PressableProps, type ViewProps } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props extends ViewProps {
  onPress?: PressableProps['onPress']
  padded?: boolean
}

export function Card({
  children,
  onPress,
  padded = true,
  className = '',
  ...props
}: Props) {
  const theme = useThemedStyles()
  const base = `${theme.bgCard} ${theme.border} border rounded-3xl ${padded ? 'p-5' : ''} ${className}`

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${base} active:opacity-90`}
        {...(props as PressableProps)}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View className={base} {...props}>
      {children}
    </View>
  )
}

export default Card
