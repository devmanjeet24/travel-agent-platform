import { Platform } from 'react-native';
import { File } from 'expo-file-system';

import { getSupabaseOrNull } from '@/lib/supabase';

const BUCKET = 'chat-attachments';

/** Read a local file URI into bytes (iOS, Android, and web). */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Could not read file for upload');
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) throw new Error('Selected file is empty');
    return buf;
  }

  const file = new File(uri);
  if (!file.exists) {
    throw new Error('Could not read photo file. Try choosing the image again.');
  }

  try {
    const buf = await file.arrayBuffer();
    if (buf.byteLength === 0) throw new Error('Selected file is empty');
    return buf;
  } catch (firstError) {
    try {
      const res = await fetch(uri);
      if (!res.ok) throw firstError;
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0) throw new Error('Selected file is empty');
      return buf;
    } catch {
      throw firstError instanceof Error ? firstError : new Error('Could not read file for upload');
    }
  }
}

export async function uploadChatAttachmentFile(params: {
  userId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
}): Promise<string> {
  const supabase = getSupabaseOrNull();
  if (!supabase) throw new Error('Supabase not configured. Add keys to .env');

  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${params.userId}/${Date.now()}-${safeName}`;
  const bytes = await readFileAsArrayBuffer(params.localUri);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: params.mimeType,
    upsert: false,
  });

  if (error) {
    if (error.message.includes('Bucket not found')) {
      throw new Error(
        'Storage bucket "chat-attachments" missing. Run DB migrations in Supabase (see docs/supabase-dashboard-setup.md).',
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
