import { css, statusColor } from './styles';
import type { SttStatus } from '../stt/types';

export function StatusPill({ status, message }: { status: SttStatus; message?: string }) {
  return (
    <span style={css.pill}>
      <span style={css.dot(statusColor(status))} />
      <strong>{labelOf(status)}</strong>
      {message ? <span style={{ color: '#64748b' }}>· {message}</span> : null}
    </span>
  );
}

function labelOf(s: SttStatus): string {
  switch (s) {
    case 'idle':
      return '대기';
    case 'loading':
      return '모델 로딩';
    case 'ready':
      return '준비됨';
    case 'listening':
      return '듣는 중';
    case 'processing':
      return '인식 중';
    case 'error':
      return '오류';
  }
}
