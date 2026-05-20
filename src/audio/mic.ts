import { MicVAD } from '@ricky0123/vad-web';

export type SpeechChunk = {
  pcm: Float32Array;
  sampleRate: 16000;
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
    const vad = await MicVAD.new({
      // silero-vad runs at 16k; vad-web resamples mic input to 16k.
      // Defaults tuned to suppress Whisper hallucinations on short noise:
      // longer minSpeechFrames and tighter thresholds reject coughs/clicks/breath.
      positiveSpeechThreshold: opts.positiveSpeechThreshold ?? 0.6,
      negativeSpeechThreshold: opts.negativeSpeechThreshold ?? 0.4,
      minSpeechFrames: opts.minSpeechFrames ?? 9,
      redemptionFrames: opts.redemptionFrames ?? 24,
      onSpeechStart: () => {
        this.speechStartMs = performance.now() - this.sessionStart;
        opts.onSpeechStart?.();
      },
      onSpeechEnd: (audio: Float32Array) => {
        const endMs = performance.now() - this.sessionStart;
        // Drop segments shorter than 250ms (16k * 0.25 = 4000 samples) —
        // very short audio confuses Whisper, but Korean single syllables
        // can be ~300ms so don't be too aggressive.
        if (audio.length < 4000) return;
        opts.onSpeechEnd({
          pcm: audio,
          sampleRate: 16000,
          startMs: this.speechStartMs,
          endMs,
        });
      },
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
}
