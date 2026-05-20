import type { CSSProperties } from 'react';

export const colors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  brand: '#0f172a',
  brandText: '#ffffff',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerText: '#991b1b',
  accentBg: '#f1f5f9',
};

export const css = {
  app: {
    minHeight: '100dvh',
    background: colors.bg,
    color: colors.text,
    fontFamily:
      'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
  } satisfies CSSProperties,
  shell: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '20px 16px 120px',
  } satisfies CSSProperties,
  header: { marginBottom: 12 } satisfies CSSProperties,
  h1: { margin: 0, fontSize: 24, fontWeight: 700 } satisfies CSSProperties,
  tagline: { margin: '4px 0 0', color: colors.muted, fontSize: 13 } satisfies CSSProperties,
  controlBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '12px',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  } satisfies CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    color: colors.muted,
  } satisfies CSSProperties,
  select: {
    padding: '8px 10px',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: colors.surface,
    color: colors.text,
    fontSize: 14,
    minWidth: 180,
  } satisfies CSSProperties,
  button: {
    padding: '10px 14px',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    background: colors.surface,
    color: colors.text,
    fontSize: 14,
    cursor: 'pointer',
  } satisfies CSSProperties,
  primary: {
    background: colors.brand,
    color: colors.brandText,
    border: `1px solid ${colors.brand}`,
  } satisfies CSSProperties,
  danger: {
    background: colors.danger,
    color: colors.brandText,
    border: `1px solid ${colors.danger}`,
  } satisfies CSSProperties,
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    background: colors.accentBg,
    color: colors.text,
    fontSize: 12,
  } satisfies CSSProperties,
  dot: (color: string): CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: color,
  }),
  errorBar: {
    padding: '10px 12px',
    background: colors.dangerBg,
    color: colors.dangerText,
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 12,
  } satisfies CSSProperties,
  transcript: {
    padding: 16,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    background: colors.surface,
    minHeight: 320,
  } satisfies CSSProperties,
  empty: {
    color: colors.faint,
    fontStyle: 'italic',
    margin: 0,
    textAlign: 'center',
    padding: '40px 0',
  } satisfies CSSProperties,
  line: {
    display: 'flex',
    gap: 12,
    padding: '8px 0',
    borderBottom: `1px solid ${colors.bg}`,
    alignItems: 'baseline',
  } satisfies CSSProperties,
  partial: { opacity: 0.6, fontStyle: 'italic' } satisfies CSSProperties,
  time: {
    color: colors.faint,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 92,
    fontSize: 12,
  } satisfies CSSProperties,
  text: { flex: 1, lineHeight: 1.55, fontSize: 15, whiteSpace: 'pre-wrap' } satisfies CSSProperties,
  stickyBar: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 'max(12px, env(safe-area-inset-bottom)) 16px 16px',
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    justifyContent: 'center',
  } satisfies CSSProperties,
  stickyBtn: {
    padding: '14px 24px',
    borderRadius: 999,
    border: 'none',
    fontSize: 16,
    fontWeight: 600,
    minWidth: 200,
    boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
    cursor: 'pointer',
  } satisfies CSSProperties,
};

export function statusColor(status: string): string {
  if (status === 'listening') return '#16a34a';
  if (status === 'processing') return '#f59e0b';
  if (status === 'loading') return '#3b82f6';
  if (status === 'error') return colors.danger;
  if (status === 'ready') return '#22c55e';
  return colors.faint;
}
