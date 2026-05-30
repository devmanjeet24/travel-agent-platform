import {
  logProfileAvatar,
  logProfileAvatarError,
} from '@/lib/profile-avatar-log';
import {
  deleteProfileAvatarFiles,
  parseProfileAvatarStoragePath,
  uploadProfileAvatarFile,
} from '@/lib/profile-avatar-storage';
import { updateProfileSettings } from '@/services/profile/profile-api';
import type { ProfileRow } from '@/types/database';

function mimeFromUri(uri: string): { ext: string; mime: string } {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (ext === 'png') return { ext: 'png', mime: 'image/png' };
  if (ext === 'webp') return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/** Cropped avatars from expo-image-manipulator are always JPEG. */
function avatarUploadMeta(uri: string): { ext: string; mime: string } {
  if (uri.includes('ImageManipulator') || uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  return mimeFromUri(uri);
}

export type ProfileAvatarUploadResult = {
  publicUrl: string;
  profile: ProfileRow;
};

export async function setProfileAvatarFromLocalUri(params: {
  userId: string;
  localUri: string;
  previousAvatarUrl?: string | null;
}): Promise<ProfileAvatarUploadResult> {
  logProfileAvatar('upload:start', { userId: params.userId, localUri: params.localUri });

  const { ext, mime } = avatarUploadMeta(params.localUri);
  const publicUrl = await uploadProfileAvatarFile({
    userId: params.userId,
    localUri: params.localUri,
    fileName: `avatar.${ext}`,
    mimeType: mime,
  });

  logProfileAvatar('upload:storage-ok', { publicUrl });

  const profile = await updateProfileSettings(params.userId, { avatar_url: publicUrl });

  logProfileAvatar('upload:profile-saved', {
    avatar_url: profile.avatar_url,
    profileId: profile.id,
  });

  const savedPath = profile.avatar_url
    ? parseProfileAvatarStoragePath(profile.avatar_url)
    : null;
  const oldPath = params.previousAvatarUrl
    ? parseProfileAvatarStoragePath(params.previousAvatarUrl)
    : null;
  if (oldPath && oldPath !== savedPath) {
    try {
      await deleteProfileAvatarFiles([oldPath]);
      logProfileAvatar('upload:old-file-deleted', { oldPath });
    } catch (cleanupError) {
      logProfileAvatarError('upload:old-file-cleanup-failed', cleanupError);
    }
  } else if (oldPath) {
    logProfileAvatar('upload:old-file-retained', { oldPath });
  }

  return { publicUrl, profile };
}

export async function removeProfileAvatar(params: {
  userId: string;
  currentAvatarUrl?: string | null;
}): Promise<ProfileRow> {
  logProfileAvatar('remove:start', { userId: params.userId });

  const path = params.currentAvatarUrl
    ? parseProfileAvatarStoragePath(params.currentAvatarUrl.split('?')[0] ?? '')
    : null;

  const profile = await updateProfileSettings(params.userId, { avatar_url: null });
  logProfileAvatar('remove:profile-cleared');

  if (path) {
    try {
      await deleteProfileAvatarFiles([path]);
      logProfileAvatar('remove:storage-deleted', { path });
    } catch (cleanupError) {
      logProfileAvatarError('remove:storage-delete-failed', cleanupError);
    }
  }

  return profile;
}
