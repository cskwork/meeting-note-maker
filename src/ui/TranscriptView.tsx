import { useEffect, useRef } from 'react';
import { css } from './styles';

export type TranscriptLine = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  isPartial?: boolean;
};

export function TranscriptView({ lines }: { lines: TranscriptLine[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

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
      {lines.map((l) => (
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
