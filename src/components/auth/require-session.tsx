import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { brand } from '@/constants/design'
import { useAuth } from '@/providers/auth-provider'

export function SessionPendingFallback() {
  return (
    <View className="flex-1 items-center justify-center bg-sky-50">
      <ActivityIndicator size="large" color={brand.primaryDark} />
    </View>
  )
}

type RequireSessionProps = {
  children: ReactNode
}

/**
 * Renders children only when Supabase reports an active session.
 * Shows a lightweight loader while the session query resolves, then redirects to login.
 */
export function RequireSession({ children }: RequireSessionProps) {
  const { session, loading } = useAuth()

  if (loading) {
    return <SessionPendingFallback />
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  return <>{children}</>
}
