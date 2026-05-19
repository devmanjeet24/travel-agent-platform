import { useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Bot, Map, Wallet } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import ScreenWrapper from '@/components/ui/ScreenWrapper'

const { width } = Dimensions.get('window')

const slides = [
  {
    id: '1',
    title: 'Plan with AI',
    description:
      'Describe your dream trip and let our AI ask smart questions to build the perfect plan.',
    Icon: Bot,
    color: '#0EA5E9',
  },
  {
    id: '2',
    title: 'Everything in one place',
    description:
      'Flights, hotels, itineraries, budgets, maps, and packing lists — all from one chat.',
    Icon: Map,
    color: '#8B5CF6',
  },
  {
    id: '3',
    title: 'Travel smarter',
    description:
      'Save trips offline, get reminders, and export beautiful PDFs to share with friends.',
    Icon: Wallet,
    color: '#10B981',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    setIndex(i)
  }

  const next = () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 })
    } else {
      router.replace('/(auth)/login')
    }
  }

  const skip = () => router.replace('/(auth)/login')

  return (
    <ScreenWrapper padded={false} className="bg-slate-950">
      <View className="flex-row justify-end px-5 pt-4">
        <Button title="Skip" variant="ghost" size="sm" onPress={skip} />
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const { Icon } = item
          return (
            <View style={{ width }} className="px-8 items-center justify-center flex-1">
              <View
                className="w-28 h-28 rounded-full items-center justify-center mb-10"
                style={{ backgroundColor: `${item.color}22` }}
              >
                <Icon size={56} color={item.color} />
              </View>
              <Text className="text-white text-3xl font-bold text-center">
                {item.title}
              </Text>
              <Text className="text-slate-400 text-center mt-4 text-lg leading-7 px-4">
                {item.description}
              </Text>
            </View>
          )
        }}
      />

      <View className="flex-row justify-center gap-2 mb-6">
        {slides.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${i === index ? 'w-8 bg-sky-500' : 'w-2 bg-slate-700'}`}
          />
        ))}
      </View>

      <View className="px-5 pb-8">
        <Button
          title={index === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={next}
        />
      </View>
    </ScreenWrapper>
  )
}
