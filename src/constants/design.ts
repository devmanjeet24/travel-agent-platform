/** Design tokens — premium travel palette (light + dark via useThemedStyles). */

export const brand = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  accent: '#6366F1',
  accentMuted: '#EEF2FF',
  onPrimary: '#FFFFFF',
  onAccent: '#FFFFFF',
  sky: '#F8FAFC',
  surface: '#FFFFFF',
  cyan: '#06B6D4',
  success: '#10B981',
  successMuted: '#D1FAE5',
  warning: '#F59E0B',
  warningMuted: '#FEF3C7',
  danger: '#EF4444',
  dangerMuted: '#FEE2E2',
  /** AI / sparkle highlights */
  ai: '#7C3AED',
  aiMuted: '#EDE9FE',
} as const

/** 4px base spacing scale */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  '3xl': 36,
  '4xl': 44,
  '5xl': 52,
} as const

export const layout = {
  maxContentWidth: 1120,
  screenPadding: 20,
  sectionGap: 32,
  cardPadding: 16,
  touchTarget: 48,
} as const

/** Home discovery categories — tap opens AI Chat (same flow as inspiration banners). */
export const discoveryCategories = [
  { id: 'all', label: 'All', icon: 'Globe' as const },
  { id: 'beach', label: 'Beach', icon: 'Waves' as const },
  { id: 'mountains', label: 'Mountains', icon: 'Mountain' as const },
  { id: 'city', label: 'City', icon: 'Building2' as const },
  { id: 'culture', label: 'Culture', icon: 'Landmark' as const },
] as const

export const quickActions = [
  {
    id: 'chat',
    label: 'AI Planner',
    description: 'Chat with live weather & prices',
    icon: 'MessageSquare',
    route: '/(tabs)/chat',
    featured: true,
  },
  {
    id: 'wizard',
    label: 'Trip Wizard',
    description: 'Step-by-step itinerary',
    icon: 'Wand2',
    route: '/trip/wizard',
    featured: false,
  },
  {
    id: 'trips',
    label: 'Saved Trips',
    icon: 'Map',
    description: 'Your planned adventures',
    route: '/(tabs)/trips',
    featured: false,
  },
] as const

/** Shared shape for home discovery destination cards. */
export type DestinationCatalogItem = {
  id: string
  name: string
  country: string
  tagline: string
  image: string
}

export const featuredDestinations: DestinationCatalogItem[] = [
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    tagline: 'Beaches & temples',
    image:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    tagline: 'Art, food & romance',
    image:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    tagline: 'Neon nights & culture',
    image:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    tagline: 'Sunsets & caldera views',
    image:
      'https://images.unsplash.com/photo-1613395877344-13f27c9eb15d?w=600&q=80',
  },
] as const

export const travelBanners = [
  {
    id: 'summer',
    title: 'Summer escapes',
    subtitle: 'AI-built itineraries in minutes',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    cta: 'Plan a trip',
  },
  {
    id: 'city',
    title: 'City breaks',
    subtitle: 'Flights, hotels & day plans',
    image:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80',
    cta: 'Explore cities',
  },
]

/** Curated picks for “Recommended” — distinct from featured carousel order. */
export const recommendedPlaces: DestinationCatalogItem[] = [
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'South Asia',
    tagline: 'Overwater villas & reefs',
    image:
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80',
  },
  {
    id: 'swiss',
    name: 'Swiss Alps',
    country: 'Switzerland',
    tagline: 'Peaks & scenic trains',
    image:
      'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&q=80',
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    tagline: 'Skyline & desert nights',
    image:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80',
  },
]

/** Same catalogue as featured, reordered for a second horizontal rail. */
export const trendingDestinations: DestinationCatalogItem[] = [
  featuredDestinations[2],
  featuredDestinations[0],
  featuredDestinations[3],
  featuredDestinations[1],
]

/** Combined explore rail for Home — one carousel instead of three duplicate sections. */
export const exploreDestinations = [
  ...featuredDestinations,
  ...trendingDestinations.filter((d) => !featuredDestinations.some((f) => f.id === d.id)),
  ...recommendedPlaces.filter(
    (d) =>
      !featuredDestinations.some((f) => f.id === d.id) &&
      !trendingDestinations.some((t) => t.id === d.id),
  ),
]

/** Default trip hero when no custom image is set. */
export const defaultTripImage =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80'
