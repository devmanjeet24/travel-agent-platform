import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'

import '@/global.css'
import { AppProviders } from '@/providers/app-providers'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <AppProviders>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trip/wizard" options={{ presentation: 'modal' }} />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="destination/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="admin" />
        </Stack>
      </ThemeProvider>
    </AppProviders>
  )
}
