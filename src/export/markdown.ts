import type { MeetingNote } from '../notes/types';

export function toMarkdown(note: MeetingNote): string {
  const lines: string[] = [];
  lines.push(`# ${note.title}`);
  lines.push('');
  lines.push(`- **일자**: ${note.date} ${note.time}`);
  if (note.attendees.length > 0) {
    lines.push(`- **참석자**: ${note.attendees.join(', ')}`);
  }
  lines.push('');

  if (note.agenda.length > 0) {
    lines.push('## 안건');
    lines.push('');
    for (const s of note.agenda) {
      lines.push(`### ${s.heading}`);
      for (const b of s.bullets) {
        if (b.trim()) lines.push(`- ${b}`);
      }
      lines.push('');
    }
  }

  if (note.actionItems.length > 0) {
    lines.push('## 액션 아이템');
    lines.push('');
    for (const a of note.actionItems) {
      const owner = a.owner ? ` (담당: ${a.owner})` : '';
      const due = a.due ? ` [마감: ${a.due}]` : '';
      lines.push(`- [ ] ${a.text}${owner}${due}`);
    }
    lines.push('');
  }

  if (note.rawTranscript.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 원본 전사');
    lines.push('');
    for (const c of note.rawTranscript) {
      const t = formatMs(c.startMs);
      lines.push(`- \`${t}\` ${c.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
