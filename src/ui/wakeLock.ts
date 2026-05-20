/**
 * Screen Wake Lock — keep the device awake during long meetings so the OS
 * doesn't sleep and silently stop the microphone. Auto-reacquires after
 * visibilitychange (tab refocus) per W3C spec.
 *
 * Falls back to a no-op on browsers without the API (Firefox desktop, iOS<16.4).
 */
export class WakeLockHolder {
  private sentinel: WakeLockSentinel | null = null;
  private released = false;

  async acquire(): Promise<boolean> {
    if (!('wakeLock' in navigator)) return false;
    this.released = false;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      document.addEventListener('visibilitychange', this.onVisibility);
      return true;
    } catch {
      return false;
    }
  }

  async release(): Promise<void> {
    this.released = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    try {
      await this.sentinel?.release();
    } catch {
      // ignore
    }
    this.sentinel = null;
  }

  private onVisibility = async () => {
    if (this.released) return;
    if (document.visibilityState !== 'visible') return;
    if (this.sentinel) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // ignore — user may have switched apps long enough for OS to deny
    }
  };
}
