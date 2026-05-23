import { ActivityIndicator, Text } from 'react-native'
import {
  Bell,
  Calendar,
  ListChecks,
  Plane,
  Hotel,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { SwipeableNotificationRow } from '@/components/notifications/SwipeableNotificationRow'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import {
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '@/hooks/notifications/use-notifications-query'
import type { NotificationRow } from '@/types/database'
import { brand } from '@/constants/design'
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
  const dismiss = useDismissNotificationMutation()

  return (
    <ScreenWrapper scroll tabInset>
      <ScreenHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle="Trip reminders and updates from your account"
      />

      {isLoading ? (
        <ActivityIndicator className="mt-12" color={brand.primaryDark} />
      ) : !notifications?.length ? (
        <Text className={`${theme.textMuted} text-center mt-12`}>
          No notifications yet. Create a trip to receive reminders.
        </Text>
      ) : (
        notifications.map((n) => {
          const Icon = iconMap[n.type]
          return (
            <SwipeableNotificationRow
              key={n.id}
              notification={n}
              icon={Icon}
              onPress={() => markRead.mutate(n.id)}
              onDismiss={() => dismiss.mutate(n.id)}
            />
          )
        })
      )}
    </ScreenWrapper>
  )
}
