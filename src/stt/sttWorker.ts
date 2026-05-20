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
    // Hallucination-suppression options for the transformers.js Whisper
    // pipeline. Whisper-base on Korean is prone to outputting "- - - -",
    // ellipses, or repeated tokens on silence/noise. The thresholds + greedy
    // temperature + no-prompt-conditioning make the worst cases far rarer.
    const opts: Record<string, unknown> = {
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
    const out = (await recognizer(pcm, opts)) as { text: string } | { text: string }[];
    const rawText = (Array.isArray(out) ? out[0]?.text : out.text) ?? '';
    const cleaned = scrubHallucination(rawText);
    if (cleaned) {
      post({ type: 'final', chunkId, text: cleaned, startMs, endMs });
    }
    post({ type: 'status', status: 'listening' });
  } catch (e) {
    post({ type: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

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

self.onmessage = (e: MessageEvent<SttWorkerInbound>) => {
  const msg = e.data;
  if (msg.kind === 'load') {
    void load(msg.modelId, msg.language);
  } else if (msg.kind === 'setLanguage') {
    activeLanguage = msg.language;
  } else if (msg.kind === 'transcribe') {
    void transcribe(msg.chunkId, msg.pcm, msg.sampleRate, msg.startMs, msg.endMs);
  } else if (msg.kind === 'dispose') {
    recognizer = null;
    self.close();
  }
};
