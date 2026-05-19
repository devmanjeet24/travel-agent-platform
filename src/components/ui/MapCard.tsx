import { Text, View } from 'react-native'
import { MapPin, Navigation } from 'lucide-react-native'

import { Card } from './Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  title: string
  subtitle: string
  distance?: string
  onPress?: () => void
}

export function MapCard({ title, subtitle, distance, onPress }: Props) {
  const theme = useThemedStyles()

  return (
    <Card onPress={onPress} className="mb-3">
      <View className={`${theme.bgMuted} rounded-2xl h-36 items-center justify-center mb-4`}>
        <MapPin size={40} color="#0EA5E9" />
        <Text className={`${theme.textMuted} text-xs mt-2`}>Map preview</Text>
      </View>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className={`${theme.text} font-semibold text-lg`}>{title}</Text>
          <Text className={`${theme.textMuted} text-sm mt-1`}>{subtitle}</Text>
          {distance ? (
            <Text className="text-sky-500 text-sm mt-2 font-medium">{distance}</Text>
          ) : null}
        </View>
        <View className="bg-sky-500/20 p-3 rounded-full">
          <Navigation size={20} color="#0EA5E9" />
        </View>
      </View>
    </Card>
  )
}

export default MapCard
