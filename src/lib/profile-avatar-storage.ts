import { logProfileAvatar, logProfileAvatarError } from '@/lib/profile-avatar-log';
import { getSupabaseOrNull } from '@/lib/supabase';
import { readFileAsArrayBuffer } from '@/lib/storage-upload';

const BUCKET = 'profile-avatars';

export function profileAvatarStoragePath(userId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${Date.now()}-${safeName}`;
}

/** Extract object path from a Supabase public avatar URL, if it belongs to our bucket. */
export function parseProfileAvatarStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split(/[?#]/)[0] ?? '');
}

export async function uploadProfileAvatarFile(params: {
  userId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
}): Promise<string> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured. Add keys to .env');

  const path = profileAvatarStoragePath(params.userId, params.fileName);
  logProfileAvatar('storage:read-file', { path, localUri: params.localUri });

  const bytes = await readFileAsArrayBuffer(params.localUri);
  logProfileAvatar('storage:bytes-ready', { path, bytes: bytes.byteLength });

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: params.mimeType,
    upsert: true,
  });

  if (error) {
    logProfileAvatarError('storage:upload-failed', error);
    if (error.message.includes('Bucket not found')) {
      throw new Error(
        'Storage bucket "profile-avatars" missing. Run DB migrations in Supabase (see docs/supabase-dashboard-setup.md).',
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
  logProfileAvatar('storage:public-url', { publicUrl });
  return publicUrl;
}

export async function deleteProfileAvatarFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}
