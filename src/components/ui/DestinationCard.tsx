import { Image, Text, View } from 'react-native'
import { Star } from 'lucide-react-native'

import { Card } from './Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

interface Props {
  name: string
  country: string
  rating: number
  image: string
  onPress?: () => void
  compact?: boolean
}

export function DestinationCard({
  name,
  country,
  rating,
  image,
  onPress,
  compact,
}: Props) {
  const theme = useThemedStyles()

  if (compact) {
    return (
      <Card onPress={onPress} className="w-40 mr-3 p-0 overflow-hidden" padded={false}>
        <Image source={{ uri: image }} className="w-full h-28" />
        <View className="p-3">
          <Text className={`${theme.text} font-semibold`}>{name}</Text>
          <Text className={`${theme.textMuted} text-xs`}>{country}</Text>
        </View>
      </Card>
    )
  }

  return (
    <Card onPress={onPress} className="mb-4 p-0 overflow-hidden flex-row" padded={false}>
      <Image source={{ uri: image }} className="w-28 h-28" />
      <View className="flex-1 p-4 justify-center">
        <Text className={`${theme.text} text-lg font-bold`}>{name}</Text>
        <Text className={`${theme.textMuted} text-sm mt-0.5`}>{country}</Text>
        <View className="flex-row items-center mt-2 gap-1">
          <Star size={14} color="#F59E0B" fill="#F59E0B" />
          <Text className={`${theme.textMuted} text-sm`}>{rating}</Text>
        </View>
      </View>
    </Card>
  )
}

export default DestinationCard
