# Meeting Note Maker — Design (bkit PDCA Design Phase)

## 1. Architecture Overview

```
+----------------------------------------------------------+
| Browser (GitHub Pages static bundle)                     |
|                                                          |
|  +--------------------+      +-----------------------+   |
|  | UI Layer (React)   |<---->| State (Zustand)       |   |
|  |  - MicToggle       |      |  - session            |   |
|  |  - LiveTranscript  |      |  - transcript chunks  |   |
|  |  - NotesEditor     |      |  - structured notes   |   |
|  |  - ExportBar       |      +-----------+-----------+   |
|  |  - TtsPlayButton   |                  |               |
|  +---------+----------+                  |               |
|            |                             v               |
|  +---------v-----------+    +------------------------+   |
|  | Mic Capture + VAD   |    | Notes Structurer       |   |
|  | (Web Audio API)     |    | (rule-based formatter) |   |
|  +---------+-----------+    +-----------+------------+   |
|            | PCM 16k                    |                |
|  +---------v-----------+                |                |
|  | STT Worker          |<---------------+                |
|  | transformers.js     |                                 |
|  |  Moonshine Korean   |    +------------------------+   |
|  |  (WASM CPU)         |--->| Export Pipeline        |   |
|  +---------------------+    |  - HTML (template)     |   |
|                             |  - Markdown (marked)   |   |
|                             |  - PDF (jsPDF/print)   |   |
|                             +------------------------+   |
|  +---------------------+                                 |
|  | TTS Worker          |                                 |
|  | supertonic-tts      |                                 |
|  | (WebGPU)            |                                 |
|  +---------------------+                                 |
|                                                          |
|  +---------------------+                                 |
|  | Persistence         |                                 |
|  |  - IndexedDB (idb)  |   models, notes, sessions       |
|  |  - localStorage     |   editor drafts                 |
|  +---------------------+                                 |
+----------------------------------------------------------+
```

모든 처리는 브라우저 안에서 끝난다. 모델 다운로드만 외부 (HuggingFace CDN
+ supertonic-tts release asset) → 이후에는 네트워크 호출 없음.

## 2. Module Boundaries
| Module | Responsibility | Test Boundary |
|--------|----------------|---------------|
| `mic` | getUserMedia, PCM 16kHz mono 스트림 + VAD 이벤트 | unit (mocked AudioContext) |
| `stt` | Web Worker가 transformers.js Moonshine Korean WASM 호출, partial/final 결과 emit | unit (worker contract) + integration (real audio fixture) |
| `notes` | raw transcript → 구조화된 MeetingNote 객체 변환 | unit (pure function) |
| `editor` | React 컨트롤드 컴포넌트, localStorage 저장 | component test |
| `export` | MeetingNote → HTML/MD/PDF 변환 + Blob 다운로드 | unit (snapshot) |
| `tts` | supertonic-tts 모델 로드 + 텍스트 → 오디오 재생 | manual (WebGPU 필요) |
| `pwa` | manifest, service worker (workbox), 모델 캐시 | manual + Lighthouse |

## 3. Data Model

```ts
type TranscriptChunk = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  isFinal: boolean;
  speaker?: string; // 향후 화자 분리용
};

type MeetingNote = {
  id: string;
  title: string;
  date: string; // ISO
  attendees: string[];
  agenda: { heading: string; bullets: string[] }[];
  actionItems: { owner?: string; text: string; due?: string }[];
  rawTranscript: TranscriptChunk[];
  updatedAt: string;
};
```

## 4. STT Pipeline (G002 상세)
1. `getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })`
2. AudioWorkletNode → 16kHz PCM Float32 chunk emit (예: 250ms 단위)
3. VAD (간단한 RMS 임계값 + hangover) → speech segment 경계 결정
4. 말이 계속 이어지면 10초마다 rolling segment 전송
   - VAD silence가 없어도 `onFrameProcessed` frame을 모아 강제 flush
   - 경계 단어 누락을 줄이기 위해 다음 segment에 300ms overlap 유지
5. STT Worker로 segment 전송
6. Worker 내부: `pipeline('automatic-speech-recognition', model)` 호출
   - `model`: `onnx-community/moonshine-tiny-ko-ONNX` only
   - `device`: `'wasm'` CPU
   - `language`: `'ko'` 기본, UI에서 변경 가능
   - `return_timestamps: 'word'`
7. final은 각 rolling segment 또는 speech end마다 emit

## 5. UI Layout
- 데스크탑: 2단 그리드 (좌: live transcript, 우: structured notes editor)
- 모바일: 단일 컬럼 + 하단 sticky 마이크 토글 + 상단 status bar
- Tailwind CSS, prefers-color-scheme 다크모드 자동 지원

## 6. Export 사양
- **HTML**: 자기 완결 (inline CSS), 인쇄 가능
- **Markdown**: GFM 호환, 제목 → `#`, 안건 → `##`, 액션 아이템 → `- [ ]`
- **PDF**: 1차 — 브라우저 `window.print()` + print stylesheet, 2차 — jsPDF로
  비-브라우저 환경 대비. 한글 폰트는 Noto Sans KR 임베드.

## 7. TTS 사양 (G006)
- `cskwork/supertonic-tts` 릴리스 에셋 (ONNX) 직접 fetch + IndexedDB 캐시
- Worker에서 텍스트 → 오디오 버퍼 생성 후 `AudioBufferSourceNode`로 재생
- WebGPU 미지원: Web Speech API `speechSynthesis` 한국어 보이스 폴백

## 8. Security / Privacy
- 마이크 권한 외 어떤 권한도 요청하지 않음
- 첫 진입 시 명시적 동의 모달: "오디오는 브라우저 안에서만 처리되며 전송되지
  않습니다."
- 외부 호출 (모델 다운로드)는 명시적 사용자 액션 후에만
- CSP 헤더는 GitHub Pages에서 적용 불가 → `<meta http-equiv="Content-Security-Policy">`로 보완

## 9. Performance Budget
| Metric | Budget |
|--------|--------|
| First contentful paint | < 2s (1차 진입, no model) |
| Model load (moonshine-tiny-ko) | < 30s on 50Mbps |
| STT partial latency | < 1s on M1 MacBook |
| Bundle JS gzip | < 500KB (모델 제외) |
| Lighthouse PWA | ≥ 90 |

## 10. Open Questions (G002에서 확정)
- Moonshine WASM CPU가 목표 기기에서 충분한 실시간성을 내는지 확인
- VAD: 자체 RMS 휴리스틱 vs `@ricky0123/vad-web` 라이브러리?
- 화자 분리: G004에서 간단한 turn-taking 휴리스틱만 (긴 침묵 기준) → 향후 모델 검토
