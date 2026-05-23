import { useCallback, useRef, useState } from 'react';

import {
  createVoiceRecorder,
  releaseActiveNativeRecording,
  transcribeFromUri,
} from '@/lib/voice-recording';
import { isSpeaking, speakText, stopSpeaking } from '@/lib/voice-tts';

export type VoiceAssistantPhase = 'idle' | 'recording' | 'transcribing' | 'speaking';

type Options = {
  onTranscript: (text: string) => void | Promise<void>;
  onError: (message: string) => void;
};

export function useVoiceAssistant({ onTranscript, onError }: Options) {
  const recorderRef = useRef<Awaited<ReturnType<typeof createVoiceRecorder>> | null>(null);
  const phaseRef = useRef<VoiceAssistantPhase>('idle');
  const sessionLockRef = useRef(false);
  const [phase, setPhase] = useState<VoiceAssistantPhase>('idle');

  const setPhaseSafe = useCallback((next: VoiceAssistantPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const teardownRecorder = useCallback(async () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec) {
      await rec.cancel();
    }
    await releaseActiveNativeRecording();
  }, []);

  const startRecording = useCallback(async () => {
    if (sessionLockRef.current) return;
    if (phaseRef.current !== 'idle') return;

    sessionLockRef.current = true;
    try {
      await stopSpeaking();
      await teardownRecorder();

      const recorder = await createVoiceRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      setPhaseSafe('recording');
    } catch (e) {
      await teardownRecorder();
      onError(e instanceof Error ? e.message : 'Could not start recording');
      setPhaseSafe('idle');
    } finally {
      sessionLockRef.current = false;
    }
  }, [onError, setPhaseSafe, teardownRecorder]);

  const stopRecordingAndSend = useCallback(async () => {
    if (phaseRef.current !== 'recording' || sessionLockRef.current) return;

    sessionLockRef.current = true;
    setPhaseSafe('transcribing');
    try {
      const rec = recorderRef.current;
      recorderRef.current = null;
      const uri = rec ? await rec.stop() : null;
      if (!uri) {
        setPhaseSafe('idle');
        return;
      }

      const text = await transcribeFromUri(uri);
      if (!text) {
        onError('No speech detected. Try again.');
        setPhaseSafe('idle');
        return;
      }

      await onTranscript(text);
      setPhaseSafe('idle');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Transcription failed');
      setPhaseSafe('idle');
    } finally {
      sessionLockRef.current = false;
    }
  }, [onTranscript, onError, setPhaseSafe]);

  const cancelRecording = useCallback(async () => {
    await teardownRecorder();
    setPhaseSafe('idle');
  }, [setPhaseSafe, teardownRecorder]);

  const toggleRecording = useCallback(async () => {
    if (phaseRef.current === 'recording') {
      await stopRecordingAndSend();
      return;
    }
    if (phaseRef.current !== 'idle') return;
    await startRecording();
  }, [startRecording, stopRecordingAndSend]);

  const speakReply = useCallback(
    async (reply: string) => {
      setPhaseSafe('speaking');
      await speakText(reply, () => setPhaseSafe('idle'));
    },
    [setPhaseSafe],
  );

  const interrupt = useCallback(async () => {
    await stopSpeaking();
    await cancelRecording();
    setPhaseSafe('idle');
  }, [cancelRecording, setPhaseSafe]);

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
