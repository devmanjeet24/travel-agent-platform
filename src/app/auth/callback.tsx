import * as Linking from 'expo-linking'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { brand } from '@/constants/design'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { getAuthRedirectUrl } from '@/lib/auth-redirect'
import { collectAuthCallbackUrls, processAuthCallbackUrl } from '@/lib/auth-deep-link'
import { useAuth } from '@/providers/auth-provider'
import { authKeys } from '@/services/auth'

const REDIRECT_TIMEOUT_MS = 12_000

/** Handles email verification, password reset, and OAuth return URLs. */
export default function AuthCallbackScreen() {
  const router = useRouter()
  const linkingUrl = Linking.useURL()
  const routeParams = useLocalSearchParams<{
    code?: string
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }>()
  const queryClient = useQueryClient()
  const { colors } = useThemedStyles()
  const { session, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(true)
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return

    let cancelled = false

    void (async () => {
      const urls = await collectAuthCallbackUrls(linkingUrl)
      const base = getAuthRedirectUrl().split('#')[0]?.split('?')[0] ?? ''
      const search = new URLSearchParams()
      if (routeParams.code) search.set('code', String(routeParams.code))
      if (routeParams.access_token) search.set('access_token', String(routeParams.access_token))
      if (routeParams.refresh_token) search.set('refresh_token', String(routeParams.refresh_token))
      if (routeParams.error) search.set('error', String(routeParams.error))
      if (routeParams.error_description) {
        search.set('error_description', String(routeParams.error_description))
      }
      if (search.toString() && base) {
        urls.unshift(`${base}?${search.toString()}`)
      }

      for (const url of urls) {
        const { error: linkError, session: linkSession } = await processAuthCallbackUrl(
          url,
          queryClient,
        )
        if (cancelled) return

        if (linkError) {
          setError(linkError)
          setProcessing(false)
          processedRef.current = true
          return
        }

        if (linkSession) {
          setProcessing(false)
          processedRef.current = true
          return
        }
      }

      if (cancelled) return

      const cached = queryClient.getQueryData(authKeys.session())
      if (cached) {
        setProcessing(false)
        processedRef.current = true
        return
      }

      setProcessing(false)
      processedRef.current = true
    })()

    return () => {
      cancelled = true
    }
  }, [linkingUrl, queryClient, routeParams.code, routeParams.access_token, routeParams.refresh_token])

  useEffect(() => {
    if (loading || processing) return
    if (error) return
    if (session) {
      router.replace('/(tabs)')
    }
  }, [loading, processing, error, session, router])

  useEffect(() => {
    if (loading || processing || error || session) return

    const timer = setTimeout(() => {
      setError(
        'We could not confirm your email automatically. Try signing in — your email may already be verified.',
      )
    }, REDIRECT_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [loading, processing, error, session])

  const showSpinner = processing || (loading && !error)

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: 24,
      }}
    >
      {error ? (
        <>
          <Text style={{ color: brand.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            Could not complete sign in
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 20 }}
          >
            <Text style={{ color: brand.primaryDark, fontSize: 16, fontWeight: '600' }}>
              Go to sign in
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          {showSpinner ? (
            <ActivityIndicator size="large" color={brand.primaryDark} />
          ) : null}
          <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 15, textAlign: 'center' }}>
            {session ? 'Opening your trips…' : 'Confirming your account…'}
          </Text>
        </>
      )}
    </View>
  )
}
