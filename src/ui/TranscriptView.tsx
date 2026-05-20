import { useEffect, useMemo, useRef, useState } from 'react';
import { css, colors } from './styles';

export type TranscriptLine = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  isPartial?: boolean;
};

const WINDOW_SIZE = 200;

export function TranscriptView({ lines }: { lines: TranscriptLine[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(0, lines.length - WINDOW_SIZE);
  const visible = useMemo(
    () => (showAll || hidden === 0 ? lines : lines.slice(-WINDOW_SIZE)),
    [lines, hidden, showAll],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, lines[lines.length - 1]?.text]);

  if (lines.length === 0) {
    return (
      <div style={css.transcript}>
        <p style={css.empty}>
          모델을 로드하고 마이크를 시작하면 여기에 실시간으로 전사됩니다.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollerRef} style={{ ...css.transcript, maxHeight: '60vh', overflowY: 'auto' }}>
      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            border: `1px dashed ${colors.border}`,
            background: 'transparent',
            color: colors.muted,
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 8,
            width: '100%',
          }}
        >
          이전 {hidden}건 더 보기 (성능을 위해 최근 {WINDOW_SIZE}건만 표시 중)
        </button>
      )}
      {visible.map((l) => (
        <div key={l.id} style={css.line}>
          <span style={css.time}>{formatMs(l.startMs)}</span>
          <span style={{ ...css.text, ...(l.isPartial ? css.partial : {}) }}>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
