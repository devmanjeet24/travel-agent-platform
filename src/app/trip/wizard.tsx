import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { RequireSession } from '@/components/auth/require-session'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import { useCreateTripMutation } from '@/hooks/trips/use-create-trip-mutation'
import { usePlanTripMutation } from '@/hooks/trips/use-plan-trip-mutation'
import { createTripNotifications } from '@/services/notifications/notification-api'
import { scheduleTripReminder } from '@/lib/notifications-setup'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useAuth } from '@/providers/auth-provider'

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
      const trip = await createTrip.mutateAsync({
        title: title.trim() || `${destination.trim()} trip`,
        destination: destination.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        travelers: Number(travelers) || 1,
        budgetUsd: budget ? Number(budget) : undefined,
        originCity: origin.trim() || undefined,
        status: 'draft',
      })

      await planTrip.mutateAsync(trip.id)

      if (user) {
        await createTripNotifications({
          userId: user.id,
          tripId: trip.id,
          destination: trip.destination,
          startDate: trip.start_date,
        })
      }

      if (trip.start_date) {
        const remind = new Date(trip.start_date)
        remind.setDate(remind.getDate() - 1)
        await scheduleTripReminder({
          title: 'Trip tomorrow',
          body: `Your trip to ${trip.destination} starts soon.`,
          triggerDate: remind,
        })
      }

      router.replace(`/(tabs)/chat?tripId=${trip.id}` as never)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create trip')
    }
  }

  const busy = createTrip.isPending || planTrip.isPending

  return (
    <RequireSession>
      <ScreenWrapper scroll>
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
          <Input
            label="Destination"
            placeholder="Bali, Indonesia"
            value={destination}
            onChangeText={setDestination}
          />
          <Input
            label="Origin city (for flights)"
            placeholder="Delhi, India"
            value={origin}
            onChangeText={setOrigin}
          />
          <Input
            label="Start date"
            placeholder="2026-08-12"
            value={startDate}
            onChangeText={setStartDate}
          />
          <Input
            label="End date"
            placeholder="2026-08-20"
            value={endDate}
            onChangeText={setEndDate}
          />
          <Input
            label="Travelers"
            placeholder="2"
            keyboardType="numeric"
            value={travelers}
            onChangeText={setTravelers}
          />
          <Input
            label="Budget (USD)"
            placeholder="3000"
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
