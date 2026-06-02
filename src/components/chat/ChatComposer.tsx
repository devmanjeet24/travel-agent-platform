import { useMemo } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Mic, Paperclip, Send, Square, Volume2 } from 'lucide-react-native'

import { brand, spacing } from '@/constants/design'
import { textWithWeight } from '@/constants/inter-typography'
import { typography } from '@/constants/typography'
import type { VoiceAssistantPhase } from '@/hooks/use-voice-assistant'
import { useResponsive } from '@/hooks/use-responsive'
import { useThemedStyles } from '@/hooks/use-themed-styles'
import { radii } from '@/lib/ui-styles'

const SEND_SIZE = 40
const ICON_SIZE = 36

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
  const { scaleFont, isSmallPhone, horizontalPadding } = useResponsive()
  const hint = voiceHint(voicePhase)
  const isRecording = voicePhase === 'recording'
  const isSpeaking = voicePhase === 'speaking'
  const voiceBusy = voicePhase !== 'idle'

  const hasInput = input.trim().length > 0
  const allowMultiline = hasInput && (input.includes('\n') || input.length > 72)

  const placeholder = isSmallPhone ? 'Message agent…' : 'Message your travel agent…'

  const inputFontSize = scaleFont(isSmallPhone ? 15 : 16)
  const inputLineHeight = Math.round(inputFontSize * (Platform.OS === 'android' ? 1.25 : 1.22))
  const inputVerticalInset = Platform.OS === 'android' ? 8 : 6
  const singleLineBoxHeight = inputLineHeight + inputVerticalInset * 2

  const inputStyle = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      color: theme.colors.text,
      fontSize: inputFontSize,
      lineHeight: inputLineHeight,
      minHeight: singleLineBoxHeight,
      maxHeight: allowMultiline ? 120 : singleLineBoxHeight,
      paddingTop: inputVerticalInset,
      paddingBottom: inputVerticalInset,
      paddingHorizontal: spacing.xs,
      textAlignVertical: 'center' as const,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    }),
    [
      allowMultiline,
      inputFontSize,
      inputLineHeight,
      inputVerticalInset,
      singleLineBoxHeight,
      theme.colors.text,
    ],
  )

  return (
    <View
      style={[
        styles.shell,
        {
          paddingBottom,
          paddingHorizontal: horizontalPadding,
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          ...(theme.isDark
            ? {}
            : {
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 8,
              }),
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
          <Text style={textWithWeight(typography.caption, '600', { color: brand.ai })} numberOfLines={1}>
            {hint}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.isDark ? theme.colors.muted : theme.colors.background,
            borderColor: isRecording ? `${brand.danger}66` : theme.colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach file"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={onPickAttachment}
          style={styles.sideIconBtn}
        >
          <Paperclip size={isSmallPhone ? 19 : 21} color={theme.colors.icon} />
        </Pressable>

        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline={allowMultiline}
          scrollEnabled={allowMultiline}
          value={input}
          onChangeText={onChangeText}
          editable={!isSending && !voiceBusy}
          onSubmitEditing={() => {
            if (canSend) onSend()
          }}
          blurOnSubmit={false}
          returnKeyType="send"
          style={inputStyle}
        />

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSpeaking ? 'Stop speaking' : 'Voice input'}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.sideIconBtn,
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
              <Square size={18} color={brand.ai} fill={brand.ai} />
            ) : (
              <Mic size={20} color={isRecording ? brand.danger : brand.ai} />
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
                opacity: canSend ? 1 : 0.85,
              },
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={brand.onPrimary} />
            ) : (
              <Send size={18} color={canSend ? brand.onPrimary : theme.colors.icon} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm + 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  sideIconBtn: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
    marginLeft: spacing.xs,
  },
  sendBtn: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
