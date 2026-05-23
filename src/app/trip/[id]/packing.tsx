import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { Check } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import TripScreenWrapper from '@/components/trip/TripScreenWrapper'
import { useTripPackingQuery } from '@/hooks/trips/use-trip-query'
import { togglePackingItem } from '@/services/trips/trip-api'
import { tripKeys } from '@/services/trips/trip-keys'
import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'

export default function PackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const theme = useThemedStyles()
  const queryClient = useQueryClient()
  const { data: items, isLoading } = useTripPackingQuery(id)

  const packedCount = items?.filter((i) => i.packed).length ?? 0

  const toggle = async (itemId: string, packed: boolean) => {
    await togglePackingItem(itemId, !packed)
    void queryClient.invalidateQueries({ queryKey: tripKeys.packing(id!) })
  }

  if (isLoading) {
    return (
      <TripScreenWrapper scroll={false} centered className={theme.bg}>
        <ActivityIndicator color={brand.primaryDark} />
      </TripScreenWrapper>
    )
  }

  return (
    <TripScreenWrapper className={theme.bg}>
      <Text className={`${theme.textMuted} text-sm mb-4`}>
        Weather-based list · {packedCount}/{items?.length ?? 0} packed
      </Text>
      {!items?.length ? (
        <Text className={`${theme.textMuted} text-center`}>
          Generate an AI plan to populate packing items.
        </Text>
      ) : (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => toggle(item.id, item.packed)}>
            <Card className="mb-3 flex-row items-center">
              <View
                className={`w-7 h-7 rounded-lg items-center justify-center mr-4 ${
                  item.packed ? 'bg-emerald-500' : theme.bgMuted
                }`}
              >
                {item.packed ? <Check size={18} color="#fff" /> : null}
              </View>
              <Text
                className={`flex-1 text-base ${
                  item.packed ? `${theme.textMuted} line-through` : theme.text
                }`}
              >
                {item.label}
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </TripScreenWrapper>
  )
}
