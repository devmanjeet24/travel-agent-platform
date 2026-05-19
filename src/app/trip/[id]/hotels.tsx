import { Image, Text, View } from 'react-native'
import { Star } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const hotels = [
  {
    name: 'The Seminyak Beach Resort',
    rating: 4.8,
    price: '$145/night',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
  },
  {
    name: 'Ubud Valley Lodge',
    rating: 4.6,
    price: '$98/night',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400',
  },
]

export default function HotelsScreen() {
  const theme = useThemedStyles()

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      {hotels.map((h, i) => (
        <Card key={i} className="mb-4 p-0 overflow-hidden" padded={false}>
          <Image source={{ uri: h.image }} className="w-full h-36" />
          <View className="p-4">
            <Text className={`${theme.text} text-lg font-bold`}>{h.name}</Text>
            <View className="flex-row items-center mt-2 gap-1">
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text className={`${theme.textMuted} text-sm`}>{h.rating}</Text>
            </View>
            <Text className="text-sky-500 font-bold mt-2">{h.price}</Text>
          </View>
        </Card>
      ))}
    </View>
  )
}
