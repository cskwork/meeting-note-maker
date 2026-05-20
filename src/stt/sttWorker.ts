/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import type {
  SttLanguage,
  SttModelId,
  SttWorkerInbound,
  SttWorkerOutbound,
} from './types';

// transformers.js v3 returns a huge union for `pipeline('automatic-speech-
// recognition', ...)`. We only call it as a function with (audio, opts) and
// only read `.text` off the result, so we narrow to that exact contract via
// a single explicit cast at call sites — not three layers of unknown.
type AsrPipelineOptions = {
  task?: 'transcribe' | 'translate';
  language?: SttLanguage | string;
  return_timestamps?: boolean | 'word';
  temperature?: number;
  no_repeat_ngram_size?: number;
  condition_on_previous_text?: boolean;
  no_speech_threshold?: number;
  compression_ratio_threshold?: number;
  logprob_threshold?: number;
};

interface AsrPipeline {
  (input: Float32Array, opts?: AsrPipelineOptions): Promise<
    { text: string } | { text: string }[]
  >;
}

interface MoonshinePipelineWithTokenizer extends AsrPipeline {
  tokenizer?: {
    batch_decode?: (...args: unknown[]) => unknown;
    decode?: (...args: unknown[]) => unknown;
  };
  processor?: {
    components?: {
      tokenizer?: unknown;
    };
    tokenizer?: unknown;
    batch_decode?: (...args: unknown[]) => unknown;
    decode?: (...args: unknown[]) => unknown;
  };
}

interface AsrPipelineFactoryOpts {
  device: 'webgpu' | 'wasm';
  dtype: 'fp16' | 'fp32' | 'q4f16' | 'q8';
  progress_callback?: (p: unknown) => void;
}

type PipelineFn = (
  task: 'automatic-speech-recognition',
  model: string,
  opts: AsrPipelineFactoryOpts,
) => Promise<AsrPipeline>;

type QueuedTranscription = {
  chunkId: string;
  pcm: Float32Array;
  sampleRate: number;
  startMs: number;
  endMs: number;
};

let asrPipeline: AsrPipeline | null = null;
let activeLanguage: SttLanguage = 'ko';
let activeModelId: SttModelId | null = null;
let transcriptionQueue: QueuedTranscription[] = [];
let transcriptionRunning = false;

const post = (msg: SttWorkerOutbound) => (self as DedicatedWorkerGlobalScope).postMessage(msg);

async function detectDevice(): Promise<'webgpu' | 'wasm'> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return 'wasm';
  try {
    const adapter = await gpu.requestAdapter();
    return adapter ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

async function load(modelId: SttModelId, language: SttLanguage) {
  post({ type: 'status', status: 'loading', message: `Loading ${modelId}...` });
  activeLanguage = language;
  activeModelId = modelId;
  const device = await selectDevice(modelId);
  const dtype = selectDtype(modelId, device);
  const factory: AsrPipelineFactoryOpts = {
    device,
    dtype,
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
  };
  // Single narrow cast: pipeline's published type signature is a giant union
  // we don't need. We only invoke it through AsrPipeline.
  try {
    asrPipeline = await (pipeline as unknown as PipelineFn)(
      'automatic-speech-recognition',
      modelId,
      factory,
    );
    ensureMoonshineTokenizer(modelId, asrPipeline);
    post({ type: 'status', status: 'ready', message: `Loaded (${device}, ${dtype})` });
  } catch (e) {
    asrPipeline = null;
    post({ type: 'error', error: formatLoadError(e) });
  }
}

async function transcribe(
  chunkId: string,
  pcm: Float32Array,
  sampleRate: number,
  startMs: number,
  endMs: number,
) {
  transcriptionQueue.push({ chunkId, pcm, sampleRate, startMs, endMs });
  void processTranscriptionQueue();
}

async function processTranscriptionQueue() {
  if (transcriptionRunning) return;
  const initialPipeline = asrPipeline;
  if (!initialPipeline) {
    post({ type: 'error', error: 'Model not loaded' });
    return;
  }
  transcriptionRunning = true;
  try {
    while (transcriptionQueue.length > 0) {
      const pipelineForChunk = asrPipeline;
      if (!pipelineForChunk) break;
      const next = transcriptionQueue.shift()!;
      post({
        type: 'status',
        status: 'processing',
        message: transcriptionQueue.length > 0 ? `queued ${transcriptionQueue.length}` : undefined,
      });
      await transcribeQueued(next, pipelineForChunk);
    }
  } finally {
    transcriptionRunning = false;
    if (asrPipeline) post({ type: 'status', status: 'listening' });
  }
}

async function transcribeQueued({
  chunkId,
  pcm,
  startMs,
  endMs,
}: QueuedTranscription, pipelineForChunk: AsrPipeline): Promise<void> {
  try {
    const opts = createAsrOptions();
    const out = await pipelineForChunk(pcm, opts);
    const rawText = (Array.isArray(out) ? out[0]?.text : out.text) ?? '';
    const cleaned = scrubHallucination(rawText);
    if (cleaned) post({ type: 'final', chunkId, text: cleaned, startMs, endMs });
  } catch (e) {
    post({ type: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

function createAsrOptions(): AsrPipelineOptions {
  if (isMoonshineModel(activeModelId)) return {};
  const opts: AsrPipelineOptions = {
    // Hallucination-suppression options for the transformers.js Whisper
    // pipeline. Whisper-base on Korean is prone to outputting "- - - -",
    // ellipses, or repeated tokens on silence/noise.
    task: 'transcribe',
    return_timestamps: false,
    temperature: 0,
    no_repeat_ngram_size: 3,
    condition_on_previous_text: false,
    no_speech_threshold: 0.6,
    compression_ratio_threshold: 2.4,
    logprob_threshold: -1.0,
  };
  if (activeLanguage !== 'auto') opts.language = activeLanguage;
  return opts;
}

// Exported for the scrub-fixture unit test in scripts/verify-scrub.mjs.
// Kept in this file to ensure the test runs against the actual code path.
export { scrubHallucination };

// Whisper's classic failure modes on Korean + small models:
//   1. Silence -> "- - - -" or "..." or pure punctuation
//   2. Repetition trap -> "뭐 뭐 뭐 뭐 뭣 뭢 뭉 ..." (same syllable explored)
//   3. Tokenizer leak -> "�" replacement chars and stray English fragments
// Strategy: strip replacement chars, then truncate at the first detectable
// degeneration boundary, then reject if what's left is just noise.
function scrubHallucination(text: string): string {
  let t = text.replace(/�/g, '').trim();
  if (!t) return '';

  t = truncateAtRepetitionLoop(t);

  if (!t) return '';
  // Pure punctuation / dashes / dots
  if (/^[\s\-—–·.…,!?。、ㆍ"'`()<>「」『』]+$/u.test(t)) return '';
  // Mostly a single repeated character (e.g. "ㅋㅋㅋㅋㅋㅋ" or "----")
  const compact = t.replace(/\s+/g, '');
  if (compact.length >= 4) {
    const firstChar = compact[0];
    const sameRatio = [...compact].filter((c) => c === firstChar).length / compact.length;
    if (sameRatio >= 0.9) return '';
  }
  return t;
}

/**
 * Detect Whisper's repetition trap and cut the output at its onset.
 * The loops we see in Korean are:
 *   - Same word repeated 4+ times: "뭐 뭐 뭐 뭐"
 *   - Many short tokens sharing the same first syllable: "뭐 뭣 뭢 뭉 뭈 뭃"
 *   - English filler bursts after Korean: "the the the the"
 */
function truncateAtRepetitionLoop(text: string): string {
  const tokens = text.split(/\s+/);
  if (tokens.length < 4) return text;

  // (a) exact same word 4 times in a row
  for (let i = 0; i + 3 < tokens.length; i++) {
    const a = stripPunct(tokens[i]);
    if (!a) continue;
    if (
      stripPunct(tokens[i + 1]) === a &&
      stripPunct(tokens[i + 2]) === a &&
      stripPunct(tokens[i + 3]) === a
    ) {
      return tokens.slice(0, i).join(' ').trim();
    }
  }

  // (b) sliding window of 6 tokens — if 5+ start with the same character
  // (1-syllable Korean exploration), cut at the window start
  const WIN = 6;
  const THRESHOLD = 5;
  for (let i = 0; i + WIN <= tokens.length; i++) {
    const window = tokens.slice(i, i + WIN).map(stripPunct).filter(Boolean);
    if (window.length < THRESHOLD) continue;
    const firsts = window.map((w) => [...w][0]);
    const top = mostCommon(firsts);
    if (top.count >= THRESHOLD) {
      return tokens.slice(0, i).join(' ').trim();
    }
  }

  return text;
}

function stripPunct(s: string): string {
  return s.replace(/[.!?,;:、。…·"'`()<>「」『』]/gu, '');
}

function mostCommon(arr: string[]): { ch: string; count: number } {
  const m = new Map<string, number>();
  for (const c of arr) m.set(c, (m.get(c) ?? 0) + 1);
  let best = { ch: '', count: 0 };
  for (const [ch, count] of m) if (count > best.count) best = { ch, count };
  return best;
}

function isMoonshineModel(modelId: SttModelId | null): boolean {
  return modelId === 'onnx-community/moonshine-tiny-ko-ONNX';
}

async function selectDevice(modelId: SttModelId): Promise<'webgpu' | 'wasm'> {
  if (isMoonshineModel(modelId)) return 'wasm';
  return detectDevice();
}

function selectDtype(modelId: SttModelId, device: 'webgpu' | 'wasm'): AsrPipelineFactoryOpts['dtype'] {
  if (isMoonshineModel(modelId)) {
    return 'q8';
  }
  return device === 'webgpu' ? 'fp16' : 'fp32';
}

function ensureMoonshineTokenizer(modelId: SttModelId, asr: AsrPipeline): void {
  if (!isMoonshineModel(modelId)) return;
  const moonshine = asr as MoonshinePipelineWithTokenizer;
  if (!moonshine.processor || !moonshine.tokenizer) return;
  if (!moonshine.processor.tokenizer && !moonshine.processor.components?.tokenizer) {
    moonshine.processor.components ??= {};
    moonshine.processor.components.tokenizer = moonshine.tokenizer;
  }
  moonshine.processor.batch_decode ??= (...args: unknown[]) =>
    moonshine.tokenizer?.batch_decode?.(...args);
  moonshine.processor.decode ??= (...args: unknown[]) =>
    moonshine.tokenizer?.decode?.(...args);
}

function formatLoadError(e: unknown): string {
  const detail = e instanceof Error ? e.message : String(e);
  return `STT 모델 로드 실패: ${detail}`;
}

self.onmessage = (e: MessageEvent<SttWorkerInbound>) => {
  const msg = e.data;
  if (msg.kind === 'load') {
    void load(msg.modelId, msg.language);
  } else if (msg.kind === 'setLanguage') {
    activeLanguage = msg.language;
  } else if (msg.kind === 'transcribe') {
    void transcribe(msg.chunkId, msg.pcm, msg.sampleRate, msg.startMs, msg.endMs);
  } else if (msg.kind === 'dispose') {
    asrPipeline = null;
    transcriptionQueue = [];
    self.close();
  }
};
