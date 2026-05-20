# Vendored: supertonic-tts helper

`supertonic-helper.js` (566 lines) is vendored verbatim from
[cskwork/supertonic-tts](https://github.com/cskwork/supertonic-tts) `app/helper.js`,
MIT License.

The Supertonic 3 ONNX model weights and voice style tensors are NOT vendored;
they are streamed at runtime from the Hugging Face CDN under
`https://huggingface.co/Supertone/supertonic-3/resolve/main`.

## Public surface used by this project (`src/tts/supertonic.ts`)
- `configureOrt(ortModule)` — inject `onnxruntime-web`
- `loadTextToSpeech(onnxDir, sessionOptions, progressCallback)` → `{ textToSpeech, cfgs }`
- `loadVoiceStyle([styleUrl])` → `Style`
- `TextToSpeech.call(text, lang, style, totalStep, speed, silenceDuration, progressCallback)` → `{ wav: number[], duration }`
- `writeWavFile(audioData, sampleRate)` → `ArrayBuffer`

## Licenses
- App code: MIT
- Supertonic 3 model weights: subject to Supertone's license
  (https://huggingface.co/Supertone/supertonic-3)

## Upgrade procedure
1. Pull the latest `app/helper.js` from cskwork/supertonic-tts upstream.
2. Diff against `supertonic-helper.js` here, mind any signature changes in
   `configureOrt` / `loadTextToSpeech` / `loadVoiceStyle` / `TextToSpeech.call`.
3. If the surface used in `src/tts/supertonic.ts` shifted, update both the
   `.d.ts` shim and the engine.
