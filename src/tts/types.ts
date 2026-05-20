export type TtsEngineId = 'webspeech' | 'supertonic';

export type TtsVoice = {
  id: string;
  label: string;
  lang: string;
};

export type TtsCapability = {
  id: TtsEngineId;
  available: boolean;
  reason?: string; // why unavailable
  highQuality: boolean;
  requiresDownload: boolean;
  downloadBytes?: number;
};

export interface TtsEngine {
  readonly id: TtsEngineId;
  init(): Promise<void>;
  listVoices(lang: string): TtsVoice[];
  speak(text: string, opts: { lang: string; voiceId?: string; speed?: number }): Promise<void>;
  stop(): void;
  dispose(): void;
}
