import { useMemo, useState } from 'react'
import { FlatList, Image, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Bell, Map, MessageSquare, Wand2 } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { CategoryChipRow } from '@/components/ui/CategoryChipRow'
import { CompactTripCard } from '@/components/ui/CompactTripCard'
import { DestinationCard } from '@/components/ui/DestinationCard'
import { HeroTripCard } from '@/components/ui/HeroTripCard'
import { HomeSearchBar } from '@/components/ui/HomeSearchBar'
import { HeroSkeleton } from '@/components/ui/LoadingSkeleton'
import { NativeHorizontalRail } from '@/components/ui/NativeHorizontalRail'
import SectionTitle from '@/components/ui/SectionTitle'
import { ShortcutTile } from '@/components/ui/ShortcutTile'
import { StatCard } from '@/components/ui/StatCard'
import { TravelBanner } from '@/components/ui/TravelBanner'
import {
  brand,
  defaultTripImage,
  exploreDestinations,
  spacing,
  travelBanners,
} from '@/constants/design'
import { typography } from '@/constants/typography'
import { useResponsive } from '@/hooks/use-responsive'
import { useTabScreenInsets } from '@/hooks/use-tab-screen-insets'
import { useJourneyStats } from '@/hooks/profile/use-journey-stats'
import { useSyncProfileStats } from '@/hooks/profile/use-sync-profile-stats'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { useSyncTripDestinations } from '@/hooks/trips/use-sync-trip-destinations'
import { formatTripDates, tripDaysUntil } from '@/services/trips/trip-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { cardShadow, radii } from '@/lib/ui-styles'
import { tripCardLabels, tripImageUri } from '@/utils/trip-display'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  all: [],
  beach: ['beach', 'ocean', 'island', 'reef', 'caldera', 'bali', 'maldives', 'santorini'],
  mountains: ['peak', 'alps', 'mountain', 'swiss', 'scenic'],
  city: ['city', 'neon', 'skyline', 'paris', 'tokyo', 'dubai', 'art'],
  culture: ['culture', 'temple', 'art', 'romance', 'food'],
}

type HomeSection =
  | 'header'
  | 'hero'
  | 'search'
  | 'categories'
  | 'explore'
  | 'shortcuts'
  | 'inspired'
  | 'trips'
  | 'stats'

function destinationPressParams(name: string) {
  return {
    pathname: '/destination/[id]' as const,
    params: { id: encodeURIComponent(name) },
  }
}

function filterByCategory(categoryId: string) {
  const keys = CATEGORY_KEYWORDS[categoryId] ?? []
  if (!keys.length) return exploreDestinations
  return exploreDestinations.filter((d) => {
    const hay = `${d.name} ${d.country} ${d.tagline}`.toLowerCase()
    return keys.some((k) => hay.includes(k))
  })
}

export default function HomeScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { displayName } = useAuth()
  const { data: trips, isLoading } = useTripsQuery()
  const { stats } = useJourneyStats()
  const { scrollBottomPadding } = useTabScreenInsets()
  useSyncProfileStats()
  useSyncTripDestinations(trips)

  const [categoryId, setCategoryId] = useState('all')

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = displayName.split(' ')[0]

  const upcoming =
    trips?.find((t) => t.status === 'upcoming') ??
    trips?.find((t) => t.status === 'saved') ??
    trips?.[0]

  const {
    scaleFont,
    destinationCardWidth,
    isSmallPhone,
    contentWidth,
    bannerWidth,
    horizontalPadding,
  } = useResponsive()
  const tripPeekWidth = Math.min(176, Math.max(152, Math.round(contentWidth * 0.44)))
  const statGap = spacing.sm
  const statWidth = Math.floor((contentWidth - statGap * 2) / 3)
  const upcomingLabels = upcoming ? tripCardLabels(upcoming) : null

  const destinationRailHeight = Math.round(destinationCardWidth * 1.35)
  const bannerRailHeight = Math.min(bannerWidth * 0.62, isSmallPhone ? 168 : 196)
  const tripRailHeight = Math.round(tripPeekWidth * 1.28)
  const heroFallbackHeight = Math.min(contentWidth * 0.55, 220)

  const filteredDestinations = useMemo(() => filterByCategory(categoryId), [categoryId])
  const tripRail = useMemo(() => (trips ?? []).slice(0, 6), [trips])

  const sections = useMemo<HomeSection[]>(() => {
    const list: HomeSection[] = [
      'header',
      'hero',
      'search',
      'categories',
      'explore',
      'shortcuts',
      'inspired',
    ]
    if (tripRail.length > 0) list.push('trips')
    list.push('stats')
    return list
  }, [tripRail.length])

  function renderSection({ item }: { item: HomeSection }) {
    switch (item) {
      case 'header':
        return (
          <View style={{ width: contentWidth, paddingTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 0, marginRight: spacing.md }}>
                <Text style={{ ...typography.eyebrow, color: theme.colors.textMuted }}>
                  {greeting}
                </Text>
                <Text
                  style={{
                    ...typography.display,
                    fontSize: scaleFont(isSmallPhone ? 26 : 30),
                    color: theme.colors.text,
                    marginTop: spacing.xs,
                    letterSpacing: -0.8,
                  }}
                  numberOfLines={1}
                >
                  Hi, {firstName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open alerts"
                onPress={() => router.push('/(tabs)/notifications')}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.88 : 1,
                  flexShrink: 0,
                })}
              >
                <Bell size={20} color={theme.colors.text} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        )

      case 'hero':
        return (
          <View style={{ width: contentWidth, marginTop: spacing.xl }}>
            {isLoading ? (
              <HeroSkeleton />
            ) : upcoming ? (
              <HeroTripCard
                imageUri={tripImageUri(upcoming)}
                eyebrow={
                  upcoming.status === 'upcoming'
                    ? `Upcoming · ${tripDaysUntil(upcoming.start_date) ?? '—'} days`
                    : 'Continue planning'
                }
                title={upcomingLabels?.displayTitle ?? upcoming.destination}
                dates={formatTripDates(upcoming.start_date, upcoming.end_date)}
                onPress={() => router.push(`/trip/${upcoming.id}`)}
              />
            ) : (
              <Pressable
                onPress={() => router.push('/trip/wizard')}
                style={({ pressed }) => [
                  {
                    width: contentWidth,
                    height: heroFallbackHeight,
                    borderRadius: radii['2xl'],
                    overflow: 'hidden',
                    opacity: pressed ? 0.96 : 1,
                  },
                  cardShadow(theme.isDark),
                ]}
              >
                <Image
                  source={{ uri: defaultTripImage }}
                  style={{ width: contentWidth, height: heroFallbackHeight }}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.75)']}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: spacing.xl,
                    right: spacing.xl,
                    bottom: spacing.xl,
                  }}
                >
                  <Text style={{ ...typography.h1, color: '#FFFFFF', fontSize: scaleFont(24) }}>
                    Plan your first trip
                  </Text>
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: 'rgba(255,255,255,0.85)',
                      marginTop: spacing.sm,
                    }}
                  >
                    AI itineraries with live flights, hotels & weather
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        )

      case 'search':
        return (
          <View style={{ width: contentWidth, marginTop: spacing.xl }}>
            <HomeSearchBar width={contentWidth} onPress={() => router.push('/(tabs)/chat')} />
          </View>
        )

      case 'categories':
        return (
          <View style={{ width: contentWidth }}>
            <CategoryChipRow
              width={contentWidth}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          </View>
        )

      case 'explore':
        return (
          <View style={{ width: contentWidth }}>
            <SectionTitle
              title="Explore"
              subtitle="Tap a destination to start planning"
              compactTop
              actionLabel="AI Chat"
              onActionPress={() => router.push('/(tabs)/chat')}
            />
            {filteredDestinations.length > 0 ? (
              <NativeHorizontalRail width={contentWidth} height={destinationRailHeight}>
                {filteredDestinations.map((d) => (
                  <DestinationCard
                    key={d.id}
                    name={d.name}
                    country={d.country}
                    tagline={d.tagline}
                    image={d.image}
                    width={destinationCardWidth}
                    height={destinationRailHeight}
                    onPress={() => router.push(destinationPressParams(d.name))}
                  />
                ))}
              </NativeHorizontalRail>
            ) : (
              <View
                style={{
                  padding: spacing.xl,
                  borderRadius: radii.xl,
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  marginBottom: spacing.lg,
                }}
              >
                <Text
                  style={{ ...typography.bodySm, color: theme.colors.textMuted, textAlign: 'center' }}
                >
                  No destinations match this category. Try another filter or open AI Chat to plan.
                </Text>
              </View>
            )}
          </View>
        )

      case 'shortcuts': {
        const tileGap = spacing.sm
        const tileWidth = Math.floor((contentWidth - tileGap * 2) / 3)
        return (
          <View style={{ width: contentWidth }}>
            <SectionTitle title="Plan your trip" subtitle="Choose how you want to start" />
            <View style={{ flexDirection: 'row', width: contentWidth }}>
              <ShortcutTile
                label="AI Chat"
                icon={MessageSquare}
                width={tileWidth}
                accent
                onPress={() => router.push('/(tabs)/chat')}
              />
              <View style={{ width: tileGap }} />
              <ShortcutTile
                label="Wizard"
                icon={Wand2}
                width={tileWidth}
                onPress={() => router.push('/trip/wizard')}
              />
              <View style={{ width: tileGap }} />
              <ShortcutTile
                label="My Trips"
                icon={Map}
                width={tileWidth}
                onPress={() => router.push('/(tabs)/trips')}
              />
            </View>
          </View>
        )
      }

      case 'inspired':
        return (
          <View style={{ width: contentWidth }}>
            <SectionTitle
              title="Get inspired"
              subtitle="Curated themes for your next escape"
              actionLabel="See all"
              onActionPress={() => router.push('/(tabs)/chat')}
            />
            <NativeHorizontalRail width={contentWidth} height={bannerRailHeight}>
              {travelBanners.map((banner) => (
                <TravelBanner
                  key={banner.id}
                  title={banner.title}
                  subtitle={banner.subtitle}
                  image={banner.image}
                  cta={banner.cta}
                  width={bannerWidth}
                  height={bannerRailHeight}
                  onPress={() => router.push('/(tabs)/chat')}
                />
              ))}
            </NativeHorizontalRail>
          </View>
        )

      case 'trips':
        return (
          <View style={{ width: contentWidth }}>
            <SectionTitle
              title="Your trips"
              subtitle="All your saved adventures"
              actionLabel="View all"
              onActionPress={() => router.push('/(tabs)/trips')}
            />
            <NativeHorizontalRail width={contentWidth} height={tripRailHeight}>
              {tripRail.map((trip) => (
                <CompactTripCard
                  key={trip.id}
                  trip={trip}
                  width={tripPeekWidth}
                  height={tripRailHeight}
                  onPress={() => router.push(`/trip/${trip.id}`)}
                />
              ))}
            </NativeHorizontalRail>
          </View>
        )

      case 'stats':
        return (
          <View style={{ width: contentWidth, marginBottom: spacing.md }}>
            <SectionTitle title="Your journey" subtitle="Travel stats synced to your account" />
            <View style={{ flexDirection: 'row', width: contentWidth }}>
              <StatCard label="Trips" value={stats.tripsCount} width={statWidth} style={{ marginRight: statGap }} />
              <StatCard
                label="Countries"
                value={stats.countriesCount}
                accent={brand.accent}
                width={statWidth}
                style={{ marginRight: statGap }}
              />
              <StatCard label="AI plans" value={stats.aiPlansCount} accent={brand.ai} width={statWidth} />
            </View>
          </View>
        )

      default:
        return null
    }
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={sections}
        keyExtractor={(item) => item}
        renderItem={renderSection}
        extraData={{ categoryId, isLoading, trips, stats, isDark: theme.isDark }}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: scrollBottomPadding,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  )
}
