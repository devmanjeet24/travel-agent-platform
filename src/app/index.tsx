import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { Plane } from 'lucide-react-native'

import { brand } from '@/constants/design'

export default function SplashScreen() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/login')
    }, 2200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: '#F0F9FF' }}
    >
      <View
        className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
        style={{ backgroundColor: `${brand.primary}55` }}
      >
        <Plane size={48} color={brand.primaryDark} />
      </View>
      <Text className="text-3xl font-bold" style={{ color: '#0F172A' }}>
        TravelAI
      </Text>
      <Text className="mt-2 text-base" style={{ color: '#475569' }}>
        Your intelligent travel agent
      </Text>
    </View>
  )
}
