/**
 * Audible and haptic feedback for counted reps.
 *
 * This exists because of a physical fact about push-ups: your face is at the floor and the phone
 * is off to the side, so the screen tells you nothing while you work. Without a sound the camera
 * counter gives no signal at all — you find out whether it registered anything only after you
 * stand up.
 *
 * Caveats worth knowing:
 *  - `navigator.vibrate` is not implemented in Safari on iOS at all, so haptics are Android-only.
 *    Sound therefore has to carry the job on an iPhone.
 *  - iOS routes WebAudio through the ringer switch: on silent, the beeps are silent too.
 *  - Browsers refuse to start an AudioContext outside a user gesture, hence `installAudioUnlock`.
 */

export interface FeedbackPrefs {
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_FEEDBACK: FeedbackPrefs = { sound: true, vibration: true };

const PREF_KEY = 'arena.feedback';

export function loadFeedbackPrefs(): FeedbackPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_FEEDBACK;
    return { ...DEFAULT_FEEDBACK, ...(JSON.parse(raw) as Partial<FeedbackPrefs>) };
  } catch {
    return DEFAULT_FEEDBACK;
  }
}

export function saveFeedbackPrefs(p: FeedbackPrefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // Private mode / storage disabled — preferences just won't persist.
  }
}

type Ctx = AudioContext & { _armed?: boolean };
let ctx: Ctx | null = null;

function audioContext(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor() as Ctx;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Creates and resumes the audio context on the first user interaction.
 *
 * Reps counted by the camera aren't user gestures, so waiting for one would mean the very first
 * set stays silent. Any tap anywhere — including the one that switched to camera mode — arms it.
 */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return;

  // Voices arrive asynchronously in most browsers; touching the list early gets it populated
  // before the first crit, so the announcer isn't stuck on the default voice.
  if (speechSupported()) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  }

  const arm = () => {
    audioContext();
    // Speech needs its own gesture-time nudge on iOS. A silent utterance is enough to unlock it.
    if (speechSupported()) {
      try {
        const warm = new SpeechSynthesisUtterance(' ');
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch {
        // Nothing to do — the announcer just won't be available.
      }
    }
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('touchstart', arm);
    window.removeEventListener('keydown', arm);
  };
  window.addEventListener('pointerdown', arm, { once: true });
  window.addEventListener('touchstart', arm, { once: true });
  window.addEventListener('keydown', arm, { once: true });
}

// Everything is routed through one compressor. Low sawtooth drones stack up fast, and without
// a limiter the boss cue clips into a buzz — which reads as "broken", not "menacing".
let masterGain: GainNode | null = null;
function output(c: AudioContext): AudioNode {
  if (!masterGain || masterGain.context !== c) {
    const gain = c.createGain();
    gain.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    gain.connect(comp).connect(c.destination);
    masterGain = gain;
  }
  return masterGain;
}

/**
 * Broadband noise under a closing low-pass — texture, not pitch.
 *
 * Sustained oscillators, however low and however dissonant, still land on the ear as *notes*:
 * two of them together is a chord, and a chord with a soft attack is indistinguishable from
 * someone leaning on a piano. Filtered noise has no fundamental to latch onto, so it reads as
 * pressure. Sweeping the cutoff downward makes it feel like something closing in.
 */
function rumble(
  c: AudioContext,
  fromHz: number,
  toHz: number,
  atSec: number,
  durSec: number,
  peak: number,
  attackSec: number,
) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.9;

  const gain = c.createGain();
  const t0 = c.currentTime + atSec;
  filter.frequency.setValueAtTime(fromHz, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(30, toHz), t0 + durSec);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attackSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);

  src.connect(filter).connect(gain).connect(output(c));
  src.start(t0);
  src.stop(t0 + durSec + 0.02);
}

/** One short shaped tone. Attack/decay envelope keeps it from clicking. */
function tone(c: AudioContext, freq: number, atSec: number, durSec: number, peak = 0.22) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, c.currentTime + atSec);

  const t0 = c.currentTime + atSec;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);

  osc.connect(gain).connect(output(c));
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

// White noise, generated once per context and reused — the raw material for impact transients.
let noiseBuffer: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    const length = Math.floor(c.sampleRate * 0.3);
    const buf = c.createBuffer(1, length, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
  }
  return noiseBuffer;
}

/** Band-passed noise burst — the "crack" of something connecting. */
function hit(c: AudioContext, freq: number, q: number, atSec: number, durSec: number, peak: number) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;

  const gain = c.createGain();
  const t0 = c.currentTime + atSec;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);

  src.connect(filter).connect(gain).connect(output(c));
  src.start(t0);
  src.stop(t0 + durSec + 0.02);
}

/** Tone that slides in pitch — a fast downward sweep is what gives an impact its weight. */
function sweep(
  c: AudioContext,
  fromHz: number,
  toHz: number,
  atSec: number,
  durSec: number,
  peak: number,
  type: OscillatorType = 'sine',
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const t0 = c.currentTime + atSec;
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), t0 + durSec);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);

  osc.connect(gain).connect(output(c));
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

function buzz(prefs: FeedbackPrefs, pattern: number | number[]) {
  if (!prefs.vibration) return;
  navigator.vibrate?.(pattern);
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Picks a voice for the announcer line. English matters here: a Russian voice reads "Headshot"
 * phonetically as Cyrillic and the effect is lost. Deeper male voices land closer to the
 * arena-announcer sound, so they're preferred where the platform offers them.
 */
function announcerVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null; // Not loaded yet — the browser falls back to the lang default.
  const english = voices.filter((v) => /^en/i.test(v.lang));
  return (
    english.find((v) => /daniel|alex|fred|george|arthur|male/i.test(v.name)) ?? english[0] ?? null
  );
}

/**
 * Speaks a line. Returns whether speech was attempted, so callers can substitute a synthesised
 * cue when the platform has no voices at all.
 */
export function speak(text: string, rate = 0.9, pitch = 0.4): boolean {
  if (!speechSupported()) return false;
  try {
    // Crits can land back to back; without cancelling, utterances queue up and the announcer
    // falls further and further behind the reps.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const voice = announcerVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * Crit cue: a shooter-style impact followed by the announcer calling "Headshot".
 *
 * The voice comes from the browser's own speech synthesis rather than a bundled recording — the
 * recognisable game samples are somebody else's audio, and TTS costs nothing to ship and works
 * offline. Where no voice exists, a metallic ring stands in so a crit still sounds distinct:
 * its partials are inharmonic (ratios 1 / 1.51 / 2.34, not whole multiples), which is what makes
 * a sound read as struck metal instead of a musical note.
 */
export function playCrit(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const spoken = speak('Headshot');
    const c = audioContext();
    if (c) {
      hit(c, 2600, 1.1, 0, 0.055, 0.22);
      sweep(c, 340, 90, 0, 0.1, 0.24, 'triangle');
      if (!spoken) {
        const base = 1180;
        sweep(c, base, base * 0.97, 0.012, 0.42, 0.16);
        sweep(c, base * 1.51, base * 1.47, 0.012, 0.34, 0.1);
        sweep(c, base * 2.34, base * 2.28, 0.012, 0.26, 0.06);
      }
    }
  }
  buzz(prefs, [45, 30, 70]);
}

/** A counted rep. Crits get their own cue so you can hear one without looking at the screen. */
export function playRep(prefs: FeedbackPrefs, crit = false) {
  if (crit) {
    playCrit(prefs);
    return;
  }
  if (prefs.sound) {
    const c = audioContext();
    if (c) tone(c, 880, 0, 0.09);
  }
  buzz(prefs, 22);
}

export function playBossDefeat(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      tone(c, 660, 0, 0.12);
      tone(c, 880, 0.11, 0.12);
      tone(c, 1320, 0.22, 0.26);
    }
  }
  buzz(prefs, [60, 60, 60, 60, 160]);
}

export function playLevelUp(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      tone(c, 880, 0, 0.1);
      tone(c, 1320, 0.09, 0.18);
    }
  }
  buzz(prefs, [40, 50, 90]);
}

/** Announces that the minions are done and the boss is in front of you. */
export function playBossEncounter(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    // Lowest pitch the speech API allows, and slow enough to land as a pronouncement.
    const spoken = speak('Boss', 0.6, 0);
    const c = audioContext();
    if (c) {
      // Deliberately atonal. An earlier version stacked two sawtooths a tritone apart, which is
      // a chord however low you put it — and a chord with a soft attack sounds like a piano, not
      // like dread. Nothing here has a pitch to hear.
      rumble(c, 380, 60, 0, 1.9, 0.5, 0.55);
      // Sine, so almost no harmonics: on headphones this is felt rather than heard, and on a
      // phone speaker it simply thickens the rumble instead of adding a note to it.
      sweep(c, 64, 30, 0, 1.5, 0.3, 'sine');
      // A single dull impact to start it, low enough that it thuds rather than clicks.
      hit(c, 110, 0.5, 0, 0.5, 0.22);
      if (!spoken) {
        // No voice on this platform — a second, later swell carries the moment on its own.
        rumble(c, 260, 70, 0.5, 1.4, 0.34, 0.35);
      }
    }
  }
  buzz(prefs, [160, 80, 160, 80, 360]);
}

/** End of a Speed Rush round. */
export function playRushEnd(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      tone(c, 520, 0, 0.16);
      tone(c, 392, 0.16, 0.3);
    }
  }
  buzz(prefs, [120, 80, 120]);
}

/** True when the device can actually vibrate — lets the UI stop promising what it can't do. */
export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
