# Meeting Note Maker — Plan (bkit PDCA Plan Phase)

> bkit Trust Level: L2 (default) · Methodology: PDCA per feature · Pipeline: 9-phase
> See `.omc/ultragoal/brief.md` for the originating brief and `goals.json` for the
> 8-story ultragoal plan that orchestrates this PDCA cycle.

## 1. Problem Statement
회사 내부 회의에서 음성을 **클라우드로 보내지 않고** 브라우저 안에서 한국어로
실시간 전사하고, 자동으로 회의록 형태로 정돈하여 HTML / Markdown / PDF로
내보내며, 필요하면 다시 음성으로 들을 수 있는 도구가 필요하다. 기존 SaaS는
프라이버시 우려, 비용, 인터넷 의존성이라는 세 가지 제약이 있다.

## 2. Goals (measurable)
| ID | Goal | Acceptance |
|----|------|------------|
| P1 | 브라우저 내 한국어 STT 실시간 동작 | 최신 MacBook Chrome에서 부분 결과 latency < 1s |
| P2 | 모바일 화면 실시간 전사 표시 | iPhone Safari에서 가로/세로 모두 정상 렌더 |
| P3 | 회의록 자동 구조화 | 제목 / 일시 / 안건 / 액션아이템 4 섹션이 항상 생성 |
| P4 | HTML / MD / PDF export | 3가지 포맷 모두 다운로드 가능 + 구조 보존 |
| P5 | TTS 재생 (supertonic-tts) | 저장된 노트를 한 버튼으로 재생, WebGPU 미지원시 폴백 |
| P6 | GitHub Pages 정적 호스팅 | gh-pages 브랜치 자동 배포, PWA 설치 가능 |
| P7 | 완전 로컬 처리 | 네트워크 탭에 STT/TTS 관련 요청 0건 (모델 다운로드 후) |

## 3. Non-goals (initial release)
- 다중 사용자 실시간 동시 편집
- 서버 사이드 계정 / 인증 / 저장
- 화자 분리 고급 기능 (간단한 휴리스틱만 허용)
- 번역, 요약 LLM 호출 (전부 로컬, 옵션으로만 향후 검토)

## 4. Stakeholders
- **Primary user**: 기업의 회의 진행자 / 서기 (한국어 회의)
- **Owner**: Danny (`platformdev03@dong-a.com`)
- **Reviewers**: bkit code-analyzer, design-validator, gap-detector

## 5. Constraints
- 정적 사이트 1개 번들로 GitHub Pages에서 동작해야 함
- 마이크 권한 외에는 어떤 권한도 요구하지 않음
- 첫 진입 시 모델 다운로드 1회 (≤ 500MB 목표), 이후 IndexedDB 캐시 사용
- WebGPU 미지원 브라우저는 WASM 폴백 (느려도 동작)

## 6. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Whisper Korean 정확도 부족 | High | 기본 모델 `whisper-base`, 옵션으로 `whisper-large-v3-turbo` 다운로드 |
| WebGPU 안정성 (특히 Safari) | High | feature detection + WASM 폴백 경로 필수 |
| 모델 번들 크기 | Medium | CDN(HuggingFace)에서 lazy fetch + IndexedDB 캐시 |
| GitHub Pages SPA 라우팅 | Low | hash router 사용 또는 단일 페이지 구조 |
| 모바일 백그라운드 마이크 | Medium | 화면 켜둠 권장 + wake lock API 시도 |

## 7. Phased Delivery (matches ultragoal stories)
1. **G001 Foundation** — Plan/Design docs + tech stack lock (this doc) ← 현재
2. **G002 STT Engine** — Whisper WebGPU + mic + VAD
3. **G003 Live Transcript UI** — Responsive streaming view
4. **G004 Notes Structuring** — Auto-format + editor
5. **G005 Export Pipeline** — HTML / MD / PDF
6. **G006 TTS Playback** — supertonic-tts integration
7. **G007 GitHub Pages Deploy** — PWA + Actions
8. **G008 Final QA & Release** — bkit gates + report

## 8. Success Criteria (Definition of Done)
- 모든 P1~P7 acceptance 충족
- bkit gap-detector matchRate ≥ 90%
- bkit code-analyzer CRITICAL/HIGH 0건
- Zero Script QA: 실제 마이크 테스트 통과 (Chrome macOS + Safari iOS)
- Lighthouse PWA ≥ 90
- README에 배포 URL 명시
