import { Redirect, Stack } from 'expo-router'

import { SessionPendingFallback } from '@/components/auth/require-session'
import { useAuth } from '@/providers/auth-provider'

export default function AuthLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return <SessionPendingFallback />
  }

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  )
}
