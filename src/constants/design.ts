/** Design tokens — light sky travel palette. */

export const brand = {
  primary: '#38BDF8',
  primaryDark: '#0EA5E9',
  primaryLight: '#E0F2FE',
  accent: '#06B6D4',
  onPrimary: '#FFFFFF',
  onAccent: '#FFFFFF',
  sky: '#F0F9FF',
  cyan: '#CFFAFE',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

export const layout = {
  maxContentWidth: 1120,
  screenPadding: 24,
  sectionGap: 32,
} as const

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

export const featuredDestinations = [
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
] as const

/** Default trip hero when no custom image is set. */
export const defaultTripImage =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80'
