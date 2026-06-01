import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Calendar, MapPin, Trash2 } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { brand, defaultTripImage, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import { radii } from '@/lib/ui-styles'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { useResponsive } from '@/hooks/use-responsive'

type Status = 'upcoming' | 'saved' | 'completed'

interface Props {
  title: string
  subtitle: string
  dates: string
  imageUri?: string
  status?: Status
  onPress?: () => void
  onDelete?: () => void
  /** Space below card — use 0 on last item */
  gapAfter?: number
}

function statusPill(status: Status) {
  if (status === 'upcoming') {
    return { bg: 'rgba(245,158,11,0.92)', text: '#FFFFFF', label: 'Upcoming' }
  }
  if (status === 'completed') {
    return { bg: 'rgba(16,185,129,0.92)', text: '#FFFFFF', label: 'Completed' }
  }
  return { bg: 'rgba(255,255,255,0.94)', text: brand.primaryDark, label: 'Saved' }
}

export function ItineraryCard({
  title,
  subtitle,
  dates,
  imageUri,
  status = 'saved',
  onPress,
  onDelete,
  gapAfter = spacing.xl,
}: Props) {
  const theme = useThemedStyles()
  const { scaleFont, contentWidth } = useResponsive()
  const cardHeight = Math.min(Math.max(Math.round(contentWidth * 0.52), 180), 240)
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const candidate = imageUri ?? defaultTripImage
  const source = failedUri === candidate ? defaultTripImage : candidate
  const pill = statusPill(status)

  return (
    <View style={{ width: contentWidth, marginBottom: gapAfter, alignSelf: 'center' }}>
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}>
        <View
          style={[
            styles.card,
            {
              width: contentWidth,
              height: cardHeight,
              backgroundColor: theme.colors.muted,
            },
          ]}
        >
          <Image
            key={source}
            source={{ uri: source }}
            style={{ width: contentWidth, height: cardHeight }}
            resizeMode="cover"
            onError={() => {
              if (source !== defaultTripImage) setFailedUri(candidate)
            }}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.38, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.topRow}>
            <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
              <Text style={textWithWeight(typography.caption, '700', { color: pill.text, fontSize: 11 })}>
                {pill.label}
              </Text>
            </View>
            {onDelete ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.()
                  onDelete()
                }}
                hitSlop={10}
                accessibilityLabel="Delete trip"
                style={styles.deleteBtn}
              >
                <Trash2 size={16} color="#FFFFFF" strokeWidth={1.75} />
              </Pressable>
            ) : (
              <View style={styles.deleteSpacer} />
            )}
          </View>

          <View style={styles.footer}>
            <Text
              style={textWithWeight(typography.h1, '800', {
                color: '#FFFFFF',
                fontSize: scaleFont(22),
                letterSpacing: -0.5,
                lineHeight: scaleFont(28),
              })}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View style={styles.metaRow}>
              <MapPin size={13} color="rgba(255,255,255,0.88)" />
              <Text
                style={{ ...typography.caption, color: 'rgba(255,255,255,0.88)', marginLeft: 6, flex: 1 }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
            <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
              <Calendar size={13} color="rgba(255,255,255,0.88)" />
              <Text
                style={textWithWeight(typography.caption, '600', {
                  color: 'rgba(255,255,255,0.88)',
                  marginLeft: 6,
                })}
                numberOfLines={1}
              >
                {dates}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    elevation: 0,
  },
  topRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSpacer: {
    width: 38,
    height: 38,
  },
  footer: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
})

export default ItineraryCard
