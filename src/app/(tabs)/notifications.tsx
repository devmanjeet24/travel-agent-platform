import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import {
  Bell,
  Calendar,
  ListChecks,
  Plane,
  Hotel,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import {
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '@/hooks/notifications/use-notifications-query'
import { formatNotificationTime } from '@/services/notifications/notification-api'
import type { NotificationRow } from '@/types/database'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const iconMap: Record<NotificationRow['type'], LucideIcon> = {
  flight: Plane,
  packing: ListChecks,
  itinerary: Calendar,
  booking: Hotel,
  general: Bell,
}

export default function NotificationsScreen() {
  const theme = useThemedStyles()
  const { data: notifications, isLoading } = useNotificationsQuery()
  const markRead = useMarkNotificationReadMutation()

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Notifications"
        subtitle="Trip reminders and updates from your account"
      />

      {isLoading ? (
        <ActivityIndicator className="mt-12" color="#0EA5E9" />
      ) : !notifications?.length ? (
        <Text className={`${theme.textMuted} text-center mt-12`}>
          No notifications yet. Create a trip to receive reminders.
        </Text>
      ) : (
        notifications.map((n) => {
          const Icon = iconMap[n.type]
          return (
            <Pressable
              key={n.id}
              onPress={() => markRead.mutate(n.id)}
              className={`${theme.bgCard} ${theme.border} border rounded-2xl p-4 mb-3 flex-row ${
                n.read ? 'opacity-70' : ''
              }`}
            >
              <View className="bg-sky-500/20 p-3 rounded-xl mr-4 h-12 w-12 items-center justify-center">
                <Icon size={22} color="#0EA5E9" />
              </View>
              <View className="flex-1">
                <Text className={`${theme.text} font-semibold`}>{n.title}</Text>
                <Text className={`${theme.textMuted} text-sm mt-1 leading-5`}>
                  {n.body}
                </Text>
                <Text className={`${theme.textMuted} text-xs mt-2`}>
                  {formatNotificationTime(n.created_at)}
                </Text>
              </View>
            </Pressable>
          )
        })
      )}
    </ScreenWrapper>
  )
}
