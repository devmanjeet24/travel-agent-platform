import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Calendar } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { defaultTripImage, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { formatTripDates, tripDaysUntil } from '@/services/trips/trip-api'
import type { TripRow } from '@/types/database'
import { tripCardLabels, tripImageUri } from '@/utils/trip-display'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useResponsive } from '@/hooks/use-responsive'

function statusTint(status: TripRow['status'], isDark: boolean) {
  if (status === 'upcoming') {
    return { bg: 'rgba(245,158,11,0.92)', text: '#FFFFFF' }
  }
  if (status === 'completed') {
    return { bg: 'rgba(16,185,129,0.92)', text: '#FFFFFF' }
  }
  return {
    bg: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
    text: isDark ? '#F8FAFC' : '#334155',
  }
}

interface Props {
  trip: TripRow
  width: number
  height: number
  onPress: () => void
}

export function CompactTripCard({ trip, width, height, onPress }: Props) {
  const theme = useThemedStyles()
  const { scaleFont } = useResponsive()
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null)
  const uri = tripImageUri(trip)
  const imageSource = failedImageUri === uri ? defaultTripImage : uri
  const labels = tripCardLabels(trip)
  const eyebrow =
    trip.status === 'upcoming'
      ? `${tripDaysUntil(trip.start_date) ?? '—'} days`
      : trip.status === 'completed'
        ? 'Completed'
        : 'Saved'
  const tint = statusTint(trip.status, theme.isDark)

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
      <View style={[styles.card, { width, height, backgroundColor: theme.colors.muted }]}>
        <Image
          key={imageSource}
          source={{ uri: imageSource }}
          style={{ width, height }}
          resizeMode="cover"
          onError={() => {
            if (imageSource !== defaultTripImage) setFailedImageUri(uri)
          }}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.badge, { backgroundColor: tint.bg }]}>
          <Text
            style={textWithWeight(typography.caption, '700', {
              fontSize: scaleFont(10),
              color: tint.text,
            })}
          >
            {eyebrow}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text
            style={textWithWeight(typography.h3, '700', {
              color: '#FFFFFF',
              fontSize: scaleFont(15),
            })}
            numberOfLines={2}
          >
            {labels.displayTitle}
          </Text>
          <View style={styles.dateRow}>
            <Calendar size={11} color="rgba(255,255,255,0.85)" />
            <Text
              style={textWithWeight(typography.caption, '600', {
                color: 'rgba(255,255,255,0.85)',
                marginLeft: 4,
              })}
              numberOfLines={1}
            >
              {formatTripDates(trip.start_date, trip.end_date)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    elevation: 0,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  footer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
})

export default CompactTripCard
