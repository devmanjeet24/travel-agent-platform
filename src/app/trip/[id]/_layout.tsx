import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'

export default function TripDetailLayout() {
  const isDark = useColorScheme() !== 'light'

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: isDark ? '#020617' : '#F8FAFC' },
        headerTintColor: isDark ? '#fff' : '#0f172a',
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: isDark ? '#020617' : '#F8FAFC' },
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
  )
}
