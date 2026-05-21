import { Platform } from 'react-native';
import { Audio } from 'expo-av';

import { edgeFunctionUrl } from '@/lib/edge-fetch';
import { env } from '@/lib/env';
import { getSupabaseOrNull } from '@/lib/supabase';

export type VoiceRecorder = {
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => Promise<void>;
};

/** Web: MediaRecorder API. Native: expo-av. */
export async function createVoiceRecorder(): Promise<VoiceRecorder> {
  if (Platform.OS === 'web') {
    return createWebRecorder();
  }
  return createNativeRecorder();
}

async function createNativeRecorder(): Promise<VoiceRecorder> {
  const perm = await Audio.requestPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Microphone permission is required for voice input.');
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  let recording: Audio.Recording | null = null;

  return {
    async start() {
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recording = rec;
    },
    async stop() {
      if (!recording) return null;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recording = null;
      return uri;
    },
    async cancel() {
      if (!recording) return;
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        /* ignore */
      }
      recording = null;
    },
  };
}

async function createWebRecorder(): Promise<VoiceRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let mediaRecorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];

  return {
    async start() {
      chunks.length = 0;
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start();
    },
    async stop() {
      return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
          stream.getTracks().forEach((t) => t.stop());
          resolve(null);
          return;
        }
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          resolve(URL.createObjectURL(blob));
        };
        mediaRecorder.stop();
      });
    },
    async cancel() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

export async function transcribeFromUri(uri: string): Promise<string> {
  const supabase = getSupabaseOrNull();
  if (!supabase || !env.supabaseAnonKey) {
    throw new Error('Supabase not configured');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to use voice input');

  const form = new FormData();

  if (Platform.OS === 'web' && uri.startsWith('blob:')) {
    const blob = await fetch(uri).then((r) => r.blob());
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    form.append('file', blob, `recording.${ext}`);
  } else {
    const isAndroid = Platform.OS === 'android';
    form.append('file', {
      uri,
      name: isAndroid ? 'recording.m4a' : 'recording.m4a',
      type: isAndroid ? 'audio/mp4' : 'audio/x-m4a',
    } as unknown as Blob);
  }

  const res = await fetch(edgeFunctionUrl('transcribe'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: env.supabaseAnonKey,
    },
    body: form,
  });

  const data = (await res.json()) as { text?: string; error?: string };

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Transcribe function not deployed. Run: supabase functions deploy transcribe',
      );
    }
    throw new Error(data.error ?? `Transcription failed (${res.status})`);
  }

  return String(data.text ?? '').trim();
}
