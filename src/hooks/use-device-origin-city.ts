import { useCallback, useEffect, useRef, useState } from 'react'

import { detectDeviceOriginCity } from '@/lib/device-location'
import { loadStoredOriginCity, saveStoredOriginCity } from '@/lib/origin-city-storage'

export type OriginCityDetectionStatus =
  | 'idle'
  | 'loading'
  | 'detected'
  | 'manual'
  | 'denied'
  | 'unavailable'

export function useDeviceOriginCity() {
  const [originCity, setOriginCityState] = useState('')
  const [status, setStatus] = useState<OriginCityDetectionStatus>('idle')
  const detectStarted = useRef(false)

  const setOriginCity = useCallback((next: string) => {
    setOriginCityState(next)
    setStatus(next.trim() ? 'manual' : 'idle')
    void saveStoredOriginCity(next)
  }, [])

  const runDetection = useCallback(async (): Promise<string> => {
    setStatus('loading')
    const result = await detectDeviceOriginCity()
    if (result.ok) {
      setOriginCityState(result.city)
      setStatus('detected')
      await saveStoredOriginCity(result.city)
      return result.city
    }
    setStatus(result.reason)
    return ''
  }, [])

  useEffect(() => {
    if (detectStarted.current) return
    detectStarted.current = true

    void (async () => {
      const stored = await loadStoredOriginCity()
      if (stored) {
        setOriginCityState(stored)
        setStatus('manual')
        return
      }
      await runDetection()
    })()
  }, [runDetection])

  const needsManualEntry = !originCity.trim() && status !== 'loading'

  /** Resolve origin for chat/trip save: state → stored → live GPS (no manual typing required). */
  const ensureOriginCity = useCallback(async (): Promise<string> => {
    const current = originCity.trim()
    if (current) return current

    const stored = await loadStoredOriginCity()
    if (stored?.trim()) {
      setOriginCityState(stored.trim())
      setStatus('manual')
      return stored.trim()
    }

    return await runDetection()
  }, [originCity, runDetection])

  return {
    originCity,
    setOriginCity,
    status,
    needsManualEntry,
    retryDetection: runDetection,
    ensureOriginCity,
    isDetecting: status === 'loading',
  }
}
