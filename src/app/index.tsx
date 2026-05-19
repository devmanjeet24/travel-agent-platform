import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plane } from 'lucide-react-native'

import { brand } from '@/constants/design'

export default function SplashScreen() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/onboarding')
    }, 2200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View className="flex-1 bg-slate-950 items-center justify-center">
      <View
        className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
        style={{ backgroundColor: `${brand.primary}33` }}
      >
        <Plane size={48} color={brand.primary} />
      </View>
      <Text className="text-white text-3xl font-bold">TravelAI</Text>
      <Text className="text-slate-400 mt-2 text-base">
        Your intelligent travel agent
      </Text>
    </View>
  )
}
