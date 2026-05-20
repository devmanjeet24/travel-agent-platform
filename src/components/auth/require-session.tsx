import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { useAuth } from '@/providers/auth-provider'

export function SessionPendingFallback() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
      <ActivityIndicator size="large" color="#0EA5E9" />
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
