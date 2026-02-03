import { useCallback, useRef, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { useToastContext } from '@librechat/client';
import { useSpeechToText, useGetAudioSettings, useLocalize } from '~/hooks';
import { globalAudioId } from '~/common';
import store from '~/store';

type DictateState = 'idle' | 'recording' | 'transcribing';

interface UseAudioRecorderOptions {
  /** Callback to set text in the form */
  setValue: (name: 'text', value: string, options?: { shouldValidate?: boolean }) => void;
  /** Callback to get current text value */
  getValues: (name: 'text') => string;
  /** Callback to reset the form */
  reset: (values: { text: string }) => void;
  /** Callback to submit the message */
  ask: (data: { text: string }) => void;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
}

/**
 * Hook that encapsulates all audio recording logic for the ChatGPT-style dictation UI.
 * Returns state and handlers for use in ChatForm.
 */
export default function useAudioRecorder({
  setValue,
  getValues,
  reset,
  ask,
  isSubmitting,
}: UseAudioRecorderOptions) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const isExternalSTT = speechToTextEndpoint === 'external';

  const existingTextRef = useRef<string>('');

  const [isRecordingMode, setIsRecordingMode] = useRecoilState(store.isRecordingMode);
  const [isTranscribing, setIsTranscribing] = useRecoilState(store.isTranscribingAudio);

  // Compute unified state
  const dictateState: DictateState = isTranscribing
    ? 'transcribing'
    : isRecordingMode
      ? 'recording'
      : 'idle';

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
      if (globalAudio) {
        globalAudio.muted = false;
      }

      if (isExternalSTT) {
        // External STT: exit recording mode, text is already in textarea
        setIsRecordingMode(false);
        setIsTranscribing(false);
        existingTextRef.current = '';
        return;
      }

      // Browser STT: original auto-send behavior
      if (isSubmitting) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const finalText = existingTextRef.current
          ? `${existingTextRef.current} ${text}`
          : text;
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
      }
    },
    [ask, reset, showToast, localize, isSubmitting, isExternalSTT, setIsRecordingMode, setIsTranscribing],
  );

  const setText = useCallback(
    (text: string) => {
      const newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      setValue('text', newText, { shouldValidate: true });
    },
    [setValue],
  );

  const {
    isListening,
    isLoading,
    analyserNode,
    startRecording: startRecordingInternal,
    stopRecording,
    confirmRecording: confirmRecordingInternal,
    cancelRecording: cancelRecordingInternal,
  } = useSpeechToText(setText, onTranscriptionComplete);

  const handleStartRecording = useCallback(async () => {
    existingTextRef.current = getValues('text') || '';

    if (isExternalSTT) {
      const success = await startRecordingInternal();
      if (success) {
        setIsRecordingMode(true);
      }
    } else {
      startRecordingInternal();
    }
  }, [isExternalSTT, startRecordingInternal, setIsRecordingMode, getValues]);

  const handleCancelRecording = useCallback(() => {
    cancelRecordingInternal();
    setIsRecordingMode(false);
    setIsTranscribing(false);
    // Restore original text
    if (existingTextRef.current) {
      setValue('text', existingTextRef.current, { shouldValidate: true });
    }
    existingTextRef.current = '';
  }, [cancelRecordingInternal, setIsRecordingMode, setIsTranscribing, setValue]);

  const handleConfirmRecording = useCallback(() => {
    setIsTranscribing(true);
    confirmRecordingInternal();
  }, [setIsTranscribing, confirmRecordingInternal]);

  const handleStopRecording = useCallback(() => {
    if (isExternalSTT) {
      handleConfirmRecording();
    } else {
      stopRecording();
      existingTextRef.current = '';
    }
  }, [isExternalSTT, handleConfirmRecording, stopRecording]);

  // Keyboard shortcut: Escape to cancel recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRecordingMode && e.key === 'Escape') {
        e.preventDefault();
        handleCancelRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingMode, handleCancelRecording]);

  return {
    // State
    dictateState,
    isRecordingMode,
    isTranscribing,
    isListening,
    isLoading,
    analyserNode,

    // Handlers
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
    cancelRecording: handleCancelRecording,
    confirmRecording: handleConfirmRecording,
  };
}
