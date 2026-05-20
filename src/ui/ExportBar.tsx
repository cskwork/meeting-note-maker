import { useCallback, useState } from 'react';
import type { MeetingNote } from '../notes/types';
import { toMarkdown } from '../export/markdown';
import { toHtml } from '../export/html';
import { exportToPdfViaPrint } from '../export/pdf';
import { downloadBlob, safeFilename } from '../export/download';
import { css } from './styles';

export function ExportBar({ note }: { note: MeetingNote }) {
  const [error, setError] = useState<string | null>(null);
  const base = `${note.date}_${safeFilename(note.title)}`;

  const onMd = useCallback(() => {
    setError(null);
    const md = toMarkdown(note);
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
  }, [note, base]);

  const onHtml = useCallback(() => {
    setError(null);
    const html = toHtml(note);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${base}.html`);
  }, [note, base]);

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
    </div>
  );
}
