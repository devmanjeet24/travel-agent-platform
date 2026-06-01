import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { Mic, Paperclip, Send, Square, Volume2 } from 'lucide-react-native'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import type { VoiceAssistantPhase } from '@/hooks/use-voice-assistant'
import { useResponsive } from '@/hooks/use-responsive'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { radii } from '@/lib/ui-styles'

/** Minimum touch target (dp) — Material / WCAG-aligned for APK. */
const MIN_TOUCH = 44

type Props = {
  input: string
  onChangeText: (text: string) => void
  onSend: () => void
  onPickAttachment: () => void
  onToggleVoice: () => void
  onStopVoice?: () => void
  canSend: boolean
  isSending: boolean
  voicePhase: VoiceAssistantPhase
  paddingBottom: number
}

function voiceHint(phase: VoiceAssistantPhase): string | null {
  switch (phase) {
    case 'recording':
      return 'Listening… tap mic to send'
    case 'transcribing':
      return 'Understanding your voice…'
    case 'speaking':
      return 'Speaking reply… tap to stop'
    default:
      return null
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
  paddingBottom,
}: Props) {
  const theme = useThemedStyles()
  const { scaleFont, isSmallPhone } = useResponsive()
  const { width: screenWidth } = useWindowDimensions()
  const hint = voiceHint(voicePhase)
  const isRecording = voicePhase === 'recording'
  const isSpeaking = voicePhase === 'speaking'
  const voiceBusy = voicePhase !== 'idle'

  return (
    <View
      style={[
        styles.shell,
        {
          width: screenWidth,
          paddingBottom,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {hint ? (
        <View style={styles.hintRow}>
          {isSpeaking ? (
            <Volume2 size={14} color={brand.ai} />
          ) : (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isRecording ? brand.danger : brand.ai,
                marginRight: 6,
              }}
            />
          )}
          <Text style={textWithWeight(typography.caption, '600', { color: brand.ai })}>{hint}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          {
            width: screenWidth - spacing.lg * 2,
            backgroundColor: theme.isDark ? theme.colors.muted : theme.colors.background,
            borderColor: isRecording ? `${brand.danger}55` : theme.colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach file"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={onPickAttachment}
          style={styles.iconBtn}
        >
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
            if (canSend) onSend()
          }}
          blurOnSubmit={false}
          style={{
            flex: 1,
            minWidth: 0,
            color: theme.colors.text,
            fontSize: scaleFont(16),
            lineHeight: 22,
            maxHeight: 120,
            paddingVertical: 8,
            paddingHorizontal: spacing.xs,
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? 'Stop speaking' : 'Voice input'}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[
            styles.iconBtn,
            {
              borderRadius: radii.md,
              backgroundColor: isRecording
                ? `${brand.danger}18`
                : isSpeaking
                  ? `${brand.ai}18`
                  : 'transparent',
            },
          ]}
          onPress={isSpeaking ? onStopVoice : onToggleVoice}
          disabled={isSending || voicePhase === 'transcribing'}
        >
          {isSpeaking ? (
            <Square size={20} color={brand.ai} fill={brand.ai} />
          ) : (
            <Mic size={22} color={isRecording ? brand.danger : brand.ai} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          onPress={onSend}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            {
              backgroundColor: canSend ? brand.primary : theme.colors.muted,
              opacity: canSend ? 1 : 0.7,
            },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={brand.onPrimary} />
          ) : (
            <Send size={20} color={canSend ? brand.onPrimary : theme.colors.icon} />
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    elevation: 0,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    elevation: 0,
  },
  iconBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
})
