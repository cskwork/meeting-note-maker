import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeetingNote } from '../notes/types';
import type { TtsCapability, TtsEngine, TtsEngineId } from '../tts/types';
import { detectCapabilities, makeEngine } from '../tts/engine';
import { SupertonicTts } from '../tts/supertonic';
import { loadPrefs, savePrefs } from '../notes/prefs';
import { css, colors } from './styles';

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
  // user's last TTS engine + voice survives reload. On first visit this still
  // starts the supertonic download because that's the default.
  const initialPrefs = useState(() => loadPrefs())[0];
  const [engineId, setEngineId] = useState<TtsEngineId>(initialPrefs.ttsEngineId);
  const [voiceId, setVoiceId] = useState<string>(initialPrefs.ttsVoiceId);
  const [playing, setPlaying] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<TtsEngine | null>(null);

  const ensureEngine = useCallback(
    async (idOverride?: TtsEngineId): Promise<TtsEngine> => {
      const id = idOverride ?? engineId;
      if (engineRef.current?.id === id) return engineRef.current;
      engineRef.current?.dispose();
      const next = makeEngine(id);
      if (next instanceof SupertonicTts) {
        next.setProgress((phase, c, t) =>
          setLoadingMsg(`${phase} (${c}/${t})`),
        );
      }
      setLoadingMsg('초기화 중...');
      try {
        await next.init();
      } finally {
        setLoadingMsg(null);
      }
      engineRef.current = next;
      return next;
    },
    [engineId],
  );

  useEffect(() => {
    detectCapabilities().then(setCaps);
    // Auto-init whichever engine the user last picked (default supertonic).
    // First-time supertonic load streams ~380MB from HF and primes SW cache.
    void ensureEngine(initialPrefs.ttsEngineId).catch((e) => {
      setLoadingMsg(null);
      setError(e instanceof Error ? e.message : String(e));
    });
    return () => engineRef.current?.dispose();
    // ensureEngine intentionally not in deps — we only auto-init once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    savePrefs({ ttsEngineId: engineId });
  }, [engineId]);
  useEffect(() => {
    savePrefs({ ttsVoiceId: voiceId });
  }, [voiceId]);

  const onPlay = useCallback(async () => {
    setError(null);
    const text = plainTextOf(note);
    if (!text.trim()) {
      setError('재생할 노트 내용이 없습니다.');
      return;
    }
    try {
      const engine = await ensureEngine();
      setPlaying(true);
      await engine.speak(text, { lang: 'ko', voiceId, speed: 1.05 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlaying(false);
      setLoadingMsg(null);
    }
  }, [ensureEngine, voiceId, note]);

  const onStop = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
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
          disabled={playing || loadingMsg !== null}
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
            disabled={playing || loadingMsg !== null}
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
        disabled={
          (note.agenda.length === 0 && note.actionItems.length === 0) ||
          loadingMsg !== null
        }
      >
        {playing ? '■ 정지' : '▶ 듣기'}
      </button>
      {loadingMsg && <span style={{ color: colors.muted, fontSize: 12 }}>{loadingMsg}</span>}
      {!loadingMsg && caps.find((c) => c.id === engineId)?.reason && (
        <span style={{ color: colors.muted, fontSize: 12 }}>
          {caps.find((c) => c.id === engineId)!.reason}
        </span>
      )}
      {error && <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>}
    </div>
  );
}
