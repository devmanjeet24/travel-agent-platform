import { Stack } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'

export default function AdminLayout() {
  return (
    <RequireSession>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireSession>
  )
}
