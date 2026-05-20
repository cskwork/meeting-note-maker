import type { MeetingNote } from './types';

const KEY = 'mnm.note.draft.v1';

export function saveDraft(note: MeetingNote): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    // quota exceeded or storage disabled — silent
  }
}

export function loadDraft(): MeetingNote | null {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function makeDebouncedSaver(ms = 800): (note: MeetingNote) => void {
  let timer: number | null = null;
  return (note) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => saveDraft(note), ms);
  };
}
