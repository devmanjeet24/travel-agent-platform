import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Mic, Paperclip, Send, Square, Volume2 } from 'lucide-react-native';

import { brand } from '@/constants/design';
import type { VoiceAssistantPhase } from '@/hooks/use-voice-assistant';
import { useResponsive } from '@/hooks/use-responsive';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { cardShadow, radii } from '@/lib/ui-styles';

type Props = {
  input: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickAttachment: () => void;
  onToggleVoice: () => void;
  onStopVoice?: () => void;
  canSend: boolean;
  isSending: boolean;
  voicePhase: VoiceAssistantPhase;
  paddingHorizontal: number;
  paddingBottom: number;
  contentWidth: number;
};

function voiceHint(phase: VoiceAssistantPhase): string | null {
  switch (phase) {
    case 'recording':
      return 'Listening… tap mic to send';
    case 'transcribing':
      return 'Understanding your voice…';
    case 'speaking':
      return 'Speaking reply… tap to stop';
    default:
      return null;
  }
}

export function ChatComposer({
  input,
  onChangeText,
  onSend,
  onPickAttachment,
  onToggleVoice,
  onStopVoice,
  canSend,
  isSending,
  voicePhase,
  paddingHorizontal,
  paddingBottom,
  contentWidth,
}: Props) {
  const theme = useThemedStyles();
  const { scaleFont, isSmallPhone } = useResponsive();
  const hint = voiceHint(voicePhase);
  const isRecording = voicePhase === 'recording';
  const isSpeaking = voicePhase === 'speaking';
  const voiceBusy = voicePhase !== 'idle';

  return (
    <View
      style={{
        paddingHorizontal,
        paddingTop: hint ? 6 : 10,
        paddingBottom,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      {hint ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {isSpeaking ? (
            <Volume2 size={14} color={brand.primaryDark} />
          ) : (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isRecording ? brand.danger : brand.primaryDark,
              }}
            />
          )}
          <Text style={{ color: brand.primaryDark, fontSize: 12, fontWeight: '600' }}>
            {hint}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: theme.colors.card,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: isRecording ? `${brand.danger}55` : theme.colors.border,
            paddingHorizontal: 6,
            paddingVertical: 6,
            maxWidth: contentWidth,
            alignSelf: 'center',
            width: '100%',
          },
          cardShadow(theme.isDark),
        ]}
      >
        <Pressable style={{ padding: isSmallPhone ? 8 : 10 }} onPress={onPickAttachment}>
          <Paperclip size={isSmallPhone ? 20 : 22} color={theme.colors.icon} />
        </Pressable>
        <TextInput
          placeholder="Message your travel agent..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          value={input}
          onChangeText={onChangeText}
          editable={!isSending && !voiceBusy}
          onSubmitEditing={() => {
            if (canSend) onSend();
          }}
          blurOnSubmit={false}
          style={{
            flex: 1,
            color: theme.colors.text,
            fontSize: scaleFont(16),
            lineHeight: 22,
            maxHeight: 120,
            paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            paddingHorizontal: 4,
          }}
        />
        <Pressable
          style={{
            padding: 10,
            borderRadius: radii.pill,
            backgroundColor: isRecording
              ? `${brand.danger}18`
              : isSpeaking
                ? `${brand.primaryDark}18`
                : 'transparent',
          }}
          onPress={isSpeaking ? onStopVoice : onToggleVoice}
          disabled={isSending || voicePhase === 'transcribing'}
        >
          {isSpeaking ? (
            <Square size={20} color={brand.primaryDark} fill={brand.primaryDark} />
          ) : (
            <Mic size={22} color={isRecording ? brand.danger : brand.primaryDark} />
          )}
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={{
            width: isSmallPhone ? 40 : 44,
            height: isSmallPhone ? 40 : 44,
            borderRadius: isSmallPhone ? 20 : 22,
            backgroundColor: canSend ? brand.primaryDark : theme.colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 2,
          }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={brand.onPrimary} />
          ) : (
            <Send size={20} color={canSend ? brand.onPrimary : theme.colors.icon} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
