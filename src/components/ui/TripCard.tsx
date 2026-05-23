import { Image, Pressable, Text, View } from 'react-native'
import { ChevronRight, MapPin, Trash2 } from 'lucide-react-native'

import { brand, defaultTripImage } from '@/constants/design'
import { radii } from '@/lib/ui-styles'
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
    return { bg: isDark ? 'rgba(250,204,21,0.2)' : '#FEF9C3', text: '#A16207', label: 'Upcoming' }
  }
  if (status === 'completed') {
    return { bg: isDark ? 'rgba(22,163,74,0.2)' : '#DCFCE7', text: '#15803D', label: 'Done' }
  }
  return { bg: isDark ? 'rgba(255,255,255,0.1)' : '#F5F5F5', text: isDark ? '#D4D4D4' : '#525252', label: 'Saved' }
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

  return (
    <Card onPress={onPress} className="mb-4" padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={{ uri: imageUri ?? defaultTripImage }}
          style={{
            width: 88,
            height: 88,
            borderTopLeftRadius: radii.lg,
            borderBottomLeftRadius: radii.lg,
          }}
        />
        <View style={{ flex: 1, padding: 16, paddingLeft: 14 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: badge.bg,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radii.pill,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700' }}>
              {badge.label}
            </Text>
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 17,
              fontWeight: '700',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <MapPin size={12} color={theme.colors.icon} />
            <Text
              style={{ color: theme.colors.textMuted, fontSize: 13 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, gap: 6 }}>
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
                borderRadius: 18,
                backgroundColor: theme.isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
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
              borderRadius: 18,
              backgroundColor: theme.colors.muted,
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
