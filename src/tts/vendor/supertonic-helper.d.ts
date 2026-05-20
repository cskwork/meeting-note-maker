// Type shim for the vendored upstream helper.js.
// Only the surface used by src/tts/supertonic.ts is declared.

export const AVAILABLE_LANGS: readonly string[];
export function isValidLang(lang: string): boolean;
export function configureOrt(ortModule: unknown): void;

export class UnicodeProcessor {
  constructor(indexer: number[]);
}

export class Style {
  // Opaque to TS; produced by loadVoiceStyle.
  readonly ttl: { dims: number[] };
  readonly dp: unknown;
}

export class TextToSpeech {
  readonly sampleRate: number;
  call(
    text: string,
    lang: string,
    style: Style,
    totalStep: number,
    speed?: number,
    silenceDuration?: number,
    progressCallback?: ((step: number, total: number) => void) | null,
  ): Promise<{ wav: number[]; duration: number[] }>;
}

export function loadVoiceStyle(
  voiceStylePaths: string[],
  verbose?: boolean,
): Promise<Style>;

export function loadTextToSpeech(
  onnxDir: string,
  sessionOptions?: Record<string, unknown>,
  progressCallback?:
    | ((
        name: string,
        current: number,
        total: number,
        detail?: {
          status: 'start' | 'progress' | 'done';
          loadedBytes: number;
          totalBytes: number;
          progress: number | null;
        },
      ) => void)
    | null,
): Promise<{ textToSpeech: TextToSpeech; cfgs: unknown }>;

export function writeWavFile(audioData: number[] | Float32Array, sampleRate: number): ArrayBuffer;
