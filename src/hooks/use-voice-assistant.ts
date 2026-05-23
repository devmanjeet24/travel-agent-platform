import { useCallback, useRef, useState } from 'react';

import { createVoiceRecorder, transcribeFromUri } from '@/lib/voice-recording';
import { isSpeaking, speakText, stopSpeaking } from '@/lib/voice-tts';

export type VoiceAssistantPhase = 'idle' | 'recording' | 'transcribing' | 'speaking';

type Options = {
  onTranscript: (text: string) => void | Promise<void>;
  onError: (message: string) => void;
};

export function useVoiceAssistant({ onTranscript, onError }: Options) {
  const recorderRef = useRef<Awaited<ReturnType<typeof createVoiceRecorder>> | null>(null);
  const [phase, setPhase] = useState<VoiceAssistantPhase>('idle');

  const startRecording = useCallback(async () => {
    try {
      await stopSpeaking();
      recorderRef.current = await createVoiceRecorder();
      await recorderRef.current.start();
      setPhase('recording');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not start recording');
      setPhase('idle');
    }
  }, [onError]);

  const stopRecordingAndSend = useCallback(async () => {
    if (phase !== 'recording') return;

    setPhase('transcribing');
    try {
      const rec = recorderRef.current;
      const uri = rec ? await rec.stop() : null;
      recorderRef.current = null;
      if (!uri) {
        setPhase('idle');
        return;
      }

      const text = await transcribeFromUri(uri);
      if (!text) {
        onError('No speech detected. Try again.');
        setPhase('idle');
        return;
      }

      await onTranscript(text);
      setPhase('idle');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Transcription failed');
      setPhase('idle');
    }
  }, [phase, onTranscript, onError]);

  const cancelRecording = useCallback(async () => {
    const rec = recorderRef.current;
    if (rec) {
      await rec.cancel();
      recorderRef.current = null;
    }
    setPhase('idle');
  }, []);

  const toggleRecording = useCallback(async () => {
    if (phase === 'recording') {
      await stopRecordingAndSend();
      return;
    }
    if (phase === 'transcribing' || phase === 'speaking') return;
    await startRecording();
  }, [phase, startRecording, stopRecordingAndSend]);

  const speakReply = useCallback(async (reply: string) => {
    setPhase('speaking');
    await speakText(reply, () => setPhase('idle'));
  }, []);

  const interrupt = useCallback(async () => {
    await stopSpeaking();
    await cancelRecording();
    setPhase('idle');
  }, [cancelRecording]);

  const checkSpeaking = useCallback(async () => isSpeaking(), []);

  return {
    phase,
    isRecording: phase === 'recording',
    isBusy: phase !== 'idle',
    toggleRecording,
    cancelRecording,
    speakReply,
    interrupt,
    checkSpeaking,
  };
}
