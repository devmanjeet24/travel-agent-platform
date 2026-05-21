/** Design tokens — no mock travel data (live data from Supabase + APIs). */

export const brand = {
  primary: '#85c0d1',
  primaryDark: '#0284C7',
  accent: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

export const quickActions = [
  { id: 'chat', label: 'AI Planner', icon: 'MessageSquare', route: '/(tabs)/chat' },
  { id: 'wizard', label: 'Trip Wizard', icon: 'Wand2', route: '/trip/wizard' },
  { id: 'trips', label: 'Saved Trips', icon: 'Map', route: '/(tabs)/trips' },
] as const

/** Default trip hero when no custom image is set. */
export const defaultTripImage =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800'
