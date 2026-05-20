# Meeting Note Maker — Ultragoal Brief

## Vision
A privacy-first, browser-native meeting note maker for daily corporate use.
Real-time Korean speech-to-text runs **fully locally** in the browser (WebGPU /
WASM), produces a live transcript on web or mobile screen, dynamically formats
it into professional meeting notes, exports to HTML / Markdown / PDF, and can
read the result back via supertonic-tts (WebGPU) — all hostable on GitHub Pages
with zero server dependency.

## Non-Negotiables
- **bkit must drive the workflow** (PDCA per feature, Trust Level L0-L4 gates,
  9-phase pipeline). Wrap multi-feature work in `/sprint` if appropriate.
- **Privacy**: audio never leaves the device. No server-side STT, no telemetry
  by default.
- **Korean STT priority**: must transcribe Korean conversation reliably; English
  fallback acceptable as a bonus.
- **Static-deployable**: must run from GitHub Pages (single static bundle, no
  origin server). PWA-ready preferred.
- **Real-time UX**: transcript appears as the user speaks; latency budget < 1s
  per partial chunk on a modern laptop / iPhone Pro.
- **Export parity**: HTML, Markdown, PDF must all preserve speaker/section
  structure.
- **TTS playback**: integrate `cskwork/supertonic-tts` (WebGPU) so any saved
  note can be read aloud with one button.

## In-scope features (initial release)
1. Microphone capture + VAD (voice activity detection)
2. Local Whisper-class Korean STT (transformers.js / WebGPU when available,
   WASM fallback)
3. Live streaming transcript view (web + mobile responsive)
4. Auto-structuring of raw transcript into "Meeting Notes" template
   (title, date, attendees placeholder, agenda sections, action items)
5. In-browser editor for post-editing the structured notes
6. Export pipeline: HTML, Markdown, PDF (browser-side rendering)
7. supertonic-tts playback of the final notes
8. Static deploy to GitHub Pages with PWA install support

## Out of scope (initial release)
- Multi-user collaboration / real-time sync
- Cloud accounts, login, persistent server-side storage
- Speaker diarization beyond simple heuristics (can be a stretch goal)
- Translation

## Tech direction (to be locked in G001)
- Frontend: Vite + React (or SvelteKit static) — pick one in G001 after
  bkit research
- STT: candidates = whisper.cpp WASM, Xenova/whisper-web (transformers.js),
  Moonshine; constraint = Korean quality + WebGPU support
- TTS: github.com/cskwork/supertonic-tts (WebGPU)
- Export: marked + jsPDF (or browser print) for PDF
- Hosting: GitHub Pages static deploy via GitHub Actions

## Quality gates (final story G008 must pass all)
- bkit gap-detector: matchRate >= 90%
- bkit code-analyzer: no CRITICAL/HIGH findings
- Zero Script QA: real microphone test in Chrome on macOS and Safari on iOS
  produces readable Korean transcript
- ai-slop-cleaner pass
- $code-review APPROVE
- Lighthouse PWA score >= 90 on the deployed Pages URL
