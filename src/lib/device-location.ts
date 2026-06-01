import * as Location from 'expo-location'

export type DeviceOriginCityResult =
  | { ok: true; city: string }
  | { ok: false; reason: 'denied' | 'unavailable' }

/** Format like Nominatim city suggestions: "Delhi, India". */
export function formatOriginCityFromAddress(
  address: Location.LocationGeocodedAddress,
): string | null {
  const city =
    address.city?.trim() ||
    address.subregion?.trim() ||
    address.district?.trim() ||
    address.region?.trim()
  if (!city) return null
  const country = address.country?.trim()
  return country ? `${city}, ${country}` : city
}

export async function detectDeviceOriginCity(): Promise<DeviceOriginCityResult> {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  let position: Location.LocationObject | null = null
  try {
    position = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60_000,
      requiredAccuracy: 5_000,
    })
  } catch {
    position = null
  }

  if (!position) {
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  }

  let addresses: Location.LocationGeocodedAddress[]
  try {
    addresses = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }

  for (const address of addresses) {
    const city = formatOriginCityFromAddress(address)
    if (city) return { ok: true, city }
  }

  return { ok: false, reason: 'unavailable' }
}
