import { useCallback, useEffect, useState } from 'react';
import type { MeetingNote } from '../notes/types';
import { toMarkdown } from '../export/markdown';
import { toHtml } from '../export/html';
import { exportToPdfViaPrint } from '../export/pdf';
import { downloadBlob, revokeDownloadUrl, safeFilename } from '../export/download';
import { css } from './styles';

export function ExportBar({ note }: { note: MeetingNote }) {
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ url: string; filename: string } | null>(null);
  const base = `${note.date}_${safeFilename(note.title)}`;

  useEffect(() => {
    return () => {
      if (fallback) revokeDownloadUrl(fallback.url);
    };
  }, [fallback]);

  const startDownload = useCallback((blob: Blob, filename: string) => {
    setError(null);
    setFallback((prev) => {
      if (prev) revokeDownloadUrl(prev.url);
      return null;
    });
    const url = downloadBlob(blob, filename);
    setFallback({ url, filename });
    window.setTimeout(() => {
      setFallback((prev) => {
        if (prev?.url === url) {
          revokeDownloadUrl(url);
          return null;
        }
        return prev;
      });
    }, 60_000);
  }, []);

  const onMd = useCallback(() => {
    try {
      const md = toMarkdown(note);
      startDownload(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [note, base, startDownload]);

  const onHtml = useCallback(() => {
    try {
      const html = toHtml(note);
      startDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [note, base, startDownload]);

  const onPdf = useCallback(() => {
    try {
      setError(null);
      exportToPdfViaPrint(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [note]);

  const disabled = note.agenda.length === 0 && note.actionItems.length === 0;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button style={css.button} onClick={onMd} disabled={disabled}>
        Markdown
      </button>
      <button style={css.button} onClick={onHtml} disabled={disabled}>
        HTML
      </button>
      <button style={css.button} onClick={onPdf} disabled={disabled}>
        PDF (인쇄)
      </button>
      {error && <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>}
      {fallback && (
        <a href={fallback.url} download={fallback.filename} style={{ fontSize: 13, color: '#2563eb' }}>
          다운로드가 안 보이면 열기
        </a>
      )}
    </div>
  );
}
