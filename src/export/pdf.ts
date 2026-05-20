import type { MeetingNote } from '../notes/types';
import { toHtml } from './html';

/**
 * Render the meeting note in a hidden iframe in the current document, then
 * trigger the browser print dialog from inside the iframe. User chooses
 * "Save as PDF". This is far more reliable than `window.open` + autoprint:
 *
 *   - No popup blocker — the iframe is same-origin and same-document
 *   - Korean fonts inherit from the host page font stack
 *   - Works on Safari/iOS where popups silently fail
 *   - Cleans up the iframe after print
 */
export function exportToPdfViaPrint(note: MeetingNote): void {
  const html = toHtml(note, { autoPrint: false });

  // Reuse an existing print iframe if one is somehow already mounted so we
  // don't accumulate.
  const prior = document.getElementById('mnm-print-frame');
  if (prior) prior.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'mnm-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  } as CSSStyleDeclaration);
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error('인쇄 프레임을 만들 수 없습니다.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Print blocked — fall through to cleanup
    }
    // Give the print dialog time to read the iframe before removal.
    setTimeout(() => iframe.remove(), 60_000);
  };

  // Most browsers fire onload synchronously after document.write+close on
  // about:blank, but Safari is fussy; fall back to a small timeout.
  if (doc.readyState === 'complete') {
    triggerPrint();
  } else {
    iframe.addEventListener('load', triggerPrint, { once: true });
    setTimeout(triggerPrint, 500);
  }
}
