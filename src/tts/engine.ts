import type { TtsCapability, TtsEngine, TtsEngineId } from './types';
import { WebSpeechTts } from './webspeech';
import { SupertonicTts, detectWebGpu } from './supertonic';

export async function detectCapabilities(): Promise<TtsCapability[]> {
  const webgpu = await detectWebGpu();
  const webSpeechOk = typeof speechSynthesis !== 'undefined';
  // Supertonic works on WASM too, but the 380MB download + multi-ONNX inference
  // is only realistic with WebGPU on consumer machines. Mark "available" when
  // either path exists but flag the WASM caveat in the reason.
  const supertonicAvailable = typeof navigator !== 'undefined';
  return [
    {
      id: 'webspeech',
      available: webSpeechOk,
      reason: webSpeechOk ? undefined : '브라우저가 Web Speech API를 지원하지 않습니다.',
      highQuality: false,
      requiresDownload: false,
    },
    {
      id: 'supertonic',
      available: supertonicAvailable,
      reason: webgpu
        ? '첫 사용 시 ~380MB 모델을 HuggingFace에서 다운로드합니다 (이후 SW 캐시).'
        : 'WebGPU 미지원 — WASM으로 동작하지만 매우 느릴 수 있습니다.',
      highQuality: true,
      requiresDownload: true,
      downloadBytes: 380 * 1024 * 1024,
    },
  ];
}

export function makeEngine(id: TtsEngineId): TtsEngine {
  if (id === 'webspeech') return new WebSpeechTts();
  return new SupertonicTts();
}
