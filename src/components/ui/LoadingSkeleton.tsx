import { View } from 'react-native'

import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  lines?: number
  className?: string
}

export function LoadingSkeleton({ lines = 3, className = '' }: Props) {
  const theme = useThemedStyles()

  return (
    <View className={`gap-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          className={`${theme.bgMuted} rounded-2xl h-4`}
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </View>
  )
}

export function CardSkeleton() {
  const theme = useThemedStyles()

  return (
    <View className={`${theme.bgCard} ${theme.border} border rounded-3xl p-5 mb-4`}>
      <View className={`${theme.bgMuted} h-32 rounded-2xl mb-4`} />
      <View className={`${theme.bgMuted} h-5 rounded-lg w-2/3 mb-2`} />
      <View className={`${theme.bgMuted} h-4 rounded-lg w-1/2`} />
    </View>
  )
}

export default LoadingSkeleton
