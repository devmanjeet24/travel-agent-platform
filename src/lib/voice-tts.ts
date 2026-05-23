import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

const MAX_SPEAK_CHARS = 1200;

function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SPEAK_CHARS);
}

export async function speakText(
  text: string,
  onDone?: () => void,
): Promise<void> {
  const cleaned = stripForSpeech(text);
  if (!cleaned) {
    onDone?.();
    return;
  }

  await stopSpeaking();

  return new Promise((resolve) => {
    Speech.speak(cleaned, {
      language: 'en-US',
      pitch: 1,
      rate: Platform.OS === 'ios' ? 0.52 : 0.95,
      onDone: () => {
        onDone?.();
        resolve();
      },
      onStopped: () => {
        onDone?.();
        resolve();
      },
      onError: () => {
        onDone?.();
        resolve();
      },
    });
  });
}

export async function stopSpeaking(): Promise<void> {
  const speaking = await Speech.isSpeakingAsync();
  if (speaking) {
    Speech.stop();
  }
}

export async function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
