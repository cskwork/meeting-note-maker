export type SttLanguage = 'ko' | 'en' | 'auto';

export type SttModelId =
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small'
  | 'onnx-community/whisper-large-v3-turbo';

export type SttStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'error';

export type SttResult =
  | { type: 'status'; status: SttStatus; message?: string }
  | { type: 'partial'; chunkId: string; text: string }
  | {
      type: 'final';
      chunkId: string;
      text: string;
      startMs: number;
      endMs: number;
    }
  | { type: 'error'; error: string };

export type SttWorkerInbound =
  | { kind: 'load'; modelId: SttModelId; language: SttLanguage }
  | {
      kind: 'transcribe';
      chunkId: string;
      pcm: Float32Array;
      sampleRate: number;
      startMs: number;
      endMs: number;
    }
  | { kind: 'dispose' };

export type SttWorkerOutbound = SttResult;
