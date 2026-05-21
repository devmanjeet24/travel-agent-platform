import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

import { formatAuthError, type AuthResult } from '@/services/auth/auth-api'
import { getSupabaseOrNull } from '@/lib/supabase'

WebBrowser.maybeCompleteAuthSession()

function getParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  const hashPart = url.includes('#') ? url.split('#')[1] : ''
  const queryPart = url.includes('?') ? url.split('?').slice(1).join('?') : ''
  const combined = hashPart || queryPart
  if (!combined) return params

  for (const segment of combined.split('&')) {
    const [key, value] = segment.split('=')
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  }
  return params
}

export async function finishOAuthFromUrl(url: string): Promise<AuthResult> {
  const supabase = getSupabaseOrNull()
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' }
  }

  const params = getParamsFromUrl(url)
  const access_token = params.access_token
  const refresh_token = params.refresh_token

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    return { error: error ? formatAuthError(error) : null }
  }

  const code = params.code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return { error: error ? formatAuthError(error) : null }
  }

  if (params.error_description || params.error) {
    return { error: params.error_description ?? params.error ?? 'Sign in failed' }
  }

  return { error: 'Sign in was cancelled or incomplete' }
}

export async function signInWithOAuth(
  provider: 'google' | 'apple',
): Promise<AuthResult> {
  const supabase = getSupabaseOrNull()
  if (!supabase) {
    return { error: 'Supabase is not configured. Check your .env file.' }
  }

  const redirectTo = Linking.createURL('/')

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
    return finishOAuthFromUrl(result.url)
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { error: null }
  }

  return { error: 'Sign in was cancelled' }
}
