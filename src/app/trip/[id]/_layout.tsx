import { Stack } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function TripDetailLayout() {
  const { isDark, colors } = useThemedStyles()

  return (
    <RequireSession>
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Trip overview' }} />
      <Stack.Screen name="itinerary" options={{ title: 'Itinerary' }} />
      <Stack.Screen name="budget" options={{ title: 'Budget' }} />
      <Stack.Screen name="flights" options={{ title: 'Flights' }} />
      <Stack.Screen name="hotels" options={{ title: 'Hotels' }} />
      <Stack.Screen name="map" options={{ title: 'Map & routes' }} />
      <Stack.Screen name="packing" options={{ title: 'Packing list' }} />
    </Stack>
    </RequireSession>
  )
}
