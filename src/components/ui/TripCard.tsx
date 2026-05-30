import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { ChevronRight, MapPin, Trash2 } from 'lucide-react-native'

import { brand, defaultTripImage, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { Card } from './Card'

interface Props {
  title: string
  subtitle: string
  imageUri?: string
  status?: 'upcoming' | 'saved' | 'completed'
  onPress?: () => void
  onDelete?: () => void
}

function statusStyle(status: Props['status'], isDark: boolean) {
  if (status === 'upcoming') {
    return {
      bg: isDark ? 'rgba(245,158,11,0.18)' : brand.warningMuted,
      text: '#B45309',
      label: 'Upcoming',
    }
  }
  if (status === 'completed') {
    return {
      bg: isDark ? 'rgba(16,185,129,0.18)' : brand.successMuted,
      text: '#047857',
      label: 'Done',
    }
  }
  return {
    bg: isDark ? 'rgba(148,163,184,0.12)' : '#F4F6F9',
    text: isDark ? '#CBD5E1' : '#475569',
    label: 'Saved',
  }
}

export function TripCard({
  title,
  subtitle,
  imageUri,
  status = 'saved',
  onPress,
  onDelete,
}: Props) {
  const theme = useThemedStyles()
  const badge = statusStyle(status, theme.isDark)
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null)
  const candidateImageUri = imageUri ?? defaultTripImage
  const imageSource = failedImageUri === candidateImageUri ? defaultTripImage : candidateImageUri

  return (
    <Card onPress={onPress} className="mb-3" padded={false} style={[{ marginBottom: spacing.md }, cardShadow(theme.isDark, false)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          key={imageSource}
          source={{ uri: imageSource }}
          style={{
            width: 88,
            height: 88,
            borderTopLeftRadius: radii.lg,
            borderBottomLeftRadius: radii.lg,
          }}
          onError={() => {
            if (imageSource !== defaultTripImage) setFailedImageUri(candidateImageUri)
          }}
        />
        <View style={{ flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: badge.bg,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: radii.pill,
              marginBottom: spacing.sm,
            }}
          >
            <Text style={textWithWeight(typography.caption, '700', { color: badge.text })}>
              {badge.label}
            </Text>
          </View>
          <Text style={{ ...typography.h3, color: theme.colors.text }} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
            <MapPin size={12} color={theme.colors.icon} />
            <Text style={{ ...typography.caption, color: theme.colors.textMuted }} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md, gap: spacing.sm }}>
          {onDelete ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.()
                onDelete()
              }}
              hitSlop={10}
              accessibilityLabel="Delete trip"
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.sm,
                backgroundColor: theme.isDark ? 'rgba(239,68,68,0.12)' : brand.dangerMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={16} color={brand.danger} />
            </Pressable>
          ) : null}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.pill,
              backgroundColor: theme.colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronRight size={18} color={brand.primaryDark} />
          </View>
        </View>
      </View>
    </Card>
  )
}

export default TripCard
