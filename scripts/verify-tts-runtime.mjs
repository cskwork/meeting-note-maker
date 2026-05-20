import { readFileSync } from 'node:fs';

const supertonic = readFileSync('src/tts/supertonic.ts', 'utf8');
const playButton = readFileSync('src/ui/PlayButton.tsx', 'utf8');
const helper = readFileSync('src/tts/vendor/supertonic-helper.js', 'utf8');

const checks = [
  ['TTS imports bundled ORT WebGPU wasm URL', supertonic.includes('ort-wasm-simd-threaded.jsep.wasm?url')],
  ['TTS imports bundled ORT WebGPU mjs URL', supertonic.includes('ort-wasm-simd-threaded.jsep.mjs?url')],
  ['TTS configures ORT wasmPaths', supertonic.includes('wasmPaths')],
  ['TTS keeps WebGPU provider when available', supertonic.includes("detectWebGpu()) ? 'webgpu' : 'wasm'")],
  ['TTS play button is never disabled', !playButton.match(/<button[\s\S]*?disabled=/)],
  ['TTS play button only toggles listen and stop labels', playButton.includes("'■ 멈춤'") && playButton.includes("'▶ 듣기'")],
  ['TTS progress is hidden after stop', playButton.includes('playing && loading')],
  ['TTS selectors do not stay disabled after stop', !playButton.includes('disabled={playing || loading !== null}')],
  ['TTS stop aborts model initialization', supertonic.includes('initAbortController?.abort()')],
  ['TTS stop clears stale progress callbacks', supertonic.includes('this.onProgress = null')],
  ['TTS model downloader accepts AbortSignal', helper.includes('fetch(url, { signal })') && helper.includes('throwIfAborted')],
  [
    'Supertonic helper caches downloaded ONNX models',
    helper.includes("const MODEL_CACHE = 'mnm-model-v1'"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL ${name}`);
  process.exit(1);
}

for (const [name] of checks) console.log(`PASS ${name}`);
