# Changelog - 2026-05-20

## v1.0.0 release
- Release: mark the Korean browser-local meeting-note maker as `v1.0.0`.
- GitHub Pages: publish from `main` through the existing Pages workflow.
- Repository metadata: include the GitHub Pages URL in both repo description and homepage.

## Korean STT default
- Decision: set the browser-local STT default to `onnx-community/moonshine-tiny-ko-ONNX`.
- Why: current Hugging Face model card exposes Transformers.js + ONNX usage, targets Korean ASR directly, and lists 27M parameters for constrained devices.
- Fallbacks kept: `Xenova/whisper-base`, `Xenova/whisper-small`, `onnx-community/whisper-large-v3-turbo`.
- Runtime guard: Moonshine skips Whisper-only generation options; Whisper keeps hallucination suppression options.
- Runtime change: force Moonshine to `wasm` + `q8` so the Korean ONNX model runs on CPU instead of the failing WebGPU decoder session.
- UI guard: worker load errors now move the app out of `loading` and into `error`, so controls are not permanently disabled.
- Compatibility guard: attach the pipeline tokenizer to Moonshine's processor after load because the model metadata creates a feature-extractor-only processor while the Moonshine ASR path decodes through `processor.batch_decode`.
- RCA: `preprocessor_config.json` for `onnx-community/moonshine-tiny-ko-ONNX` declares only `feature_extractor_type`, while `tokenizer_config.json` declares the tokenizer separately; Transformers.js therefore builds a processor without tokenizer even though the ASR pipeline later decodes through the processor.
- TTS runtime: keep Supertonic on WebGPU when available, but pass Vite-bundled ONNX Runtime WebGPU `.jsep.mjs/.jsep.wasm` asset URLs via `ort.env.wasm.wasmPaths` so the runtime does not fetch HTML fallback as wasm.

## Export and TTS progress
- Export fallback: keep Markdown/HTML blob URLs alive briefly and show a fallback download link after clicking, because some browser contexts can hide or block automatic blob downloads.
- TTS progress RCA: Supertonic's helper passed a URL directly into ONNX Runtime, so the app could only show model step progress such as `3/4`; byte-level progress was hidden inside ORT.
- TTS progress fix: stream each ONNX model with `fetch`, report current-file bytes and percent, then create the ORT session from the downloaded buffer.
- UX change: show overall percent, current-file percent, downloaded bytes, and a progress bar while Supertonic models load.
