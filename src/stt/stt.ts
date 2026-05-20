import type {
  SttLanguage,
  SttModelId,
  SttResult,
  SttWorkerInbound,
} from './types';

export type SttListener = (r: SttResult) => void;

export class SttEngine {
  private worker: Worker | null = null;
  private listeners = new Set<SttListener>();

  load(modelId: SttModelId, language: SttLanguage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(new URL('./sttWorker.ts', import.meta.url), {
        type: 'module',
      });
      const handleReady = (r: SttResult) => {
        if (r.type === 'status' && r.status === 'ready') {
          this.listeners.delete(handleReady);
          resolve();
        } else if (r.type === 'error') {
          this.listeners.delete(handleReady);
          reject(new Error(r.error));
        }
      };
      this.listeners.add(handleReady);
      this.worker.onmessage = (e: MessageEvent<SttResult>) => {
        for (const l of this.listeners) l(e.data);
      };
      this.worker.onerror = (e) => {
        for (const l of this.listeners) l({ type: 'error', error: e.message });
      };
      this.send({ kind: 'load', modelId, language });
    });
  }

  transcribe(
    chunkId: string,
    pcm: Float32Array,
    sampleRate: number,
    startMs: number,
    endMs: number,
  ): void {
    this.send({
      kind: 'transcribe',
      chunkId,
      pcm,
      sampleRate,
      startMs,
      endMs,
    });
  }

  on(listener: SttListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.send({ kind: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.listeners.clear();
  }

  private send(msg: SttWorkerInbound) {
    if (!this.worker) throw new Error('Worker not initialized');
    if (msg.kind === 'transcribe') {
      this.worker.postMessage(msg, [msg.pcm.buffer]);
    } else {
      this.worker.postMessage(msg);
    }
  }
}
