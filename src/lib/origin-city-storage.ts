import AsyncStorage from '@react-native-async-storage/async-storage'

const ORIGIN_CITY_STORAGE_KEY = 'travel-agent.origin-city.v1'

export async function loadStoredOriginCity(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(ORIGIN_CITY_STORAGE_KEY)
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

export async function saveStoredOriginCity(city: string): Promise<void> {
  const trimmed = city.trim()
  if (!trimmed) {
    await AsyncStorage.removeItem(ORIGIN_CITY_STORAGE_KEY)
    return
  }
  await AsyncStorage.setItem(ORIGIN_CITY_STORAGE_KEY, trimmed)
}
