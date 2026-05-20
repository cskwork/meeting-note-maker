import type {
  ActionItem,
  AgendaSection,
  MeetingNote,
  TranscriptChunk,
} from './types';
import { emptyMeetingNote } from './types';

const SECTION_GAP_MS = 30_000; // > 30s 침묵이면 새 섹션
const ACTION_PATTERNS: RegExp[] = [
  /하겠습니다[.!?]?$/u,
  /할\s?(?:게요|게)[.!?]?$/u,
  /해\s?주세요[.!?]?$/u,
  /부탁드립니다[.!?]?$/u,
  /확인\s?(?:해|하)/u,
  /담당[은는이가]/u,
  /^TODO[: ]/i,
  /액션\s?아이템/u,
  /까지\s?(?:완료|마무리|드리|보내|전달|공유)/u,
];

/**
 * Pure function: raw transcript chunks -> structured meeting note.
 * No external state, no I/O. Safe to memoize.
 */
export function structureTranscript(
  chunks: TranscriptChunk[],
  base?: Partial<MeetingNote>,
  now = new Date(),
): MeetingNote {
  const note = { ...emptyMeetingNote(now), ...base };
  note.rawTranscript = chunks;
  note.updatedAt = now.toISOString();

  if (chunks.length === 0) return note;

  // Title: first non-empty sentence trimmed to 40 chars
  const firstText = chunks.find((c) => c.text.trim())?.text.trim();
  if (firstText && (!base?.title || base.title.startsWith('회의록 '))) {
    note.title = firstText.length > 40 ? firstText.slice(0, 40) + '…' : firstText;
  }

  // Split into sections by pause > SECTION_GAP_MS
  const sections: AgendaSection[] = [];
  let current: AgendaSection | null = null;
  let prevEnd = chunks[0].startMs;

  for (const c of chunks) {
    const gap = c.startMs - prevEnd;
    if (!current || gap > SECTION_GAP_MS) {
      current = {
        id: crypto.randomUUID(),
        heading: `안건 ${sections.length + 1}`,
        bullets: [],
      };
      sections.push(current);
    }
    // Split chunk into sentences and add as bullets
    for (const s of splitSentencesKo(c.text)) {
      const t = s.trim();
      if (t) current.bullets.push(t);
    }
    prevEnd = c.endMs;
  }

  // Derive a heading per section from its first bullet (short summary)
  for (const s of sections) {
    if (s.bullets.length > 0) {
      const first = s.bullets[0];
      const concise = first.length > 30 ? first.slice(0, 30) + '…' : first;
      s.heading = concise;
    }
  }

  note.agenda = sections;

  // Extract action items across all bullets
  const actions: ActionItem[] = [];
  for (const s of sections) {
    for (const b of s.bullets) {
      if (ACTION_PATTERNS.some((re) => re.test(b))) {
        actions.push({ id: crypto.randomUUID(), text: b });
      }
    }
  }
  note.actionItems = actions;

  return note;
}

/**
 * Korean-aware sentence split.
 * Splits on 다./요./까?/요?/네. plus general .!? after non-digit.
 */
export function splitSentencesKo(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?。…]*?(?:[다요까네][.!?]|[.!?。…])\s+|[^.!?。…]+$/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  return out.length > 0 ? out : [text.trim()];
}
