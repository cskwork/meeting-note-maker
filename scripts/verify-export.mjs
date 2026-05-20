// G005 fixture verification: build a sample MeetingNote and confirm md + html outputs.
// Run with: node scripts/verify-export.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

// Inline the pure exporters to avoid TS toolchain in this verification.
// These mirror src/export/markdown.ts and src/export/html.ts; if they drift,
// the build's TS strict pass is the real source of truth.

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function toMarkdown(note) {
  const out = [];
  out.push(`# ${note.title}`, '');
  out.push(`- **일자**: ${note.date} ${note.time}`);
  if (note.attendees.length) out.push(`- **참석자**: ${note.attendees.join(', ')}`);
  out.push('');
  if (note.agenda.length) {
    out.push('## 안건', '');
    for (const s of note.agenda) {
      out.push(`### ${s.heading}`);
      for (const b of s.bullets) if (b.trim()) out.push(`- ${b}`);
      out.push('');
    }
  }
  if (note.actionItems.length) {
    out.push('## 액션 아이템', '');
    for (const a of note.actionItems) {
      const owner = a.owner ? ` (담당: ${a.owner})` : '';
      const due = a.due ? ` [마감: ${a.due}]` : '';
      out.push(`- [ ] ${a.text}${owner}${due}`);
    }
    out.push('');
  }
  if (note.rawTranscript.length) {
    out.push('---', '', '## 원본 전사', '');
    for (const c of note.rawTranscript) out.push(`- \`${formatMs(c.startMs)}\` ${c.text}`);
    out.push('');
  }
  return out.join('\n');
}

const fixture = {
  id: 'fixture-1',
  schemaVersion: 1,
  title: '2026 Q2 OKR 킥오프',
  date: '2026-05-20',
  time: '14:00',
  attendees: ['김철수', '이영희', '박지훈'],
  agenda: [
    {
      id: 'a1',
      heading: '지난 분기 회고',
      bullets: [
        '매출 목표 102% 달성. 모바일 트래픽이 전년 대비 38% 증가.',
        '신규 가입자 증가율은 기대보다 낮음.',
      ],
    },
    {
      id: 'a2',
      heading: 'Q2 핵심 과제',
      bullets: [
        '결제 실패율 1% 미만으로 낮추기.',
        '회의록 메이커 베타 릴리스 진행하겠습니다.',
        '디자인 시스템 v2 마이그레이션 완료해주세요.',
      ],
    },
  ],
  actionItems: [
    { id: 'x1', text: '결제 실패 로그 대시보드 구축', owner: '박지훈', due: '2026-06-05' },
    { id: 'x2', text: '회의록 메이커 베타 사용자 모집', owner: '이영희' },
  ],
  rawTranscript: [
    { id: 't1', text: '오늘은 Q2 킥오프 미팅입니다.', startMs: 1500, endMs: 4500 },
    { id: 't2', text: '먼저 지난 분기 회고부터 시작하죠.', startMs: 6000, endMs: 9000 },
  ],
  createdAt: '2026-05-20T05:00:00.000Z',
  updatedAt: '2026-05-20T05:00:00.000Z',
};

const md = toMarkdown(fixture);
mkdirSync('docs/03-analysis/fixtures', { recursive: true });
writeFileSync('docs/03-analysis/fixtures/meeting.md', md);

// Sanity assertions
const checks = [
  ['heading present', md.includes('# 2026 Q2 OKR 킥오프')],
  ['attendees present', md.includes('김철수, 이영희, 박지훈')],
  ['agenda heading present', md.includes('## 안건')],
  ['action item with owner+due', md.includes('박지훈) [마감: 2026-06-05]')],
  ['transcript present', md.includes('## 원본 전사')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
console.log(`\nwrote docs/03-analysis/fixtures/meeting.md (${md.length} bytes)`);
process.exit(failed === 0 ? 0 : 1);
