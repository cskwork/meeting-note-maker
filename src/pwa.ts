/**
 * PWA registration + persistent storage request.
 *
 * Why persist: STT and TTS models total ~500MB-1.2GB (Whisper + Supertonic 3).
 * Without `navigator.storage.persist()` the browser may evict them under disk
 * pressure. Persistent storage is only cleared by explicit user action.
 */
export function registerPwa(): void {
  if (typeof navigator === 'undefined') return;

  // Service worker first (so the cache slot exists before persist() runs).
  if ('serviceWorker' in navigator) {
    if (location.protocol === 'https:' || location.hostname === 'localhost') {
      window.addEventListener('load', () => {
        const base = (import.meta.env.BASE_URL ?? './').replace(/\/?$/, '/');
        navigator.serviceWorker
          .register(`${base}sw.js`, { scope: base })
          .then(() => void requestPersistentStorage())
          .catch(() => {
            // Silent — PWA install is a progressive enhancement.
          });
      });
    }
  } else {
    // No SW available (very old browser) — still try persistent storage.
    void requestPersistentStorage();
  }
}

async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return;
    // Browser may show a prompt on Firefox; Chrome auto-grants for installed
    // PWAs or sites with high engagement. Failure is non-fatal — caches still
    // work, they're just evictable under pressure.
    await navigator.storage.persist();
  } catch {
    // ignore
  }
}
