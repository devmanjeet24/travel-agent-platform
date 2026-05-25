import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { parseAuthParamsFromUrl } from '@/lib/auth-deep-link'
import { getAuthRedirectUrl } from '@/lib/auth-redirect'
import { getSupabaseOrNull } from '@/lib/supabase'
import { formatAuthError, type AuthResult } from '@/services/auth/auth-api'

WebBrowser.maybeCompleteAuthSession()

export type AuthUrlResult = AuthResult & {
  session: Session | null
}

export async function finishOAuthFromUrl(url: string): Promise<AuthUrlResult> {
  const supabase = getSupabaseOrNull()
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.', session: null }
  }

  const params = parseAuthParamsFromUrl(url)
  const access_token = params.access_token
  const refresh_token = params.refresh_token

  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
    return {
      error: error ? formatAuthError(error) : null,
      session: data.session ?? null,
    }
  }

  const code = params.code
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    return {
      error: error ? formatAuthError(error) : null,
      session: data.session ?? null,
    }
  }

  if (params.error_description || params.error) {
    return {
      error: params.error_description ?? params.error ?? 'Sign in failed',
      session: null,
    }
  }

  return { error: 'Sign in was cancelled or incomplete', session: null }
}

export async function signInWithOAuth(
  provider: 'google' | 'apple',
): Promise<AuthResult> {
  const supabase = getSupabaseOrNull()
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' }
  }

  const redirectTo = getAuthRedirectUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  })

  if (error) return { error: formatAuthError(error) }
  if (!data.url) return { error: 'Could not start sign in' }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.href = data.url
    }
    return { error: null }
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    showInRecents: true,
  })

  if (result.type === 'success' && result.url) {
    const auth = await finishOAuthFromUrl(result.url)
    return { error: auth.error }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { error: null }
  }

  return { error: 'Sign in was cancelled' }
}
