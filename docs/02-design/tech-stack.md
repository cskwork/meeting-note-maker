# Tech Stack — Lock-in Rationale

## Summary
| Layer | Choice | Why |
|-------|--------|-----|
| Build tool | **Vite 5** | 가장 빠른 dev/build, ESM-first, Vue/React/Svelte 모두 지원, GitHub Pages 정적 출력 단순 |
| Framework | **React 18 + TypeScript** | transformers.js 예제 다수, concurrent rendering이 streaming partial UI에 유리, 채용/유지보수 표준 |
| Styling | **Tailwind CSS 3** | mobile-first 유틸리티, 다크모드 자동, 번들 작음 |
| State | **Zustand** | Redux 보일러플레이트 없이 worker ↔ UI 메시지 패턴에 적합 |
| STT | **@huggingface/transformers v3** (구 `@xenova/transformers`) | WebGPU 지원, Whisper Korean 사전학습 잘 동작, 단일 npm 패키지로 워커 통합 |
| STT model | `Xenova/whisper-base` (default), `onnx-community/whisper-large-v3-turbo` (optional) | base = 빠름·작음, large-v3-turbo = 정확도 우선 사용자용 |
| VAD | `@ricky0123/vad-web` | ONNX silero-vad, WebGPU 외에 WASM도 빠름, 검증된 라이브러리 |
| TTS | **cskwork/supertonic-tts** (필수, 사용자 지정) | WebGPU, 고품질, 사용자가 명시함 |
| Storage | `idb-keyval` (IndexedDB) + `localStorage` | 모델·노트는 IndexedDB, 편집 드래프트는 localStorage |
| Markdown | `marked` + `dompurify` | 작고 안전, GFM |
| PDF | `window.print()` 1차 + `jspdf` + `html2canvas` 폴백 | 한글 폰트 임베드 필요시 jsPDF 사용 |
| Service Worker | `workbox-window` | 모델 캐싱과 PWA install에 검증된 표준 |
| Hosting | **GitHub Pages** (gh-pages 브랜치) + **GitHub Actions** | 사용자가 명시한 호스팅 목표 |

## Rejected Alternatives
- **SvelteKit**: 번들 더 작지만 transformers.js + WebGPU 예제 커뮤니티가 React보다 얕아 통합 리스크
- **whisper.cpp WASM**: 검증되었으나 WebGPU 자체 지원 없음 → 미래성 제한
- **Moonshine**: 빠르지만 한국어 학습 데이터/검증이 Whisper보다 약함
- **jsPDF 단독**: 1차 PDF로는 `window.print()`가 한글 폰트 처리 더 쉬움; jsPDF는 폴백
- **MUI / Chakra**: 번들 크기 부담; Tailwind로 충분

## Korean STT 정확도 가이드 (G002 검증 대상)
공개 벤치마크에 따르면 한국어 WER:
- `whisper-tiny` ≈ 25-30% (사용 불가)
- `whisper-base` ≈ 15-20% (실용 하한)
- `whisper-small` ≈ 10-12% (균형)
- `whisper-large-v3` / `large-v3-turbo` ≈ 6-9% (최상)

기본 `whisper-base`로 시작, UI에서 "정확도 우선" 토글로 `large-v3-turbo`
다운로드 옵션 제공. 모델 크기:
- base ≈ 80MB
- small ≈ 250MB
- large-v3-turbo ≈ 800MB (WebGPU 권장)

## Dependency Version Pins (G001 종료시 package.json 작성)
- `react@^18.3.0`
- `react-dom@^18.3.0`
- `vite@^5.4.0`
- `typescript@^5.5.0`
- `tailwindcss@^3.4.0`
- `@huggingface/transformers@^3.0.0`
- `@ricky0123/vad-web@^0.0.22`
- `zustand@^4.5.0`
- `idb-keyval@^6.2.0`
- `marked@^14.0.0`
- `dompurify@^3.1.0`
- `jspdf@^2.5.0` (optional fallback)
- `workbox-window@^7.1.0`

## Out of Scope (이번 lock-in에서 제외)
- supertonic-tts 통합 세부 (G006에서 README 확인 후 결정)
- 화자 분리 모델 (G004 stretch)
- 다국어 UI (G003에서 한국어 우선)
