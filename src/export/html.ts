import type { MeetingNote } from '../notes/types';

export function toHtml(note: MeetingNote, opts: { autoPrint?: boolean } = {}): string {
  const e = escapeHtml;
  const agenda = note.agenda
    .map(
      (s) => `
    <section class="agenda">
      <h3>${e(s.heading)}</h3>
      <ul>${s.bullets
        .filter((b) => b.trim())
        .map((b) => `<li>${e(b)}</li>`)
        .join('')}</ul>
    </section>`,
    )
    .join('');

  const actions = note.actionItems.length
    ? `
    <section class="actions">
      <h2>액션 아이템</h2>
      <ul class="check">
        ${note.actionItems
          .map((a) => {
            const owner = a.owner ? ` <span class="meta">담당: ${e(a.owner)}</span>` : '';
            const due = a.due ? ` <span class="meta">마감: ${e(a.due)}</span>` : '';
            return `<li><input type="checkbox" disabled />${e(a.text)}${owner}${due}</li>`;
          })
          .join('')}
      </ul>
    </section>`
    : '';

  const transcript = note.rawTranscript.length
    ? `
    <details class="transcript">
      <summary>원본 전사 (${note.rawTranscript.length}건)</summary>
      <ol>
        ${note.rawTranscript
          .map((c) => `<li><code>${formatMs(c.startMs)}</code> ${e(c.text)}</li>`)
          .join('')}
      </ol>
    </details>`
    : '';

  const attendees = note.attendees.length
    ? `<li><strong>참석자</strong>: ${note.attendees.map(e).join(', ')}</li>`
    : '';

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${e(note.title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
    max-width: 760px; margin: 32px auto; padding: 0 16px; color: #0f172a;
    line-height: 1.6;
  }
  h1 { margin: 0 0 8px; }
  h2 { margin: 32px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { margin: 16px 0 4px; color: #1e293b; }
  ul { margin: 4px 0 12px; padding-left: 22px; }
  li { margin: 2px 0; }
  .meta { color: #64748b; font-size: 13px; margin-left: 6px; }
  .actions .check { list-style: none; padding-left: 0; }
  .actions .check li { padding: 4px 0; }
  details { margin-top: 32px; }
  summary { cursor: pointer; color: #64748b; }
  details[open] > summary { margin-bottom: 8px; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  header ul { list-style: none; padding-left: 0; color: #475569; }

  /* --- Print pagination --- */
  @page {
    size: A4;
    margin: 18mm 15mm 20mm 15mm;
  }
  @media print {
    body { margin: 0; max-width: none; padding: 0; font-size: 11pt; line-height: 1.5; }
    /* Keep section headers attached to their content */
    h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
    /* Don't split individual agenda sections / action items mid-page */
    section.agenda, .actions li, header ul { break-inside: avoid; page-break-inside: avoid; }
    /* Long bullets: avoid splitting a single bullet across pages */
    ul li { break-inside: avoid; page-break-inside: avoid; }
    /* Transcript appendix starts on a new page and uses smaller type */
    details.transcript {
      break-before: page;
      page-break-before: always;
      margin-top: 0;
      font-size: 9.5pt;
      line-height: 1.4;
    }
    details.transcript[open] > summary,
    details.transcript > summary {
      display: list-item;
      font-weight: 700;
      color: #0f172a;
      list-style: none;
    }
    /* Force the appendix open in print so it shows even if collapsed on screen */
    details.transcript ol { display: block !important; }
    details.transcript ol li { break-inside: avoid; }
    /* Suppress browser-injected header/footer URL via @page; user can also
       disable "Headers and footers" in the print dialog. */
  }
</style>
</head>
<body>
<header>
  <h1>${e(note.title)}</h1>
  <ul>
    <li><strong>일자</strong>: ${e(note.date)} ${e(note.time)}</li>
    ${attendees}
  </ul>
</header>
${note.agenda.length ? `<h2>안건</h2>${agenda}` : ''}
${actions}
${transcript ? transcript.replace('<details class="transcript">', '<details class="transcript" open>') : ''}
${opts.autoPrint ? '<script>window.addEventListener("load", () => window.print());</script>' : ''}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
