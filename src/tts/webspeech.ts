import type { TtsEngine, TtsVoice } from './types';

/**
 * Web Speech API based TTS. Works offline on most desktops (uses OS voices)
 * and on iOS/Android. Quality varies; on iOS Korean voice is "Yuna" by default.
 *
 * Privacy note: most OS-level TTS runs locally, but some Android builds route
 * through Google services. Document this for the user when selecting.
 */
export class WebSpeechTts implements TtsEngine {
  readonly id = 'webspeech' as const;
  private voices: SpeechSynthesisVoice[] = [];

  async init(): Promise<void> {
    if (typeof speechSynthesis === 'undefined') {
      throw new Error('이 브라우저는 Web Speech API를 지원하지 않습니다.');
    }
    this.voices = await loadVoices();
  }

  listVoices(lang: string): TtsVoice[] {
    const prefix = lang.split('-')[0].toLowerCase();
    return this.voices
      .filter((v) => v.lang.toLowerCase().startsWith(prefix))
      .map((v) => ({ id: v.voiceURI, label: `${v.name} (${v.lang})`, lang: v.lang }));
  }

  async speak(
    text: string,
    opts: { lang: string; voiceId?: string; speed?: number },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = normalizeLang(opts.lang);
      u.rate = opts.speed ?? 1.0;
      if (opts.voiceId) {
        const v = this.voices.find((x) => x.voiceURI === opts.voiceId);
        if (v) u.voice = v;
      }
      u.onend = () => resolve();
      u.onerror = (e) => reject(new Error(`TTS error: ${e.error ?? 'unknown'}`));
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  dispose(): void {
    this.stop();
  }
}

function normalizeLang(lang: string): string {
  if (lang === 'ko') return 'ko-KR';
  if (lang === 'en') return 'en-US';
  if (lang === 'ja') return 'ja-JP';
  return lang;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const ready = speechSynthesis.getVoices();
    if (ready.length > 0) {
      resolve(ready);
      return;
    }
    const onVoices = () => {
      speechSynthesis.removeEventListener('voiceschanged', onVoices);
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', onVoices);
    // Some browsers never fire the event; fall back to a short poll.
    setTimeout(() => {
      const v = speechSynthesis.getVoices();
      if (v.length > 0) resolve(v);
    }, 500);
  });
}
