import { readFileSync } from 'node:fs';

const supertonic = readFileSync('src/tts/supertonic.ts', 'utf8');

const checks = [
  ['TTS imports bundled ORT WebGPU wasm URL', supertonic.includes('ort-wasm-simd-threaded.jsep.wasm?url')],
  ['TTS imports bundled ORT WebGPU mjs URL', supertonic.includes('ort-wasm-simd-threaded.jsep.mjs?url')],
  ['TTS configures ORT wasmPaths', supertonic.includes('wasmPaths')],
  ['TTS keeps WebGPU provider when available', supertonic.includes("detectWebGpu()) ? 'webgpu' : 'wasm'")],
  [
    'Supertonic helper caches downloaded ONNX models',
    readFileSync('src/tts/vendor/supertonic-helper.js', 'utf8').includes("const MODEL_CACHE = 'mnm-model-v1'"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL ${name}`);
  process.exit(1);
}

for (const [name] of checks) console.log(`PASS ${name}`);
