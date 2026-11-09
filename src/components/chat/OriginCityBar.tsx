import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MapPin, Navigation, X } from 'lucide-react-native'

import { CityAutocompleteInput } from '@/components/ui/CityAutocompleteInput'
import { brand, spacing } from '@/constants/design'
import type { OriginCityDetectionStatus } from '@/hooks/use-device-origin-city'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'

type Props = {
  originCity: string
  onChangeOriginCity: (text: string) => void
  status: OriginCityDetectionStatus
  needsManualEntry: boolean
  isDetecting: boolean
  onRetryDetection: () => void
  onDismiss: () => void
  horizontalPadding: number
  /** Override bar background when nested in a shared footer surface. */
  backgroundColor?: string
}

function statusHint(
  status: OriginCityDetectionStatus,
  needsManualEntry: boolean,
  hasCity: boolean,
): string | null {
  if (status === 'loading') return 'Detecting your location…'
  if (status === 'detected' && hasCity) return 'Using your current city as origin. Tap to edit.'
  if (needsManualEntry && !hasCity) {
    return 'Location unavailable — enter your origin city below.'
  }
  if (status === 'denied') return 'Location permission denied — enter your origin city.'
  if (status === 'unavailable') return 'Could not detect city — enter your origin city.'
  if (hasCity) return 'Origin city for flights and transport. Tap to edit.'
  return null
}

export function OriginCityBar({
  originCity,
  onChangeOriginCity,
  status,
  needsManualEntry,
  isDetecting,
  onRetryDetection,
  onDismiss,
  horizontalPadding,
  backgroundColor,
}: Props) {
  const theme = useThemedStyles()
  const hint = statusHint(status, needsManualEntry, originCity.trim().length > 0)

  return (
    <View
      style={{
        paddingHorizontal: horizontalPadding,
        paddingTop: 8,
        paddingBottom: 4,
        borderTopWidth: backgroundColor ? 0 : 1,
        borderTopColor: theme.colors.border,
        backgroundColor: backgroundColor ?? theme.colors.background,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MapPin size={16} color={brand.primaryDark} />
          <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
            Origin city
          </Text>
          {isDetecting ? <ActivityIndicator size="small" color={brand.primaryDark} /> : null}
          {(status === 'denied' || status === 'unavailable') && !isDetecting ? (
            <Pressable
              onPress={onRetryDetection}
              accessibilityRole="button"
              accessibilityLabel="Use my location"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radii.pill,
                backgroundColor: theme.colors.aiMuted,
              }}
            >
              <Navigation size={14} color={brand.primaryDark} />
              <Text style={{ color: brand.primaryDark, fontSize: 12, fontWeight: '600' }}>
                Use location
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss origin city"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 32,
            height: 32,
            marginLeft: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.md,
            flexShrink: 0,
          }}
        >
          <X size={18} color={theme.colors.icon} />
        </Pressable>
      </View>

      {hint ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
          {hint}
        </Text>
      ) : null}

      <CityAutocompleteInput
        label={undefined}
        placeholder="Delhi, India"
        value={originCity}
        onChangeText={onChangeOriginCity}
        listZIndex={30}
        autoCorrect={false}
      />
    </View>
  )
}
