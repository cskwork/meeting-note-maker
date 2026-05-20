# meeting-note-maker

브라우저 안에서 끝나는 한국어 회의록 메이커. 마이크로 말하면 실시간으로
한국어를 받아쓰고, 자동으로 회의록 형식으로 정리하여 HTML / Markdown / PDF
로 내보내며, 필요하면 다시 음성으로 들을 수 있다. **오디오는 절대 서버로
전송되지 않는다.**

## Why
사내 회의록을 위해 SaaS STT에 음성을 보내는 것이 곤란한 환경 (보안·프라이
버시 우려)에서 사용한다. WebGPU + Whisper를 이용해 브라우저 안에서 직접
한국어를 받아쓰고, 결과물을 표준 포맷으로 내보낸다. 하나의 정적 사이트로
GitHub Pages에 배포되어 어디서든 켤 수 있다.

## Status
**Foundation 단계 (G001)**: bkit PDCA Plan/Design 문서 작성 + 기술 스택 lock.
실제 구현은 G002부터 시작. ultragoal 전체 플랜: `.omc/ultragoal/goals.json`.

## Docs
- [Plan](./docs/01-plan/plan.md)
- [Design](./docs/02-design/design.md)
- [Tech Stack Rationale](./docs/02-design/tech-stack.md)
- [Ultragoal Brief](./.omc/ultragoal/brief.md)

## Tech Stack
Vite + React 18 + TypeScript + Tailwind · `@huggingface/transformers` v3
(Whisper + WebGPU) · `@ricky0123/vad-web` · `cskwork/supertonic-tts` ·
IndexedDB · GitHub Pages + Actions · PWA.

## Deployment
1. GitHub 저장소에 push.
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. `main` 브랜치 push 시 `.github/workflows/deploy.yml`이 자동으로 빌드 + 배포.
4. 라이브 URL: `https://<owner>.github.io/<repo>/` (예: `https://danny.github.io/meeting-note-maker/`).

워크플로우는 `VITE_BASE=/<repo>/`를 주입하므로 모든 상대 경로가 Pages 하위경로에서
정상 동작한다. 모델 파일은 빌드 산출물에 포함되지 않고 HuggingFace CDN에서 런타임에
스트리밍되며, 서비스 워커가 두 번째 진입부터 캐시 적중을 만들어준다.

## Local Dev
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit + vite build → dist/
npm run preview  # serves dist/ on http://localhost:4173
```

## License
TBD (G008에서 결정)
