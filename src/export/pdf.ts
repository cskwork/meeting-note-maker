import type { MeetingNote } from '../notes/types';
import { toHtml } from './html';

/**
 * Opens the rendered HTML in a new window and triggers the browser print dialog.
 * User chooses "Save as PDF" in the dialog. This avoids bundling jsPDF and
 * preserves Korean fonts via the system stack.
 */
export function exportToPdfViaPrint(note: MeetingNote): void {
  const html = toHtml(note, { autoPrint: true });
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error('새 창을 열 수 없습니다. 팝업을 허용해주세요.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
