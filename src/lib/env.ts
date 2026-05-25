/**
 * Client-safe environment variables (EXPO_PUBLIC_*).
 * Secrets (OpenAI, Supabase service role) belong in Supabase Edge Function secrets only.
 */
const DEFAULT_MAP_TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
const configuredMapTileUrl = process.env.EXPO_PUBLIC_MAP_TILE_URL

function isValidTileTemplate(value: string | undefined) {
  if (!value) return false
  return value.includes('{z}') && value.includes('{x}') && value.includes('{y}')
}

function resolveMapTileUrl(): string {
  const value = configuredMapTileUrl
  if (
    isValidTileTemplate(value) &&
    value &&
    !value.includes('tile.openstreetmap.org')
  ) {
    return value
  }
  return DEFAULT_MAP_TILE_URL
}

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  osrmBaseUrl:
    process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org',
  mapTileUrl: resolveMapTileUrl(),
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
