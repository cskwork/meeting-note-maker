import type { SttLanguage, SttModelId } from '../stt/types';
import type { TtsEngineId } from '../tts/types';

const KEY = 'mnm.prefs.v1';

export type Prefs = {
  sttModelId: SttModelId;
  sttLanguage: SttLanguage;
  ttsEngineId: TtsEngineId;
  ttsVoiceId: string;
};

const DEFAULTS: Prefs = {
  sttModelId: 'Xenova/whisper-base',
  sttLanguage: 'ko',
  ttsEngineId: 'supertonic',
  ttsVoiceId: 'F1',
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(prefs: Partial<Prefs>): void {
  try {
    const current = loadPrefs();
    const next = { ...current, ...prefs };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
