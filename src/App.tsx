import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MicCapture } from './audio/mic';
import { SttEngine } from './stt/stt';
import type { SttLanguage, SttModelId, SttResult, SttStatus } from './stt/types';
import { css, colors } from './ui/styles';
import { StatusPill } from './ui/StatusPill';
import { TranscriptView, type TranscriptLine } from './ui/TranscriptView';
import { NotesEditor } from './ui/NotesEditor';
import { ExportBar } from './ui/ExportBar';
import { PlayButton } from './ui/PlayButton';
import { WakeLockHolder } from './ui/wakeLock';
import { structureTranscript } from './notes/structurer';
import { emptyMeetingNote, type MeetingNote, type TranscriptChunk } from './notes/types';
import {
  clearDraft,
  loadChunks,
  loadDraft,
  makeDebouncedChunkSaver,
  makeDebouncedSaver,
} from './notes/storage';

const MODELS: { id: SttModelId; label: string; size: string }[] = [
  { id: 'Xenova/whisper-base', label: 'whisper-base (빠름)', size: '~80MB' },
  { id: 'Xenova/whisper-small', label: 'whisper-small (균형)', size: '~250MB' },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    label: 'whisper-large-v3-turbo (정확도)',
    size: '~800MB · WebGPU 권장',
  },
];

const LANGUAGES: { id: SttLanguage; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'auto', label: '자동 감지' },
];

type Tab = 'transcript' | 'notes';

export function App() {
  const [modelId, setModelId] = useState<SttModelId>('Xenova/whisper-base');
  const [language, setLanguage] = useState<SttLanguage>('ko');
  const [status, setStatus] = useState<SttStatus>('idle');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [chunks, setChunks] = useState<TranscriptChunk[]>(() => loadChunks());
  const [partialLine, setPartialLine] = useState<TranscriptLine | null>(null);
  const [note, setNote] = useState<MeetingNote>(() => loadDraft() ?? emptyMeetingNote());
  const [tab, setTab] = useState<Tab>('transcript');
  const [error, setError] = useState<string | null>(null);
  const [micRunning, setMicRunning] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const sttRef = useRef<SttEngine | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const wakeLockRef = useRef<WakeLockHolder>(new WakeLockHolder());
  const saveDraft = useMemo(() => makeDebouncedSaver(800), []);
  const saveChunkDraft = useMemo(() => makeDebouncedChunkSaver(1500), []);

  useEffect(() => saveDraft(note), [note, saveDraft]);
  useEffect(() => saveChunkDraft(chunks), [chunks, saveChunkDraft]);
  // Propagate language changes to an already-loaded STT worker immediately.
  useEffect(() => {
    sttRef.current?.setLanguage(language);
  }, [language]);

  useEffect(() => {
    return () => {
      void micRef.current?.stop();
      sttRef.current?.dispose();
    };
  }, []);

  const handleStt = useCallback((r: SttResult) => {
    if (r.type === 'status') {
      setStatus(r.status);
      setStatusMsg(r.message ?? '');
      if (r.status === 'ready') setModelLoaded(true);
    } else if (r.type === 'final') {
      setChunks((prev) => [
        ...prev,
        { id: r.chunkId, text: r.text, startMs: r.startMs, endMs: r.endMs },
      ]);
      setPartialLine(null);
    } else if (r.type === 'partial') {
      setPartialLine({ id: r.chunkId, text: r.text, startMs: 0, endMs: 0, isPartial: true });
    } else if (r.type === 'error') {
      setError(r.error);
    }
  }, []);

  const onLoadModel = useCallback(async () => {
    setError(null);
    setModelLoaded(false);
    try {
      sttRef.current?.dispose();
      sttRef.current = new SttEngine();
      sttRef.current.on(handleStt);
      await sttRef.current.load(modelId, language);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [modelId, language, handleStt]);

  const stopMic = useCallback(async () => {
    await micRef.current?.stop();
    micRef.current = null;
    void wakeLockRef.current.release();
    setMicRunning(false);
    setStatus('ready');
  }, []);

  const onToggleMic = useCallback(async () => {
    setError(null);
    if (!sttRef.current || !modelLoaded) {
      setError('먼저 "모델 로드"를 눌러 STT 모델을 불러오세요.');
      return;
    }
    if (micRef.current?.running) {
      await stopMic();
      return;
    }
    const mic = new MicCapture();
    try {
      await mic.start({
        onSpeechStart: () => setStatus('listening'),
        onSpeechEnd: (chunk) => {
          sttRef.current?.transcribe(
            crypto.randomUUID(),
            chunk.pcm,
            chunk.sampleRate,
            chunk.startMs,
            chunk.endMs,
          );
        },
        onError: (e) => setError(e.message),
      });
      micRef.current = mic;
      void wakeLockRef.current.acquire();
      setMicRunning(true);
      setStatus('listening');
    } catch (e) {
      setError(
        e instanceof Error
          ? `마이크 시작 실패: ${e.message}. iOS Safari는 HTTPS와 사용자 탭이 필요합니다.`
          : String(e),
      );
    }
  }, [modelLoaded, stopMic]);

  const onStructure = useCallback(() => {
    setNote((prev) =>
      structureTranscript(chunks, {
        id: prev.id,
        createdAt: prev.createdAt,
        attendees: prev.attendees,
      }),
    );
    setTab('notes');
  }, [chunks]);

  const onReset = useCallback(async () => {
    const hasContent =
      chunks.length > 0 ||
      note.agenda.length > 0 ||
      note.actionItems.length > 0 ||
      note.attendees.length > 0 ||
      (note.title && !note.title.startsWith('회의록 '));
    if (hasContent) {
      const ok = window.confirm(
        '회의록과 실시간 전사 내용을 모두 삭제합니다.\n' +
          '저장된 초안(localStorage)도 함께 지워집니다.\n\n' +
          '계속하시겠습니까?',
      );
      if (!ok) return;
    }
    if (micRef.current?.running) await stopMic();
    setChunks([]);
    setPartialLine(null);
    setError(null);
    clearDraft();
    setNote(emptyMeetingNote());
  }, [chunks.length, note.agenda.length, note.actionItems.length, note.attendees.length, note.title, stopMic]);

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    const final = chunks.map((c) => ({
      id: c.id,
      text: c.text,
      startMs: c.startMs,
      endMs: c.endMs,
    }));
    return partialLine ? [...final, partialLine] : final;
  }, [chunks, partialLine]);

  const controlsDisabled = status === 'loading';
  const micButtonStyle = useMemo(
    () => ({
      ...css.stickyBtn,
      background: micRunning ? '#dc2626' : '#0f172a',
      color: '#fff',
    }),
    [micRunning],
  );

  return (
    <div style={css.app}>
      <main style={css.shell}>
        <header style={css.header}>
          <h1 style={css.h1}>회의록 메이커</h1>
          <p style={css.tagline}>
            오디오는 브라우저 안에서만 처리됩니다. 서버로 전송되지 않습니다.
          </p>
        </header>

        <section style={css.controlBar}>
          <label style={css.field}>
            모델
            <select
              style={css.select}
              value={modelId}
              onChange={(e) => setModelId(e.target.value as SttModelId)}
              disabled={controlsDisabled || micRunning}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.size}
                </option>
              ))}
            </select>
          </label>
          <label style={css.field}>
            언어
            <select
              style={css.select}
              value={language}
              onChange={(e) => setLanguage(e.target.value as SttLanguage)}
              disabled={controlsDisabled || micRunning}
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            style={{ ...css.button, ...css.primary }}
            onClick={onLoadModel}
            disabled={controlsDisabled || micRunning}
          >
            모델 로드
          </button>
          <button style={css.button} onClick={onStructure} disabled={chunks.length === 0}>
            전사 → 노트로 정리
          </button>
          <button
            style={{ ...css.button, ...(chunks.length > 0 || note.agenda.length > 0 ? css.danger : {}) }}
            onClick={onReset}
            disabled={chunks.length === 0 && !micRunning && note.agenda.length === 0}
            title="실시간 전사 + 회의록 + localStorage 초안을 모두 삭제"
          >
            회의록 전체 초기화
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <StatusPill status={status} message={statusMsg} />
          </div>
        </section>

        {error && <div style={css.errorBar}>{error}</div>}

        <div style={tabsStyles.bar} role="tablist" aria-label="보기 모드">
          <button
            role="tab"
            aria-selected={tab === 'transcript'}
            style={tab === 'transcript' ? { ...tabsStyles.tab, ...tabsStyles.active } : tabsStyles.tab}
            onClick={() => setTab('transcript')}
          >
            실시간 전사
          </button>
          <button
            role="tab"
            aria-selected={tab === 'notes'}
            style={tab === 'notes' ? { ...tabsStyles.tab, ...tabsStyles.active } : tabsStyles.tab}
            onClick={() => setTab('notes')}
          >
            회의록
          </button>
        </div>

        {tab === 'transcript' ? (
          <TranscriptView lines={transcriptLines} />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <ExportBar note={note} />
              <PlayButton note={note} />
            </div>
            <NotesEditor note={note} onChange={setNote} />
          </>
        )}
      </main>

      <div style={css.stickyBar}>
        <button
          style={micButtonStyle}
          onClick={onToggleMic}
          disabled={controlsDisabled || !modelLoaded}
          aria-label={micRunning ? '마이크 정지' : '마이크 시작'}
        >
          {micRunning ? '● 녹음 정지' : '● 마이크 시작'}
        </button>
      </div>
    </div>
  );
}

const tabsStyles = {
  bar: {
    display: 'flex',
    gap: 4,
    padding: 4,
    background: colors.accentBg,
    borderRadius: 10,
    marginBottom: 12,
    width: 'fit-content',
  } as const,
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: colors.muted,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  } as const,
  active: {
    background: colors.surface,
    color: colors.text,
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  } as const,
};
