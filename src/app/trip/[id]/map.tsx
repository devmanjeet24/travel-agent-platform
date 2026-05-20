import { ScrollView, View } from 'react-native'

import {
  AttractionRow,
  openAttractionInMaps,
  TripMap,
} from '@/components/maps/TripMap'
import { demoBaliAttractions } from '@/constants/trip-attractions'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function MapScreen() {
  const theme = useThemedStyles()

  return (
    <ScrollView
      className={`flex-1 ${theme.bg}`}
      contentContainerClassName="px-5 pb-8 pt-2"
      showsVerticalScrollIndicator={false}
    >
      <View className="h-[360px]">
        <TripMap attractions={demoBaliAttractions} />
      </View>

      {demoBaliAttractions.map((a) => (
        <AttractionRow
          key={a.id}
          attraction={a}
          onNavigate={() => openAttractionInMaps(a)}
        />
      ))}
    </ScrollView>
  )
}
