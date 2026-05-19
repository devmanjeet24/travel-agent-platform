import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useMemo, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import '@/global.css'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { AppProviders } from '@/providers/app-providers'

function NavigationThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const { colors } = useThemedStyles()
  const base = isDark ? DarkTheme : DefaultTheme

  const theme = useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.background,
      },
    }),
    [base, colors.background],
  )

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <AppProviders>
      <NavigationThemeProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trip/wizard" options={{ presentation: 'modal' }} />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="destination/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="admin" />
        </Stack>
      </NavigationThemeProvider>
    </AppProviders>
  )
}
