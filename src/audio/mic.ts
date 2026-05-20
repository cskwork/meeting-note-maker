import { MicVAD } from '@ricky0123/vad-web';

const SAMPLE_RATE = 16000;
const MIN_CHUNK_SAMPLES = 4000;
const MAX_CONTINUOUS_SPEECH_MS = 10_000;
const PRE_ROLL_MS = 300;
const ROLLING_OVERLAP_MS = 300;

export type SpeechChunk = {
  pcm: Float32Array;
  sampleRate: typeof SAMPLE_RATE;
  startMs: number;
  endMs: number;
};

export type MicCaptureOpts = {
  onSpeechStart?: () => void;
  onSpeechEnd: (chunk: SpeechChunk) => void;
  onError?: (e: Error) => void;
  // VAD tuning
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  minSpeechFrames?: number;
  redemptionFrames?: number;
};

export class MicCapture {
  private vad: MicVAD | null = null;
  private sessionStart = 0;
  private speechStartMs = 0;
  private speechActive = false;
  private recentFrames: Float32Array[] = [];
  private recentSamples = 0;
  private activeFrames: Float32Array[] = [];
  private activeSamples = 0;
  private unflushedSamples = 0;
  private startPromise: Promise<void> | null = null;
  private stopRequested = false;

  async start(opts: MicCaptureOpts): Promise<void> {
    if (this.vad || this.startPromise) return this.startPromise ?? Promise.resolve();
    this.stopRequested = false;
    this.startPromise = this._start(opts).finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async _start(opts: MicCaptureOpts): Promise<void> {
    this.sessionStart = performance.now();
    this.resetSpeechState();
    const vad = await MicVAD.new({
      // silero-vad runs at 16k; vad-web resamples mic input to 16k.
      // Defaults tuned to suppress Whisper hallucinations on short noise:
      // longer minSpeechFrames and tighter thresholds reject coughs/clicks/breath.
      positiveSpeechThreshold: opts.positiveSpeechThreshold ?? 0.6,
      negativeSpeechThreshold: opts.negativeSpeechThreshold ?? 0.4,
      minSpeechFrames: opts.minSpeechFrames ?? 9,
      redemptionFrames: opts.redemptionFrames ?? 24,
      submitUserSpeechOnPause: true,
      onFrameProcessed: (_probs, frame) => this.onFrame(frame, opts),
      onSpeechStart: () => {
        this.beginSpeech();
        opts.onSpeechStart?.();
      },
      onSpeechEnd: () => this.finishSpeech(opts),
      onVADMisfire: () => {
        // ignored — false positive, no callback needed
      },
    });
    // If stop() arrived during the awaited MicVAD.new, honor it now.
    if (this.stopRequested) {
      vad.pause();
      vad.destroy();
      return;
    }
    this.vad = vad;
    try {
      this.vad.start();
    } catch (e) {
      this.vad = null;
      vad.destroy();
      const err = e instanceof Error ? e : new Error(String(e));
      opts.onError?.(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    try {
      await this.startPromise;
    } catch {
      // start() already failed and surfaced its own error
    }
    if (!this.vad) return;
    this.vad.pause();
    this.vad.destroy();
    this.vad = null;
  }

  get running(): boolean {
    return this.vad !== null;
  }

  private onFrame(frame: Float32Array, opts: MicCaptureOpts): void {
    this.appendRecent(frame);
    if (!this.speechActive) return;
    this.activeFrames.push(frame);
    this.activeSamples += frame.length;
    this.unflushedSamples += frame.length;
    if (this.unflushedSamples >= msToSamples(MAX_CONTINUOUS_SPEECH_MS)) {
      this.flushActive(opts, true);
    }
  }

  private beginSpeech(): void {
    this.speechActive = true;
    this.activeFrames = this.recentFrames.slice();
    this.activeSamples = this.recentSamples;
    this.unflushedSamples = this.recentSamples;
    this.speechStartMs = Math.max(
      0,
      performance.now() - this.sessionStart - samplesToMs(this.recentSamples),
    );
  }

  private finishSpeech(opts: MicCaptureOpts): void {
    if (!this.speechActive) return;
    if (this.unflushedSamples >= MIN_CHUNK_SAMPLES) {
      this.flushActive(opts, false, performance.now() - this.sessionStart);
    }
    this.resetSpeechState();
  }

  private flushActive(opts: MicCaptureOpts, keepOverlap: boolean, endMs?: number): void {
    if (this.unflushedSamples < MIN_CHUNK_SAMPLES) return;
    const chunkEndMs = endMs ?? this.speechStartMs + samplesToMs(this.activeSamples);
    opts.onSpeechEnd({
      pcm: concatFrames(this.activeFrames),
      sampleRate: SAMPLE_RATE,
      startMs: this.speechStartMs,
      endMs: chunkEndMs,
    });
    if (!keepOverlap) return;
    const tail = takeTailFrames(this.activeFrames, msToSamples(ROLLING_OVERLAP_MS));
    this.activeFrames = tail.frames;
    this.activeSamples = tail.samples;
    this.unflushedSamples = 0;
    this.speechStartMs = Math.max(0, chunkEndMs - samplesToMs(tail.samples));
  }

  private appendRecent(frame: Float32Array): void {
    this.recentFrames.push(frame);
    this.recentSamples += frame.length;
    const maxSamples = msToSamples(PRE_ROLL_MS);
    while (this.recentSamples > maxSamples && this.recentFrames.length > 1) {
      const dropped = this.recentFrames.shift();
      this.recentSamples -= dropped?.length ?? 0;
    }
  }

  private resetSpeechState(): void {
    this.speechActive = false;
    this.recentFrames = [];
    this.recentSamples = 0;
    this.activeFrames = [];
    this.activeSamples = 0;
    this.unflushedSamples = 0;
  }
}

function concatFrames(frames: Float32Array[]): Float32Array {
  const total = frames.reduce((sum, frame) => sum + frame.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const frame of frames) {
    out.set(frame, offset);
    offset += frame.length;
  }
  return out;
}

function takeTailFrames(frames: Float32Array[], maxSamples: number): {
  frames: Float32Array[];
  samples: number;
} {
  const tail: Float32Array[] = [];
  let samples = 0;
  for (let i = frames.length - 1; i >= 0 && samples < maxSamples; i -= 1) {
    tail.unshift(frames[i]);
    samples += frames[i].length;
  }
  return { frames: tail, samples };
}

function msToSamples(ms: number): number {
  return Math.round((ms / 1000) * SAMPLE_RATE);
}

function samplesToMs(samples: number): number {
  return (samples / SAMPLE_RATE) * 1000;
}
