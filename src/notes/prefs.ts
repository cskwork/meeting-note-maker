import type { SttLanguage, SttModelId } from '../stt/types';
import type { TtsEngineId } from '../tts/types';

const KEY = 'mnm.prefs.v2';
const LEGACY_KEY = 'mnm.prefs.v1';
const LEGACY_DEFAULT_STT_MODEL: SttModelId = 'Xenova/whisper-base';

export type Prefs = {
  sttModelId: SttModelId;
  sttLanguage: SttLanguage;
  ttsEngineId: TtsEngineId;
  ttsVoiceId: string;
};

const DEFAULTS: Prefs = {
  sttModelId: 'onnx-community/moonshine-tiny-ko-ONNX',
  sttLanguage: 'ko',
  ttsEngineId: 'supertonic',
  ttsVoiceId: 'F1',
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    if (parsed.sttModelId === LEGACY_DEFAULT_STT_MODEL) {
      parsed.sttModelId = DEFAULTS.sttModelId;
    }
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
