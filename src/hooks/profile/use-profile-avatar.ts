import { useCallback, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { profileKeys, useProfileQuery } from '@/hooks/profile/use-profile-query'
import { cropProfileAvatarSquare } from '@/lib/profile-avatar-crop'
import {
  logProfileAvatar,
  logProfileAvatarError,
} from '@/lib/profile-avatar-log'
import {
  removeProfileAvatar,
  setProfileAvatarFromLocalUri,
} from '@/services/profile/profile-avatar-api'
import type { ProfileRow } from '@/types/database'
import { useAuth } from '@/providers/auth-provider'

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`)
  } else {
    Alert.alert(title, message)
  }
}

function showError(message: string) {
  logProfileAvatarError('ui:error', message)
  showMessage('Profile photo', message)
}

function showSuccess(message: string) {
  logProfileAvatar('ui:success', message)
  if (Platform.OS !== 'web') {
    Alert.alert('Profile photo', message)
  }
}

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    showError('Photo library access is required to choose a photo.')
    return false
  }
  return true
}

async function ensureCameraPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    showError('Camera access is required to take a photo.')
    return false
  }
  return true
}

type UploadVars = { localUri: string; previousAvatarUrl: string | null }

type PendingCrop = {
  uri: string
  width: number
  height: number
  previousAvatarUrl: string | null
}

const libraryPickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
  exif: false,
}

const cameraPickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  quality: 1,
  exif: false,
}

function defaultProfileRow(userId: string): ProfileRow {
  return {
    id: userId,
    display_name: null,
    avatar_url: null,
    trips_count: 0,
    countries_visited: 0,
    ai_plans_generated: 0,
    push_notifications_enabled: true,
    offline_sync_enabled: true,
  }
}

export function useProfileAvatar(fallbackAvatarUrl?: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile } = useProfileQuery()
  const [sheetVisible, setSheetVisible] = useState(false)
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const userId = user?.id ?? ''
  const displayAvatarUrl = profile?.avatar_url ?? fallbackAvatarUrl ?? null

  const setProfileInCache = useCallback(
    (next: ProfileRow | null) => {
      if (!userId) return
      queryClient.setQueryData<ProfileRow | null>(profileKeys.detail(userId), next)
    },
    [queryClient, userId],
  )

  const patchAvatarInCache = useCallback(
    (avatarUrl: string | null) => {
      if (!userId) return
      queryClient.setQueryData<ProfileRow | null>(profileKeys.detail(userId), (prev) => {
        const base = prev ?? defaultProfileRow(userId)
        return { ...base, avatar_url: avatarUrl }
      })
    },
    [queryClient, userId],
  )

  const uploadMutation = useMutation({
    mutationFn: async ({ localUri, previousAvatarUrl }: UploadVars) => {
      if (!userId) throw new Error('Sign in to update your profile photo')
      logProfileAvatar('mutation:upload', { localUri })
      return setProfileAvatarFromLocalUri({
        userId,
        localUri,
        previousAvatarUrl,
      })
    },
    onMutate: async ({ localUri }) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.detail(userId) })
      const previous = queryClient.getQueryData<ProfileRow | null>(profileKeys.detail(userId))
      patchAvatarInCache(localUri)
      logProfileAvatar('mutation:optimistic-preview', { localUri })
      return { previous }
    },
    onSuccess: ({ publicUrl, profile: savedProfile }) => {
      setProfileInCache(savedProfile)
      logProfileAvatar('mutation:complete', { publicUrl, avatar_url: savedProfile.avatar_url })
      setPendingCrop(null)
      setSheetVisible(false)
      showSuccess('Your profile photo was updated.')
    },
    onError: (err, _vars, context) => {
      logProfileAvatarError('mutation:failed', err)
      if (context?.previous !== undefined) {
        setProfileInCache(context.previous)
      }
      setPendingCrop(null)
      showError(err instanceof Error ? err.message : 'Could not update profile photo')
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      if (!userId) throw new Error('Sign in to remove your profile photo')
      return removeProfileAvatar({ userId, currentAvatarUrl: avatarUrl })
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileKeys.detail(userId) })
      const previous = queryClient.getQueryData<ProfileRow | null>(profileKeys.detail(userId))
      patchAvatarInCache(null)
      return { previous }
    },
    onSuccess: (savedProfile) => {
      setProfileInCache(savedProfile)
      setSheetVisible(false)
      showSuccess('Profile photo removed.')
    },
    onError: (err, _vars, context) => {
      logProfileAvatarError('remove:failed', err)
      if (context?.previous !== undefined) {
        setProfileInCache(context.previous)
      }
      showError(err instanceof Error ? err.message : 'Could not remove profile photo')
    },
  })

  const isUpdating =
    uploadMutation.isPending || removeMutation.isPending || isCropping

  const openSheet = useCallback(() => {
    if (!userId) {
      showError('Sign in to change your profile photo')
      return
    }
    setSheetVisible(true)
  }, [userId])

  const closeSheet = useCallback(() => {
    if (!isUpdating) setSheetVisible(false)
  }, [isUpdating])

  const openCropForAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      logProfileAvatar('picker:asset', {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      })
      const previous = queryClient.getQueryData<ProfileRow | null>(profileKeys.detail(userId))
      setSheetVisible(false)
      setPendingCrop({
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        previousAvatarUrl: previous?.avatar_url ?? null,
      })
    },
    [queryClient, userId],
  )

  const pickFromLibrary = useCallback(async () => {
    setSheetVisible(false)
    if (!(await ensureMediaLibraryPermission())) return
    const result = await ImagePicker.launchImageLibraryAsync(libraryPickerOptions)
    logProfileAvatar('picker:library', { canceled: result.canceled, assets: result.assets?.length })
    if (result.canceled || !result.assets[0]) return
    openCropForAsset(result.assets[0])
  }, [openCropForAsset])

  const takePhoto = useCallback(async () => {
    setSheetVisible(false)
    if (!(await ensureCameraPermission())) return
    const result = await ImagePicker.launchCameraAsync(cameraPickerOptions)
    logProfileAvatar('picker:camera', { canceled: result.canceled, assets: result.assets?.length })
    if (result.canceled || !result.assets[0]) return
    openCropForAsset(result.assets[0])
  }, [openCropForAsset])

  const cancelCrop = useCallback(() => {
    if (isCropping || uploadMutation.isPending) return
    setPendingCrop(null)
  }, [isCropping, uploadMutation.isPending])

  const confirmCrop = useCallback(async () => {
    if (!pendingCrop || isCropping || uploadMutation.isPending) return

    setIsCropping(true)
    try {
      logProfileAvatar('crop:start', pendingCrop)
      const croppedUri = await cropProfileAvatarSquare({
        uri: pendingCrop.uri,
        width: pendingCrop.width,
        height: pendingCrop.height,
      })
      logProfileAvatar('crop:done', { croppedUri })

      uploadMutation.mutate({
        localUri: croppedUri,
        previousAvatarUrl: pendingCrop.previousAvatarUrl,
      })
    } catch (e) {
      logProfileAvatarError('crop:failed', e)
      showError(e instanceof Error ? e.message : 'Could not prepare photo')
    } finally {
      setIsCropping(false)
    }
  }, [pendingCrop, isCropping, uploadMutation])

  const removePhoto = useCallback(() => {
    const url = displayAvatarUrl?.startsWith('http') ? displayAvatarUrl : null
    setSheetVisible(false)
    removeMutation.mutate(url)
  }, [removeMutation, displayAvatarUrl])

  return {
    displayAvatarUrl,
    sheetVisible,
    cropVisible: Boolean(pendingCrop) || uploadMutation.isPending,
    cropImageUri: pendingCrop?.uri ?? null,
    isUpdating,
    openSheet,
    closeSheet,
    pickFromLibrary,
    takePhoto,
    removePhoto,
    cancelCrop,
    confirmCrop: () => void confirmCrop(),
    hasPhoto: Boolean(displayAvatarUrl),
  }
}
