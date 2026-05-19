/** Design tokens aligned with assignment UI deliverables */

export const brand = {
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  accent: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

export const mockUser = {
  name: 'Alex Rivera',
  email: 'alex@example.com',
  avatar: 'https://i.pravatar.cc/300?u=travel-agent',
  tripsCount: 12,
  countriesVisited: 8,
  aiPlansGenerated: 34,
}

export const mockUpcomingTrip = {
  id: '1',
  destination: 'Bali, Indonesia',
  dates: '12 Aug – 20 Aug 2026',
  daysLeft: 14,
  image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
}

export const mockDestinations = [
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400',
  },
]

export const mockTrips = [
  {
    id: '1',
    title: 'Bali Adventure',
    subtitle: '8 days · Beach & culture',
    status: 'upcoming' as const,
  },
  {
    id: '2',
    title: 'Dubai Luxury',
    subtitle: '5 days · City escape',
    status: 'saved' as const,
  },
  {
    id: '3',
    title: 'Swiss Alps',
    subtitle: '7 days · Mountain tour',
    status: 'completed' as const,
  },
]

export const mockNotifications = [
  {
    id: '1',
    type: 'flight' as const,
    title: 'Flight reminder',
    body: 'Your Bali flight departs tomorrow at 8:30 PM.',
    time: '2h ago',
  },
  {
    id: '2',
    type: 'packing' as const,
    title: 'Packing reminder',
    body: '3 items left on your Bali checklist.',
    time: '5h ago',
  },
  {
    id: '3',
    type: 'itinerary' as const,
    title: 'Daily itinerary',
    body: 'Day 3: Ubud temple tour starts at 9:00 AM.',
    time: 'Yesterday',
  },
  {
    id: '4',
    type: 'booking' as const,
    title: 'Hotel booking',
    body: 'Confirm your Seminyak hotel by Friday.',
    time: '2 days ago',
  },
]

export const quickActions = [
  { id: 'chat', label: 'AI Planner', icon: 'MessageSquare', route: '/(tabs)/chat' },
  { id: 'wizard', label: 'Trip Wizard', icon: 'Wand2', route: '/trip/wizard' },
  { id: 'trips', label: 'Saved Trips', icon: 'Map', route: '/(tabs)/trips' },
  { id: 'budget', label: 'Budget', icon: 'Wallet', route: '/trip/1/budget' },
] as const
