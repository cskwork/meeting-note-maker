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

  async start(opts: MicCaptureOpts): Promise<void> {
    if (this.vad) throw new Error('Already started');
    this.sessionStart = performance.now();
    this.vad = await MicVAD.new({
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
        // Drop segments shorter than 500ms (16k * 0.5 = 8000 samples) —
        // Whisper hallucinates badly on very short audio.
        if (audio.length < 8000) return;
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
    try {
      this.vad.start();
    } catch (e) {
      opts.onError?.(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.vad) return;
    this.vad.pause();
    this.vad.destroy();
    this.vad = null;
  }

  get running(): boolean {
    return this.vad !== null;
  }
}
