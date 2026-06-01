import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { Button } from '@/components/ui/Button'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { CityAutocompleteInput } from '@/components/ui/CityAutocompleteInput'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { parseIsoDateString } from '@/utils/date-format'
import { useCreateTripMutation } from '@/hooks/trips/use-create-trip-mutation'
import { usePlanTripMutation } from '@/hooks/trips/use-plan-trip-mutation'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'
import { setupTripPushAndNotifications } from '@/services/push/trip-push-service'

export default function TripWizardScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { user } = useAuth()
  const createTrip = useCreateTripMutation()
  const planTrip = usePlanTripMutation()

  const [destination, setDestination] = useState('')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [travelers, setTravelers] = useState('2')
  const [budget, setBudget] = useState('')
  const [origin, setOrigin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (!destination.trim()) {
      setError('Enter a destination')
      return
    }
    setError(null)

    try {
      const destinationName = destination.trim()
      const trip = await createTrip.mutateAsync({
        title: title.trim() || destinationName,
        destination: destinationName,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        travelers: Number(travelers) || 1,
        budgetUsd: budget ? Number(budget) : undefined,
        originCity: origin.trim() || undefined,
        status: 'draft',
      })

      await planTrip.mutateAsync(trip.id)

      if (user) {
        void setupTripPushAndNotifications({
          userId: user.id,
          tripId: trip.id,
          destination: trip.destination,
          startDate: trip.start_date,
        }).catch((notificationError) => {
          console.warn(
            'Could not set up trip notifications:',
            notificationError instanceof Error ? notificationError.message : notificationError,
          )
        })
      }

      router.replace(`/trip/${trip.id}` as never)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create trip')
    }
  }

  const busy = createTrip.isPending || planTrip.isPending

  return (
    <RequireSession>
      <ScreenWrapper scroll keyboardAvoiding>
        <ScreenHeader
          title="Trip wizard"
          subtitle="Creates trip · AI itinerary · live APIs"
          showBack
        />

        {error ? (
          <Text className="text-red-500 text-sm mb-4">{error}</Text>
        ) : null}

        <View className="gap-4">
          <Input
            label="Trip title"
            placeholder="Bali Adventure"
            value={title}
            onChangeText={setTitle}
          />
          <CityAutocompleteInput
            label="Destination"
            placeholder="Bali, Indonesia"
            value={destination}
            onChangeText={setDestination}
            listZIndex={20}
          />
          <CityAutocompleteInput
            label="Origin city"
            placeholder="Delhi, India"
            value={origin}
            onChangeText={setOrigin}
            listZIndex={10}
          />
          <DatePickerField
            label="Start date"
            placeholder="Select start date"
            value={startDate}
            onChange={(iso) => {
              setStartDate(iso)
              const start = parseIsoDateString(iso)
              const end = parseIsoDateString(endDate)
              if (start && end && end < start) setEndDate('')
            }}
            minimumDate={new Date()}
          />
          <DatePickerField
            label="End date"
            placeholder="Select end date"
            value={endDate}
            onChange={setEndDate}
            minimumDate={parseIsoDateString(startDate) ?? new Date()}
          />
          <Input
            label="Travelers"
            placeholder="2"
            keyboardType="numeric"
            value={travelers}
            onChangeText={setTravelers}
          />
          <Input
            label="Budget (INR)"
            placeholder="50000"
            keyboardType="numeric"
            value={budget}
            onChangeText={setBudget}
          />
        </View>

        <Text className={`${theme.textMuted} text-sm mt-6 leading-5`}>
          We geocode your destination (Nominatim), fetch Open-Meteo weather and OpenStreetMap
          hotel samples, then Groq builds your itinerary, budget, and packing list in Supabase.
        </Text>

        <Button
          title={busy ? 'Building your trip…' : 'Create & plan trip'}
          className="mt-8"
          onPress={handleContinue}
          disabled={busy}
        />
      </ScreenWrapper>
    </RequireSession>
  )
}
