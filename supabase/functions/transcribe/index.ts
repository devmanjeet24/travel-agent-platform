import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

const GROQ_TRANSCRIBE = 'https://api.groq.com/openai/v1/audio/transcriptions';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) {
    return jsonResponse({ error: 'GROQ_API_KEY is not set' }, 500);
  }

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let audioFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (file instanceof File) {
        audioFile = file;
      } else if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const blob = file as Blob;
        audioFile = new File([await blob.arrayBuffer()], 'audio.webm', {
          type: blob.type || 'audio/webm',
        });
      }
    } else {
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength > 0) {
        audioFile = new File([bytes], 'audio.webm', { type: 'audio/webm' });
      }
    }

    if (!audioFile || audioFile.size === 0) {
      return jsonResponse({ error: 'Audio file required (field: file)' }, 400);
    }

    const groqForm = new FormData();
    groqForm.append('file', audioFile, audioFile.name);
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');

    const res = await fetch(GROQ_TRANSCRIBE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
    });

    const data = await res.json();
    if (!res.ok) {
      return jsonResponse(
        { error: data?.error?.message ?? 'Transcription failed' },
        res.status,
      );
    }

    const text = String(data.text ?? '').trim();
    return jsonResponse({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
});
