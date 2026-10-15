import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionErrorCode, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';

import type { TKey } from '@/i18n';
import type { Lang } from '@/types';

type SpeechModule = typeof ExpoSpeechRecognitionModule;

/**
 * Looked up optionally (instead of importing expo-speech-recognition, which throws at import time
 * when the native module is missing) so the app still runs in Expo Go, where only typing is offered.
 */
const speech = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');

function recognitionAvailable(): boolean {
  try {
    return speech?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

const LOCALES: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN' };

const ERRORS: Partial<Record<ExpoSpeechRecognitionErrorCode, TKey>> = {
  'not-allowed': 'voice.errPermission',
  'service-not-allowed': 'voice.errUnavailable',
  'language-not-supported': 'voice.errLanguage',
  network: 'voice.errNetwork',
  'no-speech': 'voice.errNoSpeech',
  'speech-timeout': 'voice.errNoSpeech',
  busy: 'voice.errBusy',
};

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(' ');

/**
 * Dictation into `text`. Final results are appended to whatever was there when listening started, so
 * the user can speak, fix a word by typing, then speak again. `start` takes `hints` (saved item names) that help the
 * recogniser spell them the way the user saved them.
 */
export function useSpeech(initialText = '') {
  const [available] = useState(recognitionAvailable);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<TKey | null>(null);
  // Text before the current session plus the session's finished phrases; interim words show on top.
  const committed = useRef('');

  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener('start', () => setListening(true)),
      speech.addListener('end', () => setListening(false)),
      speech.addListener('result', (e) => {
        const heard = e.results[0]?.transcript ?? '';
        if (e.isFinal) {
          // Android sends each pause-separated phrase as its own final result; iOS sends one at the end.
          committed.current = join(committed.current, heard);
          setText(committed.current);
        } else {
          setText(join(committed.current, heard));
        }
      }),
      speech.addListener('error', (e) => {
        if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'voice.errGeneric');
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      speech.abort();
    };
  }, []);

  async function start(lang: Lang, hints: string[]) {
    if (!speech) return;
    setError(null);
    const perm = await speech.requestPermissionsAsync();
    if (!perm.granted) {
      setError('voice.errPermission');
      return;
    }
    committed.current = text;
    speech.start({
      lang: LOCALES[lang],
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      contextualStrings: hints.slice(0, 100),
    });
  }

  return {
    /** false in Expo Go, on web, and on devices without a speech service */
    available,
    listening,
    text,
    setText,
    error,
    start,
    stop: () => speech?.stop(),
  };
}
