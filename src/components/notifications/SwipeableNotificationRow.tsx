import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { formatNotificationTime } from '@/services/notifications/notification-api'
import type { NotificationRow } from '@/types/database'

const DISMISS_THRESHOLD = 72
const DISMISS_VELOCITY = 450

interface Props {
  notification: NotificationRow
  icon: LucideIcon
  onPress: () => void
  onDismiss: () => void
}

export function SwipeableNotificationRow({
  notification,
  icon: Icon,
  onPress,
  onDismiss,
}: Props) {
  const theme = useThemedStyles()
  const translateX = useSharedValue(0)
  const opacity = useSharedValue(1)

  const finishDismiss = () => {
    onDismiss()
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      translateX.value = event.translationX
      const progress = Math.min(Math.abs(event.translationX) / 160, 1)
      opacity.value = 1 - progress * 0.35
    })
    .onEnd((event) => {
      const shouldDismiss =
        Math.abs(translateX.value) > DISMISS_THRESHOLD ||
        Math.abs(event.velocityX) > DISMISS_VELOCITY

      if (shouldDismiss) {
        const direction = translateX.value >= 0 ? 1 : -1
        translateX.value = withTiming(direction * 420, { duration: 220 })
        opacity.value = withTiming(0, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(finishDismiss)()
          }
        })
        return
      }

      translateX.value = withSpring(0, { damping: 22, stiffness: 320 })
      opacity.value = withSpring(1, { damping: 22, stiffness: 320 })
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }))

  return (
    <View className="mb-3 overflow-hidden">
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedStyle}>
          <Pressable
            onPress={onPress}
            className={`${theme.bgCard} ${theme.border} border rounded-2xl p-4 flex-row ${
              notification.read ? 'opacity-70' : ''
            }`}
          >
            <View className="bg-yellow-500/20 p-3 rounded-xl mr-4 h-12 w-12 items-center justify-center">
              <Icon size={22} color={brand.primaryDark} />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} font-semibold`}>{notification.title}</Text>
              <Text className={`${theme.textMuted} text-sm mt-1 leading-5`}>
                {notification.body}
              </Text>
              <Text className={`${theme.textMuted} text-xs mt-2`}>
                {formatNotificationTime(notification.created_at)}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
