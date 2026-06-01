import { Redirect } from 'expo-router'
import { View } from 'react-native'

import { useAuth } from '@/providers/auth-provider'

/** Entry route: black screen while auth resolves, then login or tabs. */
export default function Index() {
  const { loading, session } = useAuth()

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#F8FAFC' }} />
  }

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
