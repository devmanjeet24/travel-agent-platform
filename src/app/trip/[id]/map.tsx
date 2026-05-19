import { View } from 'react-native'

import { MapCard } from '@/components/ui/MapCard'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const attractions = [
  { title: 'Tegallalang Rice Terrace', subtitle: 'Ubud · Cultural site', distance: '45 min from Seminyak' },
  { title: 'Tanah Lot Temple', subtitle: 'Tabanan · Sunset spot', distance: '1h 10 min drive' },
  { title: 'Seminyak Beach', subtitle: 'Beach · Near hotel', distance: '8 min walk' },
]

export default function MapScreen() {
  const theme = useThemedStyles()

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      {attractions.map((a, i) => (
        <MapCard key={i} {...a} />
      ))}
    </View>
  )
}
