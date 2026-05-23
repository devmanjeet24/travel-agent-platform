import { Stack } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { TripStackHeader } from '@/components/trip/TripStackHeader'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function TripDetailLayout() {
  const { isDark, colors } = useThemedStyles()

  return (
    <RequireSession>
    <Stack
      screenOptions={{
        headerShown: true,
        header: (props) => <TripStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { flex: 1, backgroundColor: colors.background },
        statusBarStyle: isDark ? 'light' : 'dark',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Trip overview' }} />
      <Stack.Screen name="itinerary" options={{ title: 'Itinerary' }} />
      <Stack.Screen name="budget" options={{ title: 'Budget' }} />
      <Stack.Screen name="flights" options={{ title: 'Transport' }} />
      <Stack.Screen name="hotels" options={{ title: 'Hotels' }} />
      <Stack.Screen name="map" options={{ title: 'Map & routes' }} />
      <Stack.Screen name="packing" options={{ title: 'Packing list' }} />
    </Stack>
    </RequireSession>
  )
}
