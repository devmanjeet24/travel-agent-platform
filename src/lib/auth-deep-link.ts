import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'

import { AUTH_CALLBACK_PATH } from '@/lib/auth-redirect'
import { finishOAuthFromUrl } from '@/lib/oauth'
import { authKeys } from '@/services/auth'

function urlHasAuthPayload(url: string): boolean {
  const params = parseAuthParamsFromUrl(url)
  return Boolean(
    (params.access_token && params.refresh_token) ||
      params.code ||
      params.error ||
      params.error_description,
  )
}

/** Parse query or hash segment; JWT values may contain `=`. */
export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  const hashIndex = url.indexOf('#')
  const queryIndex = url.indexOf('?')
  let segment = ''

  if (hashIndex !== -1) {
    segment = url.slice(hashIndex + 1)
  } else if (queryIndex !== -1) {
    segment = url.slice(queryIndex + 1)
  }

  if (!segment) return params

  for (const part of segment.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = decodeURIComponent(part.slice(0, eq))
    const value = decodeURIComponent(part.slice(eq + 1))
    if (key) params[key] = value
  }

  return params
}

let inFlight: Promise<{ error: string | null; session: Session | null }> | null = null

/**
 * Completes Supabase auth from a deep link (email verify, OAuth, recovery).
 * Deduplicates concurrent calls; updates the React Query session cache on success.
 */
export async function processAuthCallbackUrl(
  url: string,
  queryClient: QueryClient,
): Promise<{ error: string | null; session: Session | null }> {
  if (!urlHasAuthPayload(url)) {
    if (!url.toLowerCase().includes(AUTH_CALLBACK_PATH)) {
      return { error: null, session: null }
    }
    await queryClient.refetchQueries({ queryKey: authKeys.session() })
    const session =
      (queryClient.getQueryData(authKeys.session()) as Session | null | undefined) ?? null
    return { error: null, session }
  }

  if (inFlight) return inFlight

  inFlight = (async () => {
    const result = await finishOAuthFromUrl(url)
    if (result.error) {
      return { error: result.error, session: null }
    }

    if (result.session) {
      queryClient.setQueryData(authKeys.session(), result.session)
      return { error: null, session: result.session }
    }

    await queryClient.refetchQueries({ queryKey: authKeys.session() })
    const session =
      (queryClient.getQueryData(authKeys.session()) as Session | null | undefined) ?? null

    return { error: null, session }
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

/** Collect deep-link URLs from Expo Linking (useURL may omit hash on Android). */
export async function collectAuthCallbackUrls(
  linkingUrl: string | null | undefined,
): Promise<string[]> {
  const urls = new Set<string>()
  if (linkingUrl) urls.add(linkingUrl)

  try {
    const initial = await Linking.getInitialURL()
    if (initial) urls.add(initial)
  } catch {
    /* ignore */
  }

  return [...urls]
}
