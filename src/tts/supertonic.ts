import type { TtsEngine, TtsVoice } from './types';
import type {
  Style as SupertonicStyle,
  TextToSpeech as SupertonicTtsInstance,
} from './vendor/supertonic-helper';

/**
 * Supertonic-TTS engine wrapper. Lazy-loads onnxruntime-web and the vendored
 * cskwork/supertonic-tts helper (MIT) on first init(), then streams the
 * ~380MB Supertonic 3 ONNX weights from the Hugging Face CDN
 * (Supertone/supertonic-3) directly into the browser. WebGPU first, WASM
 * fallback. All inference runs in the document — no audio leaves the device.
 */

const HF_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main';
const ONNX_BASE = `${HF_BASE}/onnx`;
const VOICE_STYLE_BASE = `${HF_BASE}/voice_styles`;

const VOICES: TtsVoice[] = [
  { id: 'F1', label: 'Mina (여성)', lang: 'ko' },
  { id: 'F2', label: 'Sora (여성)', lang: 'ko' },
  { id: 'F3', label: 'Yuna (여성)', lang: 'ko' },
  { id: 'M1', label: 'Aiden (남성)', lang: 'ko' },
  { id: 'M2', label: 'Hiro (남성)', lang: 'ko' },
  { id: 'M3', label: 'Leo (남성)', lang: 'ko' },
];

export type SupertonicProgress = (phase: string, current: number, total: number) => void;

export class SupertonicTts implements TtsEngine {
  readonly id = 'supertonic' as const;
  private tts: SupertonicTtsInstance | null = null;
  private styles: Map<string, SupertonicStyle> = new Map();
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private onProgress: SupertonicProgress | null = null;

  setProgress(cb: SupertonicProgress | null): void {
    this.onProgress = cb;
  }

  async init(): Promise<void> {
    if (this.tts) return;
    const [helper, ort] = await Promise.all([
      import('./vendor/supertonic-helper'),
      import('onnxruntime-web'),
    ]);
    helper.configureOrt(ort);

    const device = (await detectWebGpu()) ? 'webgpu' : 'wasm';
    const sessionOptions = {
      executionProviders: [device],
      graphOptimizationLevel: 'all',
    } as Record<string, unknown>;

    const onModelProgress = (name: string, c: number, t: number) =>
      this.onProgress?.(`모델 다운로드: ${name}`, c, t);

    const { textToSpeech } = await helper.loadTextToSpeech(
      ONNX_BASE,
      sessionOptions,
      onModelProgress,
    );
    this.tts = textToSpeech;
  }

  listVoices(_lang: string): TtsVoice[] {
    return VOICES;
  }

  async speak(
    text: string,
    opts: { lang: string; voiceId?: string; speed?: number },
  ): Promise<void> {
    if (!this.tts) throw new Error('supertonic-tts not initialized');
    const voiceId = opts.voiceId ?? 'F1';
    const style = await this.ensureStyle(voiceId);

    this.onProgress?.('음성 합성 중', 0, 1);
    const { wav } = await this.tts.call(
      text,
      opts.lang === 'auto' ? 'ko' : opts.lang,
      style,
      8, // totalStep (quality 4-16, 8 = balanced default per upstream)
      opts.speed ?? 1.05,
      0.3, // silenceDuration between chunks
      (step: number, total: number) => this.onProgress?.('합성 진행', step, total),
    );

    await this.playFloat32(new Float32Array(wav), this.tts.sampleRate);
  }

  stop(): void {
    try {
      this.currentSource?.stop();
    } catch {
      // ignore — already stopped
    }
    this.currentSource = null;
  }

  dispose(): void {
    this.stop();
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.tts = null;
    this.styles.clear();
  }

  private async ensureStyle(voiceId: string): Promise<SupertonicStyle> {
    const hit = this.styles.get(voiceId);
    if (hit) return hit;
    const helper = await import('./vendor/supertonic-helper');
    this.onProgress?.(`보이스 스타일 로드: ${voiceId}`, 0, 1);
    const style = await helper.loadVoiceStyle([`${VOICE_STYLE_BASE}/${voiceId}.json`]);
    this.styles.set(voiceId, style);
    return style;
  }

  private async playFloat32(pcm: Float32Array, sampleRate: number): Promise<void> {
    if (!this.audioCtx) this.audioCtx = new AudioContext({ sampleRate });
    const buf = this.audioCtx.createBuffer(1, pcm.length, sampleRate);
    buf.getChannelData(0).set(pcm);
    return new Promise((resolve) => {
      const src = this.audioCtx!.createBufferSource();
      src.buffer = buf;
      src.connect(this.audioCtx!.destination);
      src.onended = () => resolve();
      this.currentSource = src;
      src.start();
    });
  }
}

export async function detectWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
