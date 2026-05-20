import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeetingNote } from '../notes/types';
import type { TtsCapability, TtsEngine, TtsEngineId } from '../tts/types';
import { detectCapabilities, makeEngine } from '../tts/engine';
import { SupertonicTts, type SupertonicProgressDetail } from '../tts/supertonic';
import { loadPrefs, savePrefs } from '../notes/prefs';
import { css, colors } from './styles';

type LoadingState = {
  message: string;
  percent: number | null;
  detail?: string;
};

function plainTextOf(note: MeetingNote): string {
  const parts: string[] = [note.title];
  for (const s of note.agenda) {
    parts.push(s.heading);
    for (const b of s.bullets) if (b.trim()) parts.push(b);
  }
  if (note.actionItems.length > 0) {
    parts.push('액션 아이템.');
    for (const a of note.actionItems) parts.push(a.text);
  }
  return parts.join('. ').replace(/[#*_`]/g, '');
}

export function PlayButton({ note }: { note: MeetingNote }) {
  const [caps, setCaps] = useState<TtsCapability[]>([]);
  // Defaults come from persisted prefs (falls back to supertonic + F1) so the
  // user's last TTS engine + voice survives reload without eager model loading.
  const initialPrefs = useState(() => loadPrefs())[0];
  const [engineId, setEngineId] = useState<TtsEngineId>(initialPrefs.ttsEngineId);
  const [voiceId, setVoiceId] = useState<string>(initialPrefs.ttsVoiceId);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState<LoadingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<TtsEngine | null>(null);
  const playRunRef = useRef(0);

  const ensureEngine = useCallback(
    async (idOverride?: TtsEngineId, runId = playRunRef.current): Promise<TtsEngine> => {
      const id = idOverride ?? engineId;
      if (engineRef.current?.id === id) return engineRef.current;
      engineRef.current?.dispose();
      const next = makeEngine(id);
      engineRef.current = next;
      if (next instanceof SupertonicTts) {
        next.setProgress((phase, c, t, detail) => {
          if (playRunRef.current === runId) setLoading(formatTtsProgress(phase, c, t, detail));
        });
      }
      if (playRunRef.current === runId) setLoading({ message: '초기화 중...', percent: null });
      try {
        await next.init();
      } finally {
        if (playRunRef.current === runId) setLoading(null);
      }
      return next;
    },
    [engineId],
  );

  useEffect(() => {
    detectCapabilities().then(setCaps);
    return () => engineRef.current?.dispose();
  }, []);

  useEffect(() => {
    savePrefs({ ttsEngineId: engineId });
  }, [engineId]);
  useEffect(() => {
    savePrefs({ ttsVoiceId: voiceId });
  }, [voiceId]);

  const onPlay = useCallback(async () => {
    setError(null);
    setLoading(null);
    const text = plainTextOf(note);
    if (!text.trim()) {
      setError('재생할 노트 내용이 없습니다.');
      return;
    }
    const runId = playRunRef.current + 1;
    playRunRef.current = runId;
    setPlaying(true);
    try {
      const engine = await ensureEngine(undefined, runId);
      if (playRunRef.current !== runId) return;
      await engine.speak(text, { lang: 'ko', voiceId, speed: 1.05 });
    } catch (e) {
      if (playRunRef.current === runId) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (playRunRef.current === runId) {
        setPlaying(false);
        setLoading(null);
      }
    }
  }, [ensureEngine, voiceId, note]);

  const onStop = useCallback(() => {
    playRunRef.current += 1;
    if (engineRef.current instanceof SupertonicTts) engineRef.current.setProgress(null);
    engineRef.current?.dispose();
    engineRef.current = null;
    setPlaying(false);
    setLoading(null);
  }, []);

  const showVoices = engineId === 'supertonic';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={css.field}>
        TTS 엔진
        <select
          style={css.select}
          value={engineId}
          onChange={(e) => setEngineId(e.target.value as TtsEngineId)}
          disabled={playing}
        >
          {caps.map((c) => (
            <option key={c.id} value={c.id} disabled={!c.available}>
              {c.id === 'webspeech' ? 'Web Speech (브라우저 내장)' : 'supertonic-tts (고품질)'}
              {c.available ? '' : ' — 사용 불가'}
            </option>
          ))}
        </select>
      </label>
      {showVoices && (
        <label style={css.field}>
          보이스
          <select
            style={css.select}
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={playing}
          >
            <option value="F1">Mina (여)</option>
            <option value="F2">Sora (여)</option>
            <option value="F3">Yuna (여)</option>
            <option value="M1">Aiden (남)</option>
            <option value="M2">Hiro (남)</option>
            <option value="M3">Leo (남)</option>
          </select>
        </label>
      )}
      <button
        style={{ ...css.button, ...(playing ? {} : css.primary) }}
        onClick={playing ? onStop : onPlay}
      >
        {playing ? '■ 멈춤' : '▶ 듣기'}
      </button>
      {playing && loading && (
        <div style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: colors.muted, fontSize: 12 }}>{loading.message}</span>
          <div
            aria-label="TTS 모델 다운로드 진행률"
            style={{
              width: 240,
              height: 6,
              borderRadius: 999,
              overflow: 'hidden',
              background: '#e5e7eb',
            }}
          >
            <div
              style={{
                width: `${loading.percent ?? 8}%`,
                minWidth: loading.percent === null ? 24 : 0,
                height: '100%',
                borderRadius: 999,
                background: colors.brand,
                transition: 'width 160ms ease',
              }}
            />
          </div>
          {loading.detail && <span style={{ color: colors.muted, fontSize: 11 }}>{loading.detail}</span>}
        </div>
      )}
      {!loading && caps.find((c) => c.id === engineId)?.reason && (
        <span style={{ color: colors.muted, fontSize: 12 }}>
          {caps.find((c) => c.id === engineId)!.reason}
        </span>
      )}
      {error && <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>}
    </div>
  );
}

function formatTtsProgress(
  phase: string,
  current: number,
  total: number,
  detail?: SupertonicProgressDetail,
): LoadingState {
  const filePercent = detail?.progress;
  const completedFiles = Math.max(0, current - 1);
  const overallPercent =
    filePercent === null || filePercent === undefined
      ? (current / total) * 100
      : ((completedFiles + filePercent / 100) / total) * 100;
  const roundedOverall = clampPercent(overallPercent);
  const fileSuffix =
    typeof filePercent === 'number' ? `, 현재 파일 ${Math.round(filePercent)}%` : '';

  return {
    message: `${phase} (${current}/${total}, 전체 ${roundedOverall}%${fileSuffix})`,
    percent: roundedOverall,
    detail:
      detail && detail.totalBytes > 0
        ? `${formatBytes(detail.loadedBytes)} / ${formatBytes(detail.totalBytes)}`
        : '파일 크기 확인 중...',
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
