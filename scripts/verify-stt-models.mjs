import { readFileSync } from 'node:fs';

const requiredModel = 'onnx-community/moonshine-tiny-ko-ONNX';

const files = {
  types: readFileSync('src/stt/types.ts', 'utf8'),
  prefs: readFileSync('src/notes/prefs.ts', 'utf8'),
  app: readFileSync('src/App.tsx', 'utf8'),
  worker: readFileSync('src/stt/sttWorker.ts', 'utf8'),
  mic: readFileSync('src/audio/mic.ts', 'utf8'),
};

const checks = [
  ['SttModelId includes Korean Moonshine', files.types.includes(`'${requiredModel}'`)],
  ['default STT model is Korean Moonshine', files.prefs.includes(`sttModelId: '${requiredModel}'`)],
  ['model selector exposes Korean-optimized label', files.app.includes('moonshine-tiny-ko')],
  ['model selector labels Moonshine as WASM CPU', files.app.includes('27M params · WASM CPU')],
  ['model selector hides Whisper options', !files.app.includes("id: 'Xenova/whisper-base'") && !files.app.includes('whisper-large-v3-turbo')],
  ['Moonshine forces WASM CPU device', files.worker.includes('selectDevice(modelId)') && files.worker.includes("return 'wasm'")],
  ['Moonshine uses q8 CPU weights', files.worker.includes("return 'q8'")],
  ['STT transcriptions are queued serially', files.worker.includes('transcriptionQueue') && files.worker.includes('processTranscriptionQueue')],
  ['long speech is force-flushed before silence', files.mic.includes('MAX_CONTINUOUS_SPEECH_MS') && files.mic.includes('onFrameProcessed')],
  ['long speech keeps boundary overlap', files.mic.includes('ROLLING_OVERLAP_MS') && files.mic.includes('takeTailFrames')],
  [
    'Moonshine attaches tokenizer to processor before decode',
    files.worker.includes('ensureMoonshineTokenizer') && files.worker.includes('processor.batch_decode'),
  ],
  ['worker load errors are posted to UI', files.worker.includes('formatLoadError(e)')],
  ['UI exits loading state on worker error', files.app.includes("setStatus('error')")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL ${name}`);
  process.exit(1);
}

for (const [name] of checks) console.log(`PASS ${name}`);
