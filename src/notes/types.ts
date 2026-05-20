export type TranscriptChunk = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
};

export type AgendaSection = {
  id: string;
  heading: string;
  bullets: string[];
};

export type ActionItem = {
  id: string;
  text: string;
  owner?: string;
  due?: string;
};

export type MeetingNote = {
  id: string;
  schemaVersion: 1;
  title: string;
  date: string; // ISO yyyy-mm-dd
  time: string; // HH:mm
  attendees: string[];
  agenda: AgendaSection[];
  actionItems: ActionItem[];
  rawTranscript: TranscriptChunk[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export function emptyMeetingNote(now = new Date()): MeetingNote {
  const iso = now.toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    title: `회의록 ${iso.slice(0, 10)}`,
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    attendees: [],
    agenda: [],
    actionItems: [],
    rawTranscript: [],
    createdAt: iso,
    updatedAt: iso,
  };
}
