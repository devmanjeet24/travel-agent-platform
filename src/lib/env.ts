/**
 * Client-safe environment variables (EXPO_PUBLIC_*).
 * Secrets (OpenAI, Supabase service role) belong in Supabase Edge Function secrets only.
 */
const mapTileUrl =
  process.env.EXPO_PUBLIC_MAP_TILE_URL ??
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapTileUrl,
  mapTilerApiKey: process.env.EXPO_PUBLIC_MAPTILER_API_KEY ?? '',
  osrmBaseUrl:
    process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/** Tile URL for react-native-maps UrlTile (supports {z}/{x}/{y} placeholders). */
export function getMapTileUrl(): string {
  if (env.mapTilerApiKey && env.mapTileUrl.includes('{key}')) {
    return env.mapTileUrl.replace('{key}', env.mapTilerApiKey);
  }
  if (
    env.mapTilerApiKey &&
    !env.mapTileUrl.includes('openstreetmap.org')
  ) {
    return env.mapTileUrl;
  }
  if (env.mapTilerApiKey && mapTileUrl === 'https://tile.openstreetmap.org/{z}/{x}/{y}.png') {
    return `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${env.mapTilerApiKey}`;
  }
  return env.mapTileUrl;
}
