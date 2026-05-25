import * as Linking from 'expo-linking'
import { Platform } from 'react-native'

/** Deep-link path — must match Supabase redirect allow list and `src/app/auth/callback.tsx`. */
export const AUTH_CALLBACK_PATH = 'auth/callback'

/**
 * Redirect URL for Supabase (email confirmation, magic link, OAuth, password reset).
 * Native builds use the app scheme; web uses the current origin (never localhost on device).
 */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${AUTH_CALLBACK_PATH}`
  }
  return Linking.createURL(AUTH_CALLBACK_PATH)
}

/** True when the URL likely carries Supabase auth tokens or our callback path. */
export function isAuthCallbackUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.includes(AUTH_CALLBACK_PATH)) return true
  if (lower.includes('access_token=') || lower.includes('refresh_token=')) return true
  if (lower.includes('code=') && (lower.includes('type=signup') || lower.includes('type=recovery'))) {
    return true
  }
  return lower.includes('code=') && lower.includes('auth/callback')
}
