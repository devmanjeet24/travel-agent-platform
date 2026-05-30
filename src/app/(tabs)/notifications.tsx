import { useCallback } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'

import { brand, spacing } from '@/constants/design'
import { typography } from '@/constants/typography'
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
import { PageHeader } from '@/components/ui/PageHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import {
  useDismissNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '@/hooks/notifications/use-notifications-query'
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
    <ScreenWrapper scroll tabInset scrollFlexGrow={false} subtleBackground>
      <PageHeader
        large
        title="Alerts"
        subtitle="Trip reminders and updates from your account"
      />

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={brand.primaryDark} />
      ) : isError ? (
        <View style={{ marginTop: spacing['3xl'], gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: theme.colors.text, textAlign: 'center' }}>
            Could not load notifications
          </Text>
          <Text
            style={{
              ...typography.bodySm,
              color: theme.colors.textMuted,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
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
        <Text
          style={{
            ...typography.body,
            color: theme.colors.textMuted,
            textAlign: 'center',
            marginTop: spacing['3xl'],
            lineHeight: 22,
          }}
        >
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
