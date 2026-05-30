import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { spacing } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useResponsive } from '@/hooks/use-responsive'

interface Props {
  lines?: number
  className?: string
}

function ShimmerBlock({
  height,
  width,
  radius = radii.sm,
}: {
  height: number
  width: number | `${number}%`
  radius?: number
}) {
  const theme = useThemedStyles()
  const opacity = useSharedValue(0.45)

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.85, { duration: 900 }), -1, true)
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: theme.colors.border,
        },
      ]}
    />
  )
}

export function LoadingSkeleton({ lines = 3, className = '' }: Props) {
  return (
    <View className={className} style={{ gap: spacing.md }}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock key={i} height={14} width={`${100 - i * 12}%`} />
      ))}
    </View>
  )
}

export function CardSkeleton() {
  const theme = useThemedStyles()

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
      }}
    >
      <ShimmerBlock height={120} width="100%" radius={radii.md} />
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <ShimmerBlock height={18} width="66%" />
        <ShimmerBlock height={14} width="40%" />
      </View>
    </View>
  )
}

export function HeroSkeleton() {
  const { width } = useResponsive()
  const heroHeight = Math.min(Math.max(width * 0.52, 200), 300)

  return <ShimmerBlock height={heroHeight} width="100%" radius={radii['2xl']} />
}

export default LoadingSkeleton
