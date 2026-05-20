import type { MeetingNote, TranscriptChunk } from './types';

const NOTE_KEY = 'mnm.note.draft.v1';
const CHUNKS_KEY = 'mnm.chunks.draft.v1';

export function saveDraft(note: MeetingNote): void {
  try {
    localStorage.setItem(NOTE_KEY, JSON.stringify(note));
  } catch {
    // quota exceeded or storage disabled — silent
  }
}

export function loadDraft(): MeetingNote | null {
  try {
    const raw = localStorage.getItem(NOTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeetingNote;
    if (parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(NOTE_KEY);
    localStorage.removeItem(CHUNKS_KEY);
  } catch {
    // ignore
  }
}

export function saveChunks(chunks: TranscriptChunk[]): void {
  try {
    localStorage.setItem(CHUNKS_KEY, JSON.stringify(chunks));
  } catch {
    // ignore
  }
}

export function loadChunks(): TranscriptChunk[] {
  try {
    const raw = localStorage.getItem(CHUNKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop chunks with empty/whitespace text (legacy data from before the
    // hallucination scrub landed could leave phantom timestamp-only rows).
    return parsed.filter(
      (c) => c && typeof c.text === 'string' && c.text.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export function makeDebouncedSaver(ms = 800): (note: MeetingNote) => void {
  let timer: number | null = null;
  return (note) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => saveDraft(note), ms);
  };
}

export function makeDebouncedChunkSaver(
  ms = 1500,
): (chunks: TranscriptChunk[]) => void {
  let timer: number | null = null;
  return (chunks) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => saveChunks(chunks), ms);
  };
}
