import { useCallback } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import {
  Bell,
  Calendar,
  ListChecks,
  Plane,
  Hotel,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { SwipeableNotificationRow } from '@/components/notifications/SwipeableNotificationRow'
import { Button } from '@/components/ui/Button'
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
  const {
    data: notifications,
    error,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useNotificationsQuery()
  const markRead = useMarkNotificationReadMutation()
  const dismiss = useDismissNotificationMutation()

  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  return (
    <ScreenWrapper scroll tabInset>
      <ScreenHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle="Trip reminders and updates from your account"
      />

      {isLoading ? (
        <ActivityIndicator className="mt-12" color={brand.primaryDark} />
      ) : isError ? (
        <View className="mt-12 gap-3">
          <Text className={`${theme.text} text-center font-semibold`}>
            Could not load notifications
          </Text>
          <Text className={`${theme.textMuted} text-center leading-5`}>
            {error instanceof Error ? error.message : 'Please try again.'}
          </Text>
          <Button
            title={isFetching ? 'Retrying...' : 'Retry'}
            variant="outline"
            onPress={() => void refetch()}
            disabled={isFetching}
          />
        </View>
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
