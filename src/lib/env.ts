/**
 * Client-safe environment variables (EXPO_PUBLIC_*).
 * Secrets (OpenAI, Supabase service role) belong in Supabase Edge Function secrets only.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  osrmBaseUrl:
    process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
