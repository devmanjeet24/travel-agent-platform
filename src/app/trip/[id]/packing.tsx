import { Pressable, Text, View } from 'react-native'
import { useState } from 'react'
import { Check } from 'lucide-react-native'

import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/use-themed-styles'

const initialItems = [
  { id: '1', label: 'Passport & visa copies', packed: true },
  { id: '2', label: 'Light rain jacket (tropical weather)', packed: false },
  { id: '3', label: 'Sunscreen SPF 50', packed: false },
  { id: '4', label: 'Comfortable walking shoes', packed: true },
  { id: '5', label: 'Universal power adapter', packed: false },
]

export default function PackingScreen() {
  const theme = useThemedStyles()
  const [items, setItems] = useState(initialItems)

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, packed: !item.packed } : item,
      ),
    )
  }

  const packedCount = items.filter((i) => i.packed).length

  return (
    <View className={`flex-1 ${theme.bg} px-5 pb-8`}>
      <Text className={`${theme.textMuted} text-sm mb-4`}>
        Weather-based suggestions · {packedCount}/{items.length} packed
      </Text>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => toggle(item.id)}>
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
      ))}
    </View>
  )
}
