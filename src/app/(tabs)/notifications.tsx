import { Text, View } from 'react-native'
import {
  Bell,
  Calendar,
  Luggage,
  Plane,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { mockNotifications } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const typeIcons: Record<string, LucideIcon> = {
  flight: Plane,
  packing: Luggage,
  itinerary: Calendar,
  booking: Bell,
}

export default function NotificationsScreen() {
  const theme = useThemedStyles()

  return (
    <ScreenWrapper scroll>
      <ScreenHeader
        title="Notifications"
        subtitle="Reminders for trips, packing & bookings"
      />

      {mockNotifications.map((n) => {
        const Icon = typeIcons[n.type] ?? Bell
        return (
          <Card key={n.id} className="mb-3 flex-row items-start">
            <View className="bg-sky-500/20 p-3 rounded-2xl mr-4">
              <Icon size={22} color="#0EA5E9" />
            </View>
            <View className="flex-1">
              <Text className={`${theme.text} font-semibold text-base`}>
                {n.title}
              </Text>
              <Text className={`${theme.textMuted} text-sm mt-1 leading-5`}>
                {n.body}
              </Text>
              <Text className={`${theme.textMuted} text-xs mt-2`}>{n.time}</Text>
            </View>
          </Card>
        )
      })}
    </ScreenWrapper>
  )
}
