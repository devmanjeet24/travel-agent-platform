import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Sparkles } from 'lucide-react-native'

import { DestinationCard } from '@/components/ui/DestinationCard'
import { HeroTripCard } from '@/components/ui/HeroTripCard'
import { QuickActionCard } from '@/components/ui/QuickActionCard'
import SectionTitle from '@/components/ui/SectionTitle'
import { StatCard } from '@/components/ui/StatCard'
import { TravelBanner } from '@/components/ui/TravelBanner'
import ScreenWrapper from '@/components/ui/ScreenWrapper'
import {
  brand,
  featuredDestinations,
  quickActions,
  travelBanners,
} from '@/constants/design'
import { useResponsive } from '@/hooks/use-responsive'
import { cardShadow, radii } from '@/lib/ui-styles'
import { useJourneyStats } from '@/hooks/profile/use-journey-stats'
import { useSyncProfileStats } from '@/hooks/profile/use-sync-profile-stats'
import { useTripsQuery } from '@/hooks/trips/use-trips-query'
import { formatTripDates, tripDaysUntil } from '@/services/trips/trip-api'
import { useAuth } from '@/providers/auth-provider'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { tripCardLabels, tripImageUri } from '@/utils/trip-display'

export default function HomeScreen() {
  const router = useRouter()
  const theme = useThemedStyles()
  const { displayName } = useAuth()
  const { data: trips, isLoading } = useTripsQuery()
  const { stats } = useJourneyStats()
  useSyncProfileStats()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const upcoming =
    trips?.find((t) => t.status === 'upcoming') ??
    trips?.find((t) => t.status === 'saved') ??
    trips?.[0]

  const firstName = displayName.split(' ')[0]
  const {
    scaleFont,
    destinationCardWidth,
    isSmallPhone,
    isDesktop,
    quickActionColumns,
    horizontalPadding,
    contentWidth,
  } = useResponsive()
  const actionGap = 12
  const actionWidth =
    quickActionColumns === 1
      ? contentWidth
      : (contentWidth - actionGap * (quickActionColumns - 1)) / quickActionColumns
  const upcomingLabels = upcoming ? tripCardLabels(upcoming) : null

  return (
    <ScreenWrapper scroll tabInset>
      <View style={{ paddingTop: 4 }}>
        <Text
          style={{
            color: brand.primaryDark,
            fontSize: scaleFont(13),
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {greeting}
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: scaleFont(isSmallPhone ? 28 : 32),
            fontWeight: '800',
            letterSpacing: -0.8,
            marginTop: 4,
          }}
        >
          Hi, {firstName}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: scaleFont(16), marginTop: 6 }}>
          Where would you like to go next?
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 20 }}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {travelBanners.map((banner) => (
          <TravelBanner
            key={banner.id}
            title={banner.title}
            subtitle={banner.subtitle}
            image={banner.image}
            cta={banner.cta}
            onPress={() => router.push('/(tabs)/chat')}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={brand.primaryDark} />
      ) : upcoming ? (
        <HeroTripCard
          imageUri={tripImageUri(upcoming)}
          eyebrow={
            upcoming.status === 'upcoming'
              ? `Upcoming · ${tripDaysUntil(upcoming.start_date) ?? '—'} days`
              : 'Saved trip'
          }
          title={upcomingLabels?.displayTitle ?? upcoming.destination}
          dates={formatTripDates(upcoming.start_date, upcoming.end_date)}
          onPress={() => router.push(`/trip/${upcoming.id}`)}
        />
      ) : (
        <Pressable
          onPress={() => router.push('/trip/wizard')}
          style={[
            {
              marginTop: 24,
              borderRadius: radii.xl,
              padding: isDesktop ? 28 : 22,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: brand.primary,
            },
            cardShadow(theme.isDark),
          ]}
          className="active:opacity-95"
        >
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>
            Plan your first adventure
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8, lineHeight: 22 }}>
            Use AI Chat or the trip wizard — live weather, hotels, and flights included.
          </Text>
        </Pressable>
      )}

      <SectionTitle title="Explore destinations" subtitle="Tap to start planning" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {featuredDestinations.map((d) => (
          <DestinationCard
            key={d.id}
            name={d.name}
            country={d.country}
            tagline={d.tagline}
            image={d.image}
            width={destinationCardWidth}
            onPress={() =>
              router.push({
                pathname: '/destination/[id]',
                params: { id: encodeURIComponent(d.name) },
              })
            }
          />
        ))}
      </ScrollView>

      <SectionTitle title="Quick actions" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: actionGap }}>
        {quickActions.map((action) => (
          <QuickActionCard
            key={action.id}
            label={action.label}
            description={action.description}
            icon={action.icon}
            featured={action.featured}
            onPress={() => router.push(action.route as never)}
            style={{
              width: action.featured ? '100%' : actionWidth,
              marginBottom: actionGap,
            }}
          />
        ))}
      </View>

      <SectionTitle title="Your journey" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatCard label="Trips" value={stats.tripsCount} />
        <StatCard label="Countries" value={stats.countriesCount} accent={brand.accent} />
        <StatCard label="AI plans" value={stats.aiPlansCount} accent={brand.success} />
      </View>

      <View
        style={[
          {
            marginTop: 24,
            borderRadius: radii.xl,
            padding: 20,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
          },
          cardShadow(theme.isDark, false),
        ]}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.md,
            backgroundColor: brand.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Sparkles size={24} color={brand.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>
            AI suggestion
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
            {trips?.length
              ? 'Open AI Chat to refine your itinerary with live weather and prices.'
              : 'Start in AI Chat — real data in every reply.'}
          </Text>
        </View>
      </View>
    </ScreenWrapper>
  )
}
