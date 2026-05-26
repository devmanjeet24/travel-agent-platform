import { useState } from 'react'
import { Image, Linking, Pressable, Text, View } from 'react-native'
import { MapPin, Star } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { formatInrPerNight } from '@/utils/currency'
import {
  hotelAddress,
  hotelFallbackImageUrl,
  hotelPriceLabel,
  hotelSourceLabel,
  hotelWebsite,
  normalizeHotelImageUrl,
} from '@/utils/hotel-display'
import type { TripHotelRow } from '@/types/database'

type Props = {
  hotel: TripHotelRow
  compact?: boolean
}

export function TripHotelCard({ hotel, compact }: Props) {
  const theme = useThemedStyles()
  const [imageBroken, setImageBroken] = useState(false)
  const address = hotelAddress(hotel.raw)
  const website = hotelWebsite(hotel.raw)
  const imageUri = normalizeHotelImageUrl(hotel.image_url) ?? hotelFallbackImageUrl(hotel.raw)
  const showImage = imageUri && !imageBroken

  return (
    <Card className="mb-4 p-0 overflow-hidden" padded={false}>
      {showImage ? (
        <Image
          source={{ uri: imageUri }}
          className={compact ? 'w-full h-28' : 'w-full h-36'}
          resizeMode="cover"
          onError={() => setImageBroken(true)}
        />
      ) : (
        <View
          className={`w-full ${compact ? 'h-28' : 'h-36'} bg-slate-200/80 dark:bg-slate-800 items-center justify-center`}
        >
          <Text className={`${theme.textMuted} text-sm`}>Photo unavailable</Text>
        </View>
      )}
      <View className="px-4 py-3">
        <Text className={`${theme.text} ${compact ? 'text-base' : 'text-lg'} font-bold`}>
          {hotel.name}
        </Text>
        {hotel.rating != null ? (
          <View className="flex-row items-center mt-2 gap-1.5">
            <Star size={14} color="#F59E0B" fill="#F59E0B" />
            <Text className={`${theme.textMuted} text-sm`}>{hotel.rating} stars</Text>
          </View>
        ) : null}
        {address ? (
          <View className="flex-row items-start mt-2 gap-1.5">
            <MapPin size={14} color="#94A3B8" style={{ marginTop: 2 }} />
            <Text className={`${theme.textMuted} text-xs flex-1`} numberOfLines={compact ? 2 : undefined}>
              {address}
            </Text>
          </View>
        ) : null}
        {!compact ? (
          <Text className={`${theme.textMuted} text-xs mt-3`}>
            {hotelSourceLabel(hotel.raw)} · {hotelPriceLabel(hotel.raw)}
          </Text>
        ) : null}
        <Text className="text-yellow-600 font-bold mt-2">
          {hotel.price_per_night_usd != null
            ? formatInrPerNight(hotel.price_per_night_usd)
            : 'Price on request'}
        </Text>
        {website && !compact ? (
          <Pressable onPress={() => void Linking.openURL(website)} className="mt-3">
            <Text className="text-yellow-600 text-sm font-semibold">Visit website</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  )
}
