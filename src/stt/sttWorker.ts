/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import type {
  SttLanguage,
  SttModelId,
  SttWorkerInbound,
  SttWorkerOutbound,
} from './types';

type AsrFn = (
  input: Float32Array,
  opts?: Record<string, unknown>,
) => Promise<{ text: string } | { text: string }[]>;

let recognizer: AsrFn | null = null;
let activeLanguage: SttLanguage = 'ko';

const post = (msg: SttWorkerOutbound) => (self as DedicatedWorkerGlobalScope).postMessage(msg);

async function detectDevice(): Promise<'webgpu' | 'wasm'> {
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (!gpu) return 'wasm';
  try {
    const adapter = await (gpu as { requestAdapter: () => Promise<unknown> }).requestAdapter();
    return adapter ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

async function load(modelId: SttModelId, language: SttLanguage) {
  post({ type: 'status', status: 'loading', message: `Loading ${modelId}...` });
  activeLanguage = language;
  const device = await detectDevice();
  const opts = {
    device,
    dtype: device === 'webgpu' ? 'fp16' : 'fp32',
    progress_callback: (p: unknown) => {
      const ev = p as { status?: string; file?: string; progress?: number };
      if (ev.status === 'progress' && typeof ev.progress === 'number') {
        post({
          type: 'status',
          status: 'loading',
          message: `${ev.file ?? ''} ${Math.round(ev.progress)}%`,
        });
      }
    },
  } as unknown as Record<string, unknown>;
  recognizer = (await (pipeline as unknown as (
    task: string,
    model: string,
    opts: unknown,
  ) => Promise<AsrFn>)('automatic-speech-recognition', modelId, opts));
  post({ type: 'status', status: 'ready', message: `Loaded (${device})` });
}

async function transcribe(
  chunkId: string,
  pcm: Float32Array,
  _sampleRate: number,
  startMs: number,
  endMs: number,
) {
  if (!recognizer) {
    post({ type: 'error', error: 'Model not loaded' });
    return;
  }
  post({ type: 'status', status: 'processing' });
  try {
    const opts: Record<string, unknown> = {
      task: 'transcribe',
      return_timestamps: false,
    };
    if (activeLanguage !== 'auto') opts.language = activeLanguage;
    const out = (await recognizer(pcm, opts)) as { text: string } | { text: string }[];
    const text = (Array.isArray(out) ? out[0]?.text : out.text) ?? '';
    post({ type: 'final', chunkId, text: text.trim(), startMs, endMs });
    post({ type: 'status', status: 'listening' });
  } catch (e) {
    post({ type: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

self.onmessage = (e: MessageEvent<SttWorkerInbound>) => {
  const msg = e.data;
  if (msg.kind === 'load') {
    void load(msg.modelId, msg.language);
  } else if (msg.kind === 'transcribe') {
    void transcribe(msg.chunkId, msg.pcm, msg.sampleRate, msg.startMs, msg.endMs);
  } else if (msg.kind === 'dispose') {
    recognizer = null;
    self.close();
  }
};
