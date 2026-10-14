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
 *  - iOS routes WebAudio through the ringer switch: on silent, the beeps are silent too — unless
 *    the player opts into `loud`, see `applyAudioSession`.
 *  - Browsers refuse to start an AudioContext outside a user gesture, hence `installAudioUnlock`.
 */

// The one thing the sound needs from the picture: when the boss lands. Kept there rather
// than copied here, because two numbers meaning the same moment drift apart the first time
// one of them is tuned.
import { LAND_SEC } from './bossCut';

export interface FeedbackPrefs {
  sound: boolean;
  vibration: boolean;
  /** Play through the iPhone's silent switch. Off by default: it can pause the player's music. */
  loud: boolean;
}

export const DEFAULT_FEEDBACK: FeedbackPrefs = { sound: true, vibration: true, loud: false };

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Safari 16.4+ (iOS 16.4+) lets a page say what kind of sound it makes. */
export function audioSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as AudioSessionNavigator).audioSession);
}

/**
 * The silent switch.
 *
 * By default iOS treats WebAudio like a ringtone ("auto" ≈ ambient), so on silent the gym goes
 * quiet. Declaring the page's sound as "playback" — the category of a video or a music app — makes
 * it play regardless of the switch. The price is that playback audio may pause or duck what's
 * playing in another app, which is why it's the player's choice and not the default.
 */
export function applyAudioSession(prefs: FeedbackPrefs) {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = prefs.loud ? 'playback' : 'auto';
  } catch {
    // An unknown type on some build — stay with the browser's default.
  }
}

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
    const c = audioContext();
    // Fetched at the first tap rather than on the first rep. Decoding takes a moment, and the
    // rep that needs the sound is the one that just happened — a cue that arrives late is
    // worse than the synthesised one that arrives on time.
    if (c) for (const name of Object.keys(SAMPLES) as SampleName[]) loadSample(c, name);
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

/* ----------------------------- recorded cues ----------------------------- */

/**
 * The one recorded sound in here; everything else on this screen is synthesised.
 *
 * A real recording of coins is doing something the oscillators cannot: dozens of pieces of
 * metal striking each other at once, each with its own ring and its own moment. That is worth
 * fetching a file for — but only where it earns its place, which is the boss whose whole joke
 * is money.
 *
 * The file is the pour only. The recording ran on for another second and a half of a single
 * coin spinning down on the table, which is a lovely sound and completely wrong here: it is
 * longer than the gap between two push-ups, so every rep would start before the last one had
 * finished whirring and the screen would sound like a tumble dryer full of change.
 */
const SAMPLES = {
  coins: 'sfx/coins.m4a',
  oink: 'sfx/oink.m4a',
  bossfight: 'sfx/bossfight.m4a',
  headshot: 'sfx/headshot.m4a',
  // The Minecraft damage "oof", for the Ender Dragon's reps.
  hurt: 'sfx/hurt.m4a',
  // The turtles' shout as Shredder goes down.
  cowabunga: 'sfx/cowabunga.m4a',
  // The little Mega Knight's shout on the King's stage.
  megaKnight: 'sfx/megaknight.m4a',
  // Clash Royale's goblin taunt, "mi-mi-mi": the King's, when he's drunk his elixir and is whole again.
  mimimi: 'sfx/mimimi.m4a',
  // Po's "Скидыщ!", for Tai Lung's stage.
  skidysh: 'sfx/skidysh.m4a',
  // Kiryukha's words in the finale, voiced: on the way into his fight, and on a rerun.
  kiryukhaTalk: 'sfx/kiryukha-talk.m4a',
  kiryukhaTalkRerun: 'sfx/kiryukha-talk-2.m4a',
  // Lines a boss says as he walks out, one file each under sfx/lines/.
  lineKrabs: 'sfx/lines/krabs.m4a',
  lineEnder: 'sfx/lines/ender.m4a',
  lineJoker: 'sfx/lines/joker.m4a',
  lineFreddy: 'sfx/lines/freddy.m4a',
  lineRobin: 'sfx/lines/robin.m4a',
  lineNicole: 'sfx/lines/nicole.m4a',
  linePig: 'sfx/lines/pig.m4a',
  lineGru: 'sfx/lines/gru.m4a',
  lineSkipper: 'sfx/lines/skipper.m4a',
  lineTsar: 'sfx/lines/tsar.m4a',
  lineShredder: 'sfx/lines/shredder.m4a',
  lineKing: 'sfx/lines/king.m4a',
  lineGoblin: 'sfx/lines/goblin.m4a',
  lineTaiLung: 'sfx/lines/tailung.m4a',
  lineUltron: 'sfx/lines/ultron.m4a',
} as const;
type SampleName = keyof typeof SAMPLES;

/** The ones a stage can name as its rep cue; the rest belong to a particular moment. */
export type RepSample = Extract<SampleName, 'coins' | 'oink' | 'hurt'>;
/** Every rep cue a stage can ask for: a recording, or one synthesised here. */
export type RepCue = RepSample | 'freeze' | 'slap' | 'claws' | 'staff' | 'honk' | 'buzzer' | 'mace' | 'katana' | 'cannon' | 'pumpkin' | 'belly' | 'metal' | 'gladiator';
/** A boss's spoken line, played once as he walks out — see `playBossEncounter`. */
export type BossLine = Extract<SampleName, `line${string}`>;

const loaded = new Map<SampleName, AudioBuffer>();
const failed = new Set<SampleName>();
const fetching: Partial<Record<SampleName, boolean>> = {};

/**
 * Pulls a sample into memory. Safe to call repeatedly: the second call is a no-op while the
 * first is in flight, and a sample that cannot be fetched or decoded is marked off rather
 * than retried on every rep.
 */
function loadSample(c: AudioContext, name: SampleName) {
  if (loaded.has(name) || failed.has(name) || fetching[name]) return;
  fetching[name] = true;
  void (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}${SAMPLES[name]}`);
      if (!res.ok) throw new Error(String(res.status));
      loaded.set(name, await c.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // Offline, missing file, or a container this browser won't decode. The synthesised
      // version below covers all three, so there is nothing to report and nothing to retry.
      failed.add(name);
    } finally {
      fetching[name] = false;
    }
  })();
}

/**
 * Plays a loaded sample, or reports that it could not.
 *
 * Pitch and level are nudged a few percent each time. One recording played back identically
 * forty times in a set stops being a sound and becomes a tick — the same reason the
 * synthesised coins below re-roll their partials on every call.
 */
function playSample(c: AudioContext, name: SampleName, peak: number, opts?: Spoken): boolean {
  const buffer = loaded.get(name);
  if (!buffer) return false;
  const src = c.createBufferSource();
  src.buffer = buffer;
  // Left alone for anything with words in it: a few percent of playback rate is unnoticeable
  // on a clatter of metal and turns a voice into a different person each time.
  if (!opts?.exact) src.playbackRate.value = 0.94 + Math.random() * 0.12;
  const gain = c.createGain();
  gain.gain.value = peak * (opts?.exact ? 1 : 0.85 + Math.random() * 0.3);
  src.connect(gain).connect(output(c));
  // Scheduled on the audio clock rather than a setTimeout. A timer fires whenever the main
  // thread next gets round to it, which during the cut is while sixteen sparks are being
  // animated — exactly the wrong moment to be asking it for millisecond accuracy.
  src.start(c.currentTime + (opts?.delay ?? 0));
  return true;
}

/** Playback options for a sample that is a recording of someone speaking. */
interface Spoken {
  /** Seconds from now. */
  delay?: number;
  /** Play it at the pitch and level it was recorded at, with no per-call variation. */
  exact?: boolean;
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
 * Crit cue: the shooter "headshot" recording — the same one on every crit, boss or minion, in
 * the arena and in Rush.
 *
 * Until the recording is in memory (the first tap of a session starts fetching it) or where it
 * can't be played at all, the old cue stands in: a synthesised impact and the browser's own
 * voice calling "Headshot". Where there is no voice either, a metallic ring — its partials are
 * inharmonic (ratios 1 / 1.51 / 2.34, not whole multiples), which is what makes a sound read as
 * struck metal instead of a musical note.
 */
export function playCrit(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) loadSample(c, 'headshot');
    // A voice in the recording: played as recorded, with no per-call pitch wobble.
    if (!c || !playSample(c, 'headshot', 0.7, { exact: true })) {
      const spoken = speak('Headshot');
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
  }
  buzz(prefs, [45, 30, 70]);
}

/**
 * Coins landing on coins.
 *
 * Struck metal is inharmonic — its partials aren't whole multiples of a fundamental, which is
 * the whole difference between a coin and a musical note. The ratios below (1 / 1.47 / 2.09)
 * are deliberately awkward for that reason. Two pings land a breath apart, because one coin
 * on its own reads as a doorbell, and everything is re-rolled per call so a set doesn't turn
 * into the same click forty times.
 */
function coins(c: AudioContext, peak: number) {
  const base = 1950 + Math.random() * 500;
  const second = 0.045 + Math.random() * 0.04;

  for (const [at, gain] of [
    [0, peak],
    [second, peak * 0.7],
  ] as const) {
    const pitch = base * (at === 0 ? 1 : 0.86 + Math.random() * 0.2);
    // The strike itself: a hard, bright transient with no pitch of its own.
    hit(c, 5200, 1.6, at, 0.03, gain * 0.5);
    sweep(c, pitch, pitch * 0.985, at, 0.18, gain, 'sine');
    sweep(c, pitch * 1.47, pitch * 1.45, at, 0.13, gain * 0.55, 'sine');
    sweep(c, pitch * 2.09, pitch * 2.05, at, 0.09, gain * 0.3, 'sine');
  }
}

/**
 * Gru's freeze ray: a laser "pew" diving down in pitch, then the frost — a hiss of ice forming
 * and a glassy ping as it sets.
 *
 * Under a quarter of a second, so back-to-back reps don't pile up, and re-rolled a few percent
 * on every call like the coins, so a set doesn't turn into the same zap forty times. The ping's
 * partials are deliberately inharmonic (1 / 1.41 / 2.13): whole multiples would make a musical
 * note, and ice isn't one.
 */
function freezeRay(c: AudioContext, peak: number) {
  const k = 0.92 + Math.random() * 0.16;
  // The beam: a bright square wave sliding down fast, with a sine an octave under it for body.
  sweep(c, 2600 * k, 520 * k, 0, 0.13, peak * 0.32, 'square');
  sweep(c, 1300 * k, 260 * k, 0, 0.13, peak * 0.6, 'sine');
  // Ice forming: high, narrow noise.
  hit(c, 7200 * k, 2.5, 0.09, 0.1, peak * 0.55);
  // And setting: a short glassy ping.
  const ping = 3100 * k;
  sweep(c, ping, ping * 0.995, 0.11, 0.14, peak * 0.45, 'sine');
  sweep(c, ping * 1.41, ping * 1.4, 0.11, 0.1, peak * 0.25, 'sine');
  sweep(c, ping * 2.13, ping * 2.1, 0.11, 0.07, peak * 0.15, 'sine');
}

/**
 * Skipper's flipper chop: a swish of air, then the slap — a bright, flat crack of noise with a
 * short low thump under it for weight. No voice: a rep cue plays a hundred times a session, and
 * the talking is left to his line before the fight.
 */
function flipperSlap(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  const t0 = c.currentTime;
  // The swish: noise through a band-pass sliding up, quiet and quick.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(700 * k, t0);
  band.frequency.exponentialRampToValueAtTime(3200 * k, t0 + 0.07);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak * 0.35, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
  src.connect(band).connect(g).connect(output(c));
  src.start(t0);
  src.stop(t0 + 0.1);
  // The slap itself: wide-band and short, which is what makes it flat and wet rather than a knock.
  hit(c, 1900 * k, 0.7, 0.075, 0.07, peak);
  hit(c, 4200 * k, 1.1, 0.075, 0.04, peak * 0.45);
  // Weight.
  sweep(c, 190 * k, 70, 0.075, 0.09, peak * 0.6, 'sine');
}

/** Noise through a band-pass whose centre slides — the raw material of a swish. */
function swish(c: AudioContext, fromHz: number, toHz: number, atSec: number, durSec: number, q: number, peak: number) {
  const t0 = c.currentTime + atSec;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = q;
  band.frequency.setValueAtTime(fromHz, t0);
  band.frequency.exponentialRampToValueAtTime(toHz, t0 + durSec);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + durSec * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  src.connect(band).connect(g).connect(output(c));
  src.start(t0);
  src.stop(t0 + durSec + 0.02);
}

/**
 * Nicole's claws tearing the air: one broad swipe of a paw, and on top of it three thin, high
 * scratches a hair apart — one per claw — all sweeping down as the paw comes through. Narrow
 * filters on the scratches are what make them read as claws rather than wind: wide noise is a
 * whoosh, a tight band of it is a blade. Under a fifth of a second, re-rolled every call.
 */
function clawSwipe(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  // The paw.
  swish(c, 2600 * k, 700 * k, 0, 0.16, 0.9, peak * 0.7);
  // The claws.
  for (let i = 0; i < 3; i += 1) {
    const at = 0.02 + i * (0.011 + Math.random() * 0.006);
    const top = (7800 - i * 900) * k;
    swish(c, top, top * 0.45, at, 0.09, 7, peak * (0.9 - i * 0.15));
  }
}

/**
 * Robin's bo staff landing: a short swish as it comes round, then a hard, dry wooden "tock".
 *
 * Wood is what the band-passed click and the quick-dying pair of tones are for: a hollow knock
 * has a pitch, but only for a few hundredths of a second — let it ring and it turns into a
 * marimba. Under a fifth of a second, re-rolled every call.
 */
function staffStrike(c: AudioContext, peak: number) {
  const k = 0.92 + Math.random() * 0.16;
  // The swing.
  swish(c, 900 * k, 3200 * k, 0, 0.07, 1.4, peak * 0.35);
  const at = 0.065;
  // Contact: a hard click, then the knock of the wood.
  hit(c, 2400 * k, 1.8, at, 0.025, peak);
  hit(c, 950 * k, 5, at, 0.06, peak * 0.8);
  sweep(c, 520 * k, 380 * k, at, 0.07, peak * 0.7, 'triangle');
  sweep(c, 1340 * k, 1100 * k, at, 0.04, peak * 0.3, 'sine');
}

/**
 * Freddy's nose: the squeeze-horn "honk" from the poster in the first game.
 *
 * A rubber bulb horn is a buzzy reed — two sawtooths a few cents apart for the rasp, pushed
 * through a band-pass around 1.4 kHz for the nasal, pinched sound of the bell. The pitch sags a
 * touch as the bulb runs out of air, which is most of what makes it comic. Under a fifth of a
 * second, re-rolled every call.
 */
function noseHonk(c: AudioContext, peak: number) {
  const k = 0.94 + Math.random() * 0.12;
  const t0 = c.currentTime;
  const dur = 0.17;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1400 * k;
  band.Q.value = 2.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.setValueAtTime(peak, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  band.connect(g).connect(output(c));
  for (const detune of [-9, 9]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(410 * k, t0);
    osc.frequency.linearRampToValueAtTime(445 * k, t0 + 0.03);
    osc.frequency.exponentialRampToValueAtTime(360 * k, t0 + dur);
    osc.connect(band);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}

/**
 * The Joker's joy buzzer — the joke handshake that shocks: a spark, then a harsh electric buzz.
 *
 * The buzz is a low square wave with its loudness chopped by a fast square LFO, which is what
 * turns a hum into the rattling "bzzzt" of a cheap coil; a high crackle of noise rides on it.
 * Under a fifth of a second, re-rolled every call.
 */
function joyBuzzer(c: AudioContext, peak: number) {
  const k = 0.93 + Math.random() * 0.14;
  const t0 = c.currentTime;
  const dur = 0.17;
  // The spark.
  hit(c, 6500 * k, 1.5, 0, 0.02, peak * 0.9);
  // The buzz.
  const hum = c.createOscillator();
  hum.type = 'square';
  hum.frequency.value = 118 * k;
  const chop = c.createOscillator();
  chop.type = 'square';
  chop.frequency.value = 46 * k;
  const chopDepth = c.createGain();
  chopDepth.gain.value = 0.5;
  const vca = c.createGain();
  vca.gain.value = 0.5;
  chop.connect(chopDepth).connect(vca.gain);
  const tone = c.createBiquadFilter();
  tone.type = 'bandpass';
  tone.frequency.value = 900 * k;
  tone.Q.value = 0.8;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + 0.01);
  env.gain.setValueAtTime(peak * 0.55, t0 + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  hum.connect(vca).connect(tone).connect(env).connect(output(c));
  for (const o of [hum, chop]) {
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  // Crackle along the top of it.
  hit(c, 4200 * k, 3, 0.03, dur - 0.04, peak * 0.3);
}

/** Share of Shredder's blows that are both blades. */
export const KATANA_DOUBLE = 0.33;
/** How far the second blade trails the first, in seconds — the picture keeps to it too. */
export const KATANA_GAP_SEC = 0.08;

/**
 * Shredder's katanas, the way a sword sounds in the films: not a clang but a "shiing".
 *
 * Three layers. The swing is a thin whistle of the edge through the air — a tight band of noise
 * that leaps up in pitch and falls away again as the blade passes, with a broader whoosh under
 * it. Then, where it bites, a hiss of steel scraping steel: bright noise, a tenth of a second.
 * And over that the ring — high and thin, three to nine kilohertz, nothing a bell would use —
 * each partial a pair of tones a few hertz apart, so they beat against each other and the ring
 * shimmers instead of standing still. That shimmer is most of what says "blade".
 *
 * About one blow in three is both swords, the second a hair behind and a little lower, so a set
 * sounds like a swordsman and not a metronome. Re-rolled every call.
 */
function katanaSlash(c: AudioContext, peak: number, double?: boolean) {
  // Picked by the caller when the screen draws the blades too, so two cuts sound as two.
  const blades = (double ?? Math.random() < KATANA_DOUBLE) ? 2 : 1;
  for (let b = 0; b < blades; b += 1) {
    const k = (0.94 + Math.random() * 0.12) * (b ? 0.9 : 1);
    const t = b * KATANA_GAP_SEC;
    const p = peak * (b ? 0.7 : 1);
    // The swing: the edge whistling up and away, and the air it moves.
    swish(c, 2600 * k, 7400 * k, t, 0.06, 9, p * 0.45);
    swish(c, 7400 * k, 3000 * k, t + 0.055, 0.07, 9, p * 0.35);
    swish(c, 1200 * k, 3800 * k, t, 0.1, 1.5, p * 0.22);
    const at = t + 0.1;
    // The bite: a hard tick, then steel scraping steel.
    hit(c, 6400 * k, 1.5, at, 0.015, p * 0.7);
    swish(c, 9000 * k, 5200 * k, at, 0.12, 2.2, p * 0.4);
    // The ring: high partials, each a beating pair, dying away over a third of a second.
    for (const [hz, gain, dur] of [
      [3150, 0.16, 0.34],
      [4720, 0.13, 0.28],
      [6380, 0.1, 0.22],
      [8900, 0.06, 0.16],
    ] as const) {
      const f = hz * k;
      sweep(c, f, f * 0.998, at, dur, p * gain, 'sine');
      sweep(c, f + 7, (f + 7) * 0.998, at, dur, p * gain * 0.8, 'sine');
    }
  }
}

/**
 * Tsar Vladimir's bogatyrs at work: a heavy swing, then a mace landing on an iron shield — a dull
 * thud for the weight, a bright clang for the metal, and a short ring of bell partials on top,
 * like the Kyiv bells. The bell's ratios (1 / 2 / 2.4 / 3) are a church bell's own — a minor
 * third in the middle, which is what makes it a bell and not a gong. Every third blow or so is
 * the shield ringing out a little longer, so a set isn't one clang forty times. Under a quarter
 * of a second, re-rolled every call.
 */
function maceClang(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  const ring = Math.random() < 0.35 ? 1.6 : 1;
  // The swing.
  swish(c, 500 * k, 1800 * k, 0, 0.08, 1.1, peak * 0.3);
  const at = 0.07;
  // Weight: a low thump dropping away.
  sweep(c, 150 * k, 55, at, 0.12, peak * 0.9, 'sine');
  hit(c, 700 * k, 1.2, at, 0.05, peak * 0.7);
  // Metal: a hard bright crack.
  hit(c, 3600 * k, 1.4, at, 0.03, peak * 0.8);
  // The ring.
  const bell = 520 * k;
  for (const [ratio, gain, dur] of [
    [1, 0.5, 0.2],
    [2, 0.35, 0.16],
    [2.4, 0.3, 0.14],
    [3, 0.2, 0.1],
  ] as const) {
    sweep(c, bell * ratio, bell * ratio * 0.997, at, dur * ring, peak * gain, 'sine');
  }
}

/**
 * The King's tower cannon, from Clash Royale: a short, round "bomp" rather than a war-film boom —
 * the arena is a cartoon. A puff of air out of the muzzle, a low thump that drops in pitch for
 * the shot's weight, and a wooden knock on top for the carriage kicking back. Every few shots
 * the ball lands with a dull thud a beat later. Under a quarter of a second, re-rolled every call.
 */
function towerCannon(c: AudioContext, peak: number) {
  const k = 0.92 + Math.random() * 0.16;
  // The muzzle puff.
  swish(c, 1600 * k, 400 * k, 0, 0.09, 0.9, peak * 0.45);
  // The shot: a round low thump.
  sweep(c, 190 * k, 48, 0, 0.16, peak, 'sine');
  sweep(c, 95 * k, 40, 0, 0.2, peak * 0.6, 'triangle');
  // The carriage kicking back.
  hit(c, 900 * k, 4, 0.005, 0.04, peak * 0.6);
  hit(c, 2400 * k, 2, 0, 0.02, peak * 0.35);
  // Now and then, the ball landing.
  if (Math.random() < 0.3) hit(c, 300 * k, 1.5, 0.15, 0.06, peak * 0.5);
}

/**
 * The Green Goblin's pumpkin bomb: a hiss of the fuse, a quick tick as it lands, then a short
 * fat pop — a bang with a low thump under it — and a fizz of sparks after. Round and cartoonish
 * rather than a real explosion, and under a third of a second so it keeps up with a set. Every
 * few blows the bomb goes off with a little extra crackle. Re-rolled every call.
 */
function pumpkinBomb(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  // The fuse.
  swish(c, 5200 * k, 7200 * k, 0, 0.07, 4, peak * 0.22);
  const at = 0.07;
  // Landing.
  hit(c, 3000 * k, 2, at, 0.012, peak * 0.4);
  // The pop: a burst of noise and a thump dropping away.
  hit(c, 900 * k, 0.7, at + 0.01, 0.1, peak * 0.9);
  sweep(c, 170 * k, 45, at + 0.01, 0.18, peak, 'sine');
  sweep(c, 420 * k, 120, at + 0.01, 0.08, peak * 0.35, 'square');
  // Sparks fizzing off it.
  swish(c, 6000 * k, 2500 * k, at + 0.05, 0.16, 1.4, peak * 0.25);
  if (Math.random() < 0.35) {
    for (let i = 0; i < 4; i += 1) hit(c, 4000 + Math.random() * 3000, 3, at + 0.08 + i * 0.035, 0.012, peak * 0.25);
  }
}

/**
 * A blow on Tai Lung, the way Po beats him: a big soft belly. Not a slap and not a thud but a
 * "bwoing" — a muffled whump of a fist sinking into something round, then the belly bouncing it
 * back, a low tone that springs up in pitch, sags and wobbles out like a jelly settling. Under a
 * third of a second, re-rolled every call.
 */
function bellyBounce(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  const t0 = c.currentTime;
  // The fist sinking in: soft, low, no click.
  const muffle = c.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 420 * k;
  const thud = c.createBufferSource();
  thud.buffer = noise(c);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.0001, t0);
  tg.gain.exponentialRampToValueAtTime(peak * 0.9, t0 + 0.008);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  thud.connect(muffle).connect(tg).connect(output(c));
  thud.start(t0);
  thud.stop(t0 + 0.1);
  // The bounce: a low tone springing up, sagging back and wobbling out.
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70 * k, t0 + 0.02);
  osc.frequency.exponentialRampToValueAtTime(190 * k, t0 + 0.07);
  osc.frequency.exponentialRampToValueAtTime(110 * k, t0 + 0.16);
  osc.frequency.exponentialRampToValueAtTime(135 * k, t0 + 0.21);
  osc.frequency.exponentialRampToValueAtTime(100 * k, t0 + 0.28);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t0 + 0.02);
  og.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  osc.connect(og).connect(output(c));
  osc.start(t0 + 0.02);
  osc.stop(t0 + 0.32);
  // A touch of the octave on top, so a phone speaker can hear the "boing" too.
  sweep(c, 280 * k, 380 * k, 0.03, 0.12, peak * 0.25, 'triangle');
}

/**
 * A blow on Ultron: a length of iron bar slamming into steel plate. A hard bright crack for the
 * hit, then the clang — the partials of a struck metal bar (1 : 2.76 : 5.40 : 8.93, which is why
 * it sounds like a pipe and not a bell), each a pair of tones a few hertz apart so the ring beats
 * and shimmers — dying away over a third of a second. Every few blows the bar hits flatter and
 * rings a little longer. Re-rolled every call.
 */
function metalClang(c: AudioContext, peak: number) {
  const k = 0.92 + Math.random() * 0.16;
  const long = Math.random() < 0.3 ? 1.5 : 1;
  hit(c, 4200 * k, 1.2, 0, 0.02, peak * 0.9);
  hit(c, 1500 * k, 1.5, 0, 0.04, peak * 0.5);
  const base = 520 * k;
  for (const [ratio, gain, dur] of [
    [1, 0.5, 0.34],
    [2.76, 0.38, 0.26],
    [5.4, 0.24, 0.18],
    [8.93, 0.14, 0.12],
  ] as const) {
    const f = base * ratio;
    sweep(c, f, f * 0.996, 0.005, dur * long, peak * gain, 'sine');
    sweep(c, f + 5, (f + 5) * 0.996, 0.005, dur * long, peak * gain * 0.7, 'sine');
  }
}

/**
 * A blow on Kiryukha: a fist into a wall of muscle. Not a crack but a heavy, dull "thwump" —
 * a low thump with the meat of it in the low mids — and the grit of the arena sand kicked up
 * under it. Under a quarter of a second, re-rolled every call.
 */
function gladiatorPunch(c: AudioContext, peak: number) {
  const k = 0.9 + Math.random() * 0.2;
  hit(c, 260 * k, 0.9, 0, 0.09, peak);
  sweep(c, 120 * k, 50, 0, 0.16, peak * 0.9, 'sine');
  hit(c, 900 * k, 1.4, 0.005, 0.04, peak * 0.35);
  swish(c, 3500 * k, 1800 * k, 0.03, 0.12, 1, peak * 0.15);
}

/** A counted rep. Crits get their own cue so you can hear one without looking at the screen. */
/** `double`: Shredder's katana — both blades this time; left out, it's rolled here. */
export function playRep(prefs: FeedbackPrefs, crit = false, sound?: RepCue, double?: boolean) {
  if (crit) {
    playCrit(prefs);
    return;
  }
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      // The recording where there is one, something synthesised where there isn't. A sample
      // can still be in flight on the first rep of a session, or fail to decode entirely,
      // and this screen must never answer a counted rep with silence — that is the one thing
      // the player is listening for with their face at the floor.
      if (sound === 'freeze') freezeRay(c, 0.3);
      else if (sound === 'slap') flipperSlap(c, 0.3);
      else if (sound === 'claws') clawSwipe(c, 0.35);
      else if (sound === 'staff') staffStrike(c, 0.32);
      else if (sound === 'honk') noseHonk(c, 0.3);
      else if (sound === 'buzzer') joyBuzzer(c, 0.3);
      else if (sound === 'mace') maceClang(c, 0.3);
      else if (sound === 'katana') katanaSlash(c, 0.3, double);
      else if (sound === 'cannon') towerCannon(c, 0.32);
      else if (sound === 'pumpkin') pumpkinBomb(c, 0.32);
      else if (sound === 'belly') bellyBounce(c, 0.4);
      else if (sound === 'metal') metalClang(c, 0.32);
      else if (sound === 'gladiator') gladiatorPunch(c, 0.4);
      else if (sound) {
        loadSample(c, sound);
        if (!playSample(c, sound, 0.5)) {
          if (sound === 'coins') coins(c, 0.18);
          else tone(c, 880, 0, 0.09);
        }
      } else tone(c, 880, 0, 0.09);
    }
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

/**
 * A bell: a sine with two quiet upper partials at bell-like ratios and a long, soft tail.
 * The partials are what make it ring instead of beep — a bare sine is a test tone.
 */
function bell(c: AudioContext, freq: number, atSec: number, durSec: number, peak: number) {
  tone(c, freq, atSec, durSec, peak);
  tone(c, freq * 2, atSec, durSec * 0.6, peak * 0.28);
  tone(c, freq * 3.01, atSec, durSec * 0.35, peak * 0.1);
}

/**
 * A promotion: a quick rising arpeggio of bells (C-E-G-C) landing on a bright chord that rings
 * out, with a low swell under it. Bigger than a level-up beep — a new rank is rarer, and it
 * should feel like a ceremony.
 */
export function playRankUp(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => bell(c, f, i * 0.09, 0.35, 0.16));
      const at = notes.length * 0.09;
      for (const f of [1046.5, 1318.5, 1568]) bell(c, f, at, 1.4, 0.11);
      sweep(c, 90, 140, 0, 0.9, 0.18, 'sine');
    }
  }
  buzz(prefs, [60, 40, 60, 40, 160]);
}

/**
 * "Paid": the confirmation a purchase makes. In the spirit of a phone's payment chime — a tiny
 * tick as the button gives, then two bright bells a fourth apart, the second left to ring —
 * but synthesised here, not a recording of anyone's. Paired with a double tap where vibration
 * exists, the way a confirmation feels in the hand.
 */
export function playPurchase(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      hit(c, 4200, 6, 0, 0.03, 0.12);
      bell(c, 1318.5, 0.035, 0.28, 0.16); // E6
      bell(c, 1760, 0.135, 0.7, 0.2); // A6
    }
  }
  buzz(prefs, [18, 60, 28]);
}

/**
 * Krabs' entry fee, paid in full: an old till's "ka-ching" — the clack of the key, the drawer
 * rattling out, and the bell. Held back a beat so it lands after the rep's own coins, not on them.
 */
export function playFeePaid(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      const at = 0.12;
      // The key going down.
      hit(c, 2600, 3, at, 0.025, 0.25);
      sweep(c, 320, 180, at, 0.04, 0.2, 'square');
      // The drawer.
      swish(c, 1800, 900, at + 0.04, 0.16, 2.5, 0.12);
      // The bell: two bright strikes a hair apart.
      bell(c, 2093, at + 0.07, 0.5, 0.2); // C7
      bell(c, 2637, at + 0.09, 0.6, 0.16); // E7
    }
  }
  buzz(prefs, [16, 40, 30]);
}

/**
 * A plank of the pig's fort giving way: a sharp crack, then a short splintering crackle and the
 * knock of the wood. Kept quiet — it rides on top of the rep's own oink.
 */
export function playWoodCrack(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const k = 0.9 + Math.random() * 0.2;
  hit(c, 2200 * k, 1.2, 0.04, 0.03, 0.22);
  for (let i = 0; i < 4; i += 1) hit(c, (1400 + Math.random() * 1800) * k, 4, 0.06 + i * 0.022, 0.02, 0.12);
  sweep(c, 260 * k, 140 * k, 0.04, 0.09, 0.18, 'triangle');
}

/**
 * The pig going pop, as they do in the game: a soft, low "pff" of a cloud bursting — noise that
 * falls in pitch — with a little squeak riding on the front of it.
 */
export function playPoof(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 1600, 180, 0.05, 0.45, 0.8, 0.45);
  sweep(c, 140, 60, 0.05, 0.25, 0.35, 'sine');
  sweep(c, 900, 1400, 0, 0.08, 0.08, 'triangle');
}

/* ------------------------------- Король ------------------------------- */

/**
 * The King's heal, Clash Royale style: a glug of elixir — a bubbly "bloop" sliding up — and a
 * soft rising sparkle as the heal spell settles on him.
 */
export function playElixirHeal(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 260, 620, 0, 0.12, 0.22, 'sine');
  sweep(c, 380, 900, 0.09, 0.1, 0.16, 'sine');
  for (let i = 0; i < 4; i += 1) {
    const f = 1050 * 2 ** (i * 4 / 12);
    sweep(c, f, f * 1.01, 0.16 + i * 0.06, 0.22, 0.07, 'triangle');
  }
}

/**
 * The little Mega Knight's turn: his shout as he leaps — the recording, fetched while the King's
 * stage is up (preloadBossCues); the speech synthesiser bellows it only if the file never made
 * it — and the slam when he lands, `landAt` seconds later.
 */
export function playMegaKnight(prefs: FeedbackPrefs, landAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) {
    speak('Mega Knight!', 0.85, 0.1);
    return;
  }
  loadSample(c, 'megaKnight');
  if (!playSample(c, 'megaKnight', 0.9, { exact: true })) speak('Mega Knight!', 0.85, 0.1);
  sweep(c, 140, 38, landAt, 0.4, 0.55, 'sine');
  hit(c, 300, 0.9, landAt, 0.3, 0.45);
  swish(c, 1400, 250, landAt, 0.5, 0.8, 0.3);
}

/**
 * His tower coming down: a deep blast, stone grinding and tumbling, and then the three crowns
 * chiming in one after another, each a step higher.
 */
export function playTowerFall(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 120, 35, 0, 0.7, 0.6, 'sine');
  hit(c, 400, 0.8, 0, 0.5, 0.5);
  swish(c, 1800, 200, 0.05, 0.9, 0.7, 0.35);
  for (let i = 0; i < 6; i += 1) hit(c, 500 + Math.random() * 900, 3, 0.25 + i * 0.09 + Math.random() * 0.04, 0.05, 0.2);
  [784, 988, 1175].forEach((f, i) => {
    const at = 0.95 + i * 0.32;
    sweep(c, f, f, at, 0.45, 0.16, 'triangle');
    sweep(c, f * 2, f * 2, at, 0.3, 0.06, 'sine');
  });
}

/* --------------------------- Зелёный Гоблин --------------------------- */

/** His glider screaming past: a jet's roar sweeping up and away, panned by the pitch alone. */
export function playGliderPass(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 600, 3200, 0, 0.5, 1.2, 0.35);
  swish(c, 3200, 900, 0.45, 0.6, 1.2, 0.25);
  sweep(c, 180, 320, 0, 0.5, 0.12, 'sawtooth');
  sweep(c, 320, 140, 0.5, 0.5, 0.08, 'sawtooth');
}

/** A pumpkin bomb landing for real: the fuse, then a proper bang and a long fizz. */
export function playPumpkinBlast(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 5000, 7500, 0, 0.12, 4, 0.12);
  hit(c, 700, 0.6, 0.12, 0.35, 0.6);
  sweep(c, 150, 35, 0.12, 0.5, 0.6, 'sine');
  swish(c, 6000, 1500, 0.2, 0.6, 1.2, 0.2);
}

/**
 * The Goblin's own bomb taking him out: the fuse hissing with a tick that speeds up, then at
 * `boomAt` seconds a big round bang — deeper and longer than his everyday pumpkins — and a long
 * crackle of the shell coming down.
 */
export function playGoblinBoom(prefs: FeedbackPrefs, boomAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 5000, 7000, 0, boomAt, 4, 0.12);
  for (const at of [0.1, 0.35, 0.55, 0.7, 0.8, 0.86]) if (at < boomAt) sweep(c, 1600, 1600, at, 0.04, 0.12, 'square');
  hit(c, 500, 0.5, boomAt, 0.7, 0.75);
  sweep(c, 120, 28, boomAt, 1, 0.8, 'sine');
  swish(c, 3000, 300, boomAt + 0.05, 1.2, 0.8, 0.3);
  for (let i = 0; i < 8; i += 1) hit(c, 1500 + Math.random() * 3000, 3, boomAt + 0.3 + i * 0.09 + Math.random() * 0.05, 0.03, 0.12);
}

/** Spider-Man's web shooter: a sharp "thwip" — a pinched little zip up in pitch. */
export function playThwip(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 1800, 7000, 0, 0.09, 3, 0.35);
  sweep(c, 900, 2600, 0, 0.07, 0.08, 'triangle');
}

/* ------------------------------- Тай Лунг ------------------------------- */

/** Po's belly-bump in a raid on Tai Lung: just the "bwoing", no shout. */
export function playBellyBump(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (c) bellyBounce(c, 0.45);
}

/** One of the Furious Five landing a blow: a whoosh into a hard, bright smack. */
export function playKungFuHit(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 800, 3200, 0, 0.1, 1.2, 0.25);
  hit(c, 1800, 1, 0.09, 0.05, 0.5);
  sweep(c, 220, 80, 0.09, 0.12, 0.4, 'sine');
}

/**
 * Po's "Скидыщ!" at `atSec` from now — the recording (fetched while Tai Lung's stage is up), the
 * speech synthesiser only if it never arrived — with the belly's "bwoing" under it when `belly`.
 */
export function playSkidysh(prefs: FeedbackPrefs, atSec: number, belly = true) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) {
    window.setTimeout(() => speak('Skadoosh!', 1, 1.3), atSec * 1000);
    return;
  }
  loadSample(c, 'skidysh');
  window.setTimeout(() => {
    if (belly) bellyBounce(c, 0.45);
    if (!playSample(c, 'skidysh', 0.9, { exact: true })) speak('Skadoosh!', 1, 1.3);
  }, atSec * 1000);
}

/**
 * Po's firework chair: the rockets' fizz and a rising whistle as it streaks over, and at
 * `burstAt` the bang and a crackle of the firework opening.
 */
export function playFireworkChair(prefs: FeedbackPrefs, burstAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 3000, 5000, 0, burstAt, 3, 0.12);
  sweep(c, 700, 2400, 0, burstAt, 0.06, 'sine');
  hit(c, 600, 0.6, burstAt, 0.4, 0.5);
  sweep(c, 140, 40, burstAt, 0.5, 0.45, 'sine');
  for (let i = 0; i < 12; i += 1) hit(c, 2500 + Math.random() * 4000, 3, burstAt + 0.15 + Math.random() * 0.7, 0.02, 0.12);
}

/** The Dragon Scroll: a papery swish as it unrolls and a bright chime as the gold catches the light. */
export function playScroll(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 2500, 6000, 0, 0.35, 1, 0.2);
  [1319, 1760, 2637].forEach((f, i) => sweep(c, f, f, 0.3 + i * 0.07, 0.6, 0.07, 'sine'));
}

/** Tai Lung snapping up a dumpling: a soft pop as it lands and two quick chomps. */
export function playNom(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 500, 900, 0, 0.06, 0.12, 'sine');
  for (const at of [0.08, 0.2]) {
    hit(c, 700, 1.2, at, 0.04, 0.3);
    sweep(c, 180, 110, at, 0.06, 0.2, 'sine');
  }
}

/**
 * The Wuxi finger hold: a deep gong as the little finger comes down, a rising golden shimmer,
 * and at `boomAt` the blast rolling out — a low boom with a long airy wash behind it.
 */
export function playWuxi(prefs: FeedbackPrefs, boomAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (const [ratio, g] of [[1, 0.35], [2.4, 0.18], [3.9, 0.1]] as const) sweep(c, 110 * ratio, 108 * ratio, 0, 1.6, g, 'sine');
  for (let i = 0; i < 8; i += 1) {
    const f = 900 * 2 ** (i / 6);
    sweep(c, f, f * 1.02, 0.2 + i * (boomAt - 0.25) / 8, 0.3, 0.05, 'triangle');
  }
  sweep(c, 90, 25, boomAt, 1.4, 0.7, 'sine');
  hit(c, 300, 0.5, boomAt, 0.6, 0.5);
  swish(c, 4000, 400, boomAt, 1.6, 0.7, 0.3);
}

/* -------------------------------- Альтрон -------------------------------- */

/** A drone's push-up counted out: a short robotic blip, a step higher each time. */
export function playDroneBlip(prefs: FeedbackPrefs, n: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const f = 520 * 2 ** (Math.min(n, 8) / 12);
  sweep(c, f, f, 0, 0.07, 0.08, 'square');
  sweep(c, f * 1.5, f * 1.5, 0.07, 0.05, 0.05, 'square');
}

/** Puppet strings dropping onto him and snapping: a slack twang, then three sharp plinks. */
export function playStringSnap(prefs: FeedbackPrefs, snapAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 180, 160, 0, 0.5, 0.08, 'triangle');
  for (let i = 0; i < 3; i += 1) {
    const at = snapAt + i * 0.07;
    hit(c, 5000, 4, at, 0.015, 0.2);
    sweep(c, 1400 + i * 300, 700, at, 0.2, 0.08, 'triangle');
  }
}

/** Iron Man's repulsor: a rising whine as it charges, then at `fireAt` the blast — a bright zap and a thump. */
export function playRepulsor(prefs: FeedbackPrefs, fireAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 300, 1800, Math.max(0, fireAt - 0.5), 0.5, 0.06, 'sawtooth');
  sweep(c, 2400, 600, fireAt, 0.25, 0.18, 'square');
  swish(c, 6000, 1500, fireAt, 0.3, 1.5, 0.3);
  sweep(c, 160, 50, fireAt + 0.05, 0.25, 0.4, 'sine');
}

/**
 * Captain America's shield: the whoosh of it spinning out, the clang off Ultron at `hitAt` —
 * the vibranium "ting" that rings on and on — and the whoosh of it coming back.
 */
export function playShieldThrow(prefs: FeedbackPrefs, hitAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 700, 2200, 0, hitAt, 1.5, 0.22);
  hit(c, 3500, 1.2, hitAt, 0.02, 0.6);
  for (const [f, g, d] of [[1240, 0.22, 0.9], [2610, 0.14, 0.7], [4120, 0.08, 0.5]] as const) {
    sweep(c, f, f * 0.998, hitAt, d, g, 'sine');
    sweep(c, f + 4, (f + 4) * 0.998, hitAt, d, g * 0.6, 'sine');
  }
  swish(c, 2200, 700, hitAt + 0.15, hitAt * 0.9, 1.5, 0.18);
}

/** Thor's hammer: the whoosh of it flying in, a thunderclap, and steel bursting apart. */
export function playMjolnir(prefs: FeedbackPrefs, strikeAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 400, 2400, 0, strikeAt, 1.2, 0.3);
  hit(c, 2500, 0.6, strikeAt, 0.15, 0.6);
  hit(c, 300, 0.4, strikeAt + 0.05, 1.2, 0.55);
  sweep(c, 80, 25, strikeAt, 1.4, 0.6, 'sine');
  for (let i = 0; i < 10; i += 1) {
    const f = 2000 + Math.random() * 4000;
    sweep(c, f, f * 0.98, strikeAt + 0.1 + Math.random() * 0.6, 0.2, 0.06, 'sine');
  }
}

/* -------------------------------- Финал -------------------------------- */

/** Fetches Kiryukha's voiced lines ahead of the moment he speaks. */
export function preloadKiryukhaTalk(intoFight: boolean) {
  const c = audioContext();
  if (c) loadSample(c, intoFight ? 'kiryukhaTalk' : 'kiryukhaTalkRerun');
}

/**
 * Kiryukha speaking his lines in the finale, from the top — the version on the way into his
 * fight, or the rerun's. Waits briefly for the file if it's still on its way; returns a function
 * that silences it (skipping the scene).
 */
export function startKiryukhaTalk(prefs: FeedbackPrefs, intoFight: boolean): () => void {
  if (!prefs.sound) return () => {};
  const c = audioContext();
  if (!c) return () => {};
  const name = intoFight ? 'kiryukhaTalk' : 'kiryukhaTalkRerun';
  loadSample(c, name);
  let src: AudioBufferSourceNode | null = null;
  let cancelled = false;
  const startedAt = performance.now();
  const attempt = () => {
    if (cancelled) return;
    const buffer = loaded.get(name);
    if (buffer) {
      src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = 0.95;
      src.connect(gain).connect(output(c));
      // Started late if it was still loading: skip ahead, so the words keep to the text.
      const late = (performance.now() - startedAt) / 1000;
      src.start(c.currentTime, late);
    } else if (!failed.has(name) && performance.now() - startedAt < 1500) window.setTimeout(attempt, 80);
  };
  attempt();
  return () => {
    cancelled = true;
    try {
      src?.stop();
    } catch {
      // Already finished.
    }
  };
}

/* -------------------------------- Кирюха -------------------------------- */

/** The crowd of the arena: a swell of roaring noise, rising and settling. */
function crowd(c: AudioContext, at: number, dur: number, peak: number) {
  swish(c, 700, 1200, at, dur * 0.5, 0.5, peak);
  swish(c, 1200, 600, at + dur * 0.45, dur * 0.55, 0.5, peak * 0.8);
}

/** A chariot thundering past: galloping hooves, the wheels' rumble, and the crowd roaring it on. */
export function playChariot(prefs: FeedbackPrefs, dur: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let t = 0; t < dur; t += 0.18) {
    hit(c, 500, 1.5, t, 0.04, 0.18);
    hit(c, 420, 1.5, t + 0.07, 0.04, 0.14);
  }
  swish(c, 300, 600, 0, dur, 0.7, 0.16);
  crowd(c, dur * 0.3, dur * 0.7, 0.18);
}

/** The lion: a big roar — and then, once it has seen who it's roaring at, a small meow. */
export function playLionGag(prefs: FeedbackPrefs, roarAt: number, meowAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 400, 160, roarAt, 1, 0.9, 0.45);
  sweep(c, 140, 70, roarAt, 1, 0.3, 'sawtooth');
  sweep(c, 700, 1100, meowAt, 0.12, 0.1, 'triangle');
  sweep(c, 1100, 600, meowAt + 0.12, 0.25, 0.1, 'triangle');
}

/** The crowd's cameras going off: a ragged burst of shutter clicks and flash whines. */
export function playShutters(prefs: FeedbackPrefs, count: number, over: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < count; i += 1) {
    const at = Math.random() * over;
    hit(c, 3000, 2, at, 0.02, 0.2);
    hit(c, 1800, 2, at + 0.04, 0.02, 0.12);
  }
  crowd(c, 0.1, over + 0.4, 0.16);
}

/** A volley of arrows: whistles coming down, then little "tings" as they bounce off him. */
export function playArrowVolley(prefs: FeedbackPrefs, landAt: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 6; i += 1) {
    const at = i * 0.06;
    sweep(c, 2400 + Math.random() * 600, 900, at, landAt - at, 0.04, 'sine');
    const ting = landAt + Math.random() * 0.4;
    hit(c, 5000, 3, ting, 0.015, 0.15);
    sweep(c, 3000 + Math.random() * 1500, 2800, ting, 0.15, 0.05, 'sine');
  }
}

/** The spartans' war cry: three short, deep "АУ!" barks in time with their steps. */
export function playSpartanCry(prefs: FeedbackPrefs, beats: number[]) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (const at of beats) {
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 650;
    band.Q.value = 1.2;
    const g = c.createGain();
    const t0 = c.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    band.connect(g).connect(output(c));
    for (const f of [110, 113, 165]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + 0.28);
      o.connect(band);
      o.start(t0);
      o.stop(t0 + 0.3);
    }
    hit(c, 160, 1, at, 0.08, 0.3);
  }
}

/** The new master of the arena crowned: a fanfare over the crowd going wild. */
export function playCrowned(prefs: FeedbackPrefs, at: number) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  [523, 659, 784, 1047].forEach((f, i) => sweep(c, f, f, at + i * 0.12, i === 3 ? 0.8 : 0.18, 0.12, 'triangle'));
  crowd(c, at + 0.2, 2.2, 0.35);
}

/* --------------------------- Эндер-дракон --------------------------- */

/** XP orbs being picked up, Minecraft-style: a quick run of bright, rising pings. */
export function playXpOrbs(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 5; i += 1) {
    const f = 1400 + Math.random() * 900;
    sweep(c, f, f * 1.08, i * 0.07, 0.08, 0.07, 'sine');
  }
}

/* ------------------------------- Финал ------------------------------- */

/** One XP orb picked up: a single bright ping at a random pitch, as the game does it. */
export function playOrb(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const f = 1300 + Math.random() * 1100;
  sweep(c, f, f * 1.06, 0, 0.09, 0.06, 'sine');
  sweep(c, f * 2, f * 2.1, 0, 0.05, 0.015, 'sine');
}

/** The XP bar rolling over to the next level: a short bright bell pair. */
export function playXpLevel(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  bell(c, 1046.5, 0, 0.45, 0.1);
  bell(c, 1568, 0.07, 0.6, 0.08);
}

/** A slab of stone landing: a dull thump with a gritty edge. */
export function playSlabLand(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      sweep(c, 120, 45, 0, 0.35, 0.45, 'sine');
      hit(c, 600, 0.6, 0, 0.18, 0.3);
      hit(c, 2400, 1.2, 0, 0.05, 0.12);
    }
  }
  buzz(prefs, 50);
}

/** A heavy bare foot on stone. Low and short — in the silence it carries on its own. */
export function playFootstep(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      const k = 0.9 + Math.random() * 0.2;
      sweep(c, 95 * k, 40, 0, 0.22, 0.5, 'sine');
      hit(c, 380 * k, 0.8, 0, 0.08, 0.2);
    }
  }
  buzz(prefs, 25);
}

/**
 * The slab snapping over a knee: the crack that splits it, the thud of the knee under it, and
 * the grit and chips of the two halves coming apart.
 */
export function playSlabBreak(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      hit(c, 2800, 0.9, 0, 0.06, 0.6);
      hit(c, 6200, 1.6, 0, 0.03, 0.3);
      sweep(c, 160, 38, 0, 0.45, 0.6, 'sine');
      hit(c, 450, 0.5, 0.01, 0.35, 0.4);
      for (let i = 0; i < 9; i += 1) hit(c, 1200 + Math.random() * 3800, 3, 0.06 + i * 0.035 + Math.random() * 0.02, 0.025, 0.14);
      // The halves hitting the floor.
      sweep(c, 110, 50, 0.75, 0.2, 0.3, 'sine');
      hit(c, 900, 0.8, 0.75, 0.1, 0.18);
      sweep(c, 100, 45, 0.92, 0.2, 0.25, 'sine');
      hit(c, 800, 0.8, 0.92, 0.1, 0.15);
    }
  }
  buzz(prefs, [80, 40, 160]);
}

/* ------------------------------ Шреддер ------------------------------ */

/** A Foot ninja vanishing in smoke: a puff of air and a quick bamboo-flute flick. */
export function playNinjaVanish(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 1800, 400, 0, 0.3, 0.8, 0.22);
  sweep(c, 1400, 2600, 0.02, 0.09, 0.05, 'sine');
  hit(c, 5200, 2, 0.02, 0.02, 0.08);
}

/** The pot coming to the boil and Shredder supping it: bubbles, then a long, rude slurp. */
export function playSoupDinner(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 9; i += 1) {
    const f = 260 + Math.random() * 420;
    sweep(c, f, f * 1.9, 0.05 + i * 0.07 + Math.random() * 0.03, 0.06, 0.12, 'sine');
  }
  swish(c, 700, 2400, 0.8, 0.55, 3, 0.2);
  sweep(c, 180, 120, 1.4, 0.18, 0.25, 'sine');
}

/** The pot taken off the heat: a hiss of steam dying away. */
export function playSoupCool(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 6000, 2200, 0, 0.7, 0.7, 0.16);
}

/** Bebop's and Rocksteady's guns: three quick laser shots, each a bright chirp falling away. */
export function playLaserVolley(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 3; i += 1) {
    const at = i * 0.12;
    sweep(c, 2400, 380, at, 0.14, 0.14, 'square');
    sweep(c, 1600, 260, at, 0.14, 0.12, 'sawtooth');
    hit(c, 3000, 1, at, 0.03, 0.12);
  }
}

/** Stockman's mousers: a scuttle of tiny feet and the snap of their jaws. */
export function playMousers(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 22; i += 1) hit(c, 3200 + Math.random() * 2400, 6, i * 0.055 + Math.random() * 0.02, 0.015, 0.1);
  for (let i = 0; i < 5; i += 1) {
    const at = 0.15 + i * 0.28;
    hit(c, 1800, 3, at, 0.02, 0.22);
    sweep(c, 900, 500, at, 0.05, 0.1, 'square');
  }
}

/** Shredder going down: his helmet hitting the floor, then the turtles' "Cowabunga!". */
export function playCowabunga(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      // The helmet: a heavy clang and a couple of rattling bounces.
      for (const [at, g] of [
        [0.35, 0.4],
        [0.62, 0.22],
        [0.8, 0.12],
      ] as const) {
        hit(c, 2400, 1.5, at, 0.04, g);
        sweep(c, 880, 860, at, 0.25, g * 0.5, 'sine');
        sweep(c, 1430, 1400, at, 0.18, g * 0.3, 'sine');
      }
      // The shout, recorded, as the turtles come running — fetched while his stage is up (see
      // preloadBossCues). The browser's voice says it only if the file never made it.
      loadSample(c, 'cowabunga');
      if (!playSample(c, 'cowabunga', 0.9, { delay: 1.1, exact: true })) {
        [392, 494, 587, 784].forEach((f, i) => sweep(c, f, f * 1.01, 1.15 + i * 0.09, 0.22, 0.12, 'sawtooth'));
        window.setTimeout(() => speak('Cowabunga!', 1.05, 1.3), 1150);
      }
    } else window.setTimeout(() => speak('Cowabunga!', 1.05, 1.3), 1150);
  }
  buzz(prefs, [60, 200, 40, 120, 40]);
}

/** A blocky explosion: a deep boom and the crackle of debris. */
export function playExplosion(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  hit(c, 300, 0.4, 0, 0.6, 0.55);
  sweep(c, 110, 35, 0, 0.6, 0.5, 'sine');
  for (let i = 0; i < 6; i += 1) hit(c, 1500 + Math.random() * 2000, 2, 0.1 + Math.random() * 0.4, 0.03, 0.08);
}

/** An arrow: the twang of the bow, the whistle, and the thunk. */
export function playArrow(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 220, 180, 0, 0.12, 0.12, 'triangle');
  swish(c, 2400, 3600, 0.02, 0.25, 4, 0.08);
  hit(c, 800, 2, 0.28, 0.05, 0.2);
}

/** A creeper about to go: the long rising hiss of the fuse. */
export function playCreeperHiss(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 2500, 6000, 0, 1.1, 0.7, 0.2);
}

/** The Ender Dragon dying: a long, falling roar that dissolves into a hum. */
export function playDragonDeath(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 220, 60, 0, 2.2, 0.25, 'sawtooth');
  sweep(c, 330, 90, 0.05, 2, 0.12, 'square');
  hit(c, 500, 0.6, 0, 1.5, 0.15);
}

/** The End portal opening: a low, wavering hum with a shimmer on top. */
export function playPortal(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (const f of [110, 111.5, 165]) sweep(c, f, f, 0, 1.6, 0.08, 'sine');
  for (let i = 0; i < 8; i += 1) sweep(c, 2000 + i * 180, 2000 + i * 180, 0.2 + i * 0.12, 0.2, 0.03, 'sine');
}

/** The dragon's roar: a growl rising and breaking, with breath behind it. */
export function playRoar(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 90, 180, 0, 0.35, 0.3, 'sawtooth');
  sweep(c, 180, 70, 0.35, 0.8, 0.28, 'sawtooth');
  sweep(c, 140, 260, 0, 0.4, 0.12, 'square');
  hit(c, 700, 0.5, 0, 1.1, 0.2);
}

/** An Enderman teleporting: a warped, falling "vwoop". */
export function playTeleport(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 900, 200, 0, 0.35, 0.12, 'sine');
  sweep(c, 1350, 300, 0, 0.35, 0.06, 'triangle');
}

/** Victory: a bright fanfare climbing to a held chord. */
export function playFanfare(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const notes: [number, number][] = [[523.3, 0], [659.3, 0.15], [784, 0.3], [1046.5, 0.45]];
  for (const [f, at] of notes) {
    sweep(c, f, f, at, 0.25, 0.16, 'square');
    sweep(c, f / 2, f / 2, at, 0.25, 0.08, 'triangle');
  }
  for (const f of [1046.5, 1318.5, 1568]) sweep(c, f, f, 0.65, 1.2, 0.08, 'triangle');
}

/* ------------------------------ Царь ------------------------------ */

/** A strum across the gusli: plucked strings, low to high, a hair apart. */
export function playGusli(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const notes = [196, 246.9, 293.7, 392, 493.9, 587.3];
  notes.forEach((f, i) => {
    const at = i * 0.035;
    sweep(c, f, f * 0.998, at, 0.7, 0.07, 'triangle');
    sweep(c, f * 2, f * 2, at, 0.3, 0.025, 'sine');
    hit(c, f * 6, 3, at, 0.01, 0.03);
  });
}

/** Antipka's quill: a quick scratchy scribble. */
export function playQuill(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 6; i += 1) hit(c, 4500 + Math.random() * 2500, 4, i * 0.06 + Math.random() * 0.02, 0.04, 0.05);
}

/** Church bells ringing out: a big low bell and the smaller ones chiming over it. */
export function playBells(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 3; i += 1) {
    bell(c, 196, i * 0.7, 2, 0.18);
    bell(c, 196 * 2.4, i * 0.7, 1.4, 0.05);
  }
  const small = [784, 988, 880, 1175, 988, 784, 1047, 880];
  small.forEach((f, i) => bell(c, f, 0.2 + i * 0.22, 0.6, 0.06));
}

/** A firework of the salute bursting overhead. */
export function playSalute(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  hit(c, 700, 0.5, 0, 0.12, 0.3);
  sweep(c, 140, 50, 0, 0.3, 0.3, 'sine');
  for (let i = 0; i < 8; i += 1) hit(c, 3000 + Math.random() * 4000, 3, 0.15 + Math.random() * 0.35, 0.02, 0.06);
}

/* ------------------------------ Робин ------------------------------ */

/** Cyborg's sonic cannon: a whine charging up, then the blast. */
export function playSonicCannon(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 300, 1800, 0, 0.25, 0.12, 'sawtooth');
  sweep(c, 220, 90, 0.25, 0.3, 0.4, 'square');
  hit(c, 900, 0.6, 0.25, 0.25, 0.3);
}

/** Starfire's starbolts: three bright, bubbly zaps. */
export function playStarbolts(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 3; i += 1) {
    const at = i * 0.11;
    sweep(c, 1800, 600, at, 0.12, 0.14, 'triangle');
    sweep(c, 3600, 1200, at, 0.08, 0.05, 'sine');
  }
}

/** The Titans' communicator: a quick two-tone beep. */
export function playCommunicator(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  sweep(c, 1320, 1320, 0, 0.07, 0.1, 'square');
  sweep(c, 1760, 1760, 0.09, 0.09, 0.1, 'square');
}

/** Robin's bo staff whirling up to block: a run of swishes, then the clack of the blow on it. */
export function playStaffBlock(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 3; i += 1) swish(c, 700, 2600, i * 0.09, 0.08, 1.4, 0.12);
  hit(c, 2600, 1.8, 0.3, 0.03, 0.3);
  sweep(c, 1900, 1850, 0.3, 0.14, 0.1, 'sine');
}

/* ------------------------------ Джокер ------------------------------ */

/** A big card turning over: a quick papery flick. */
export function playCardFlip(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 1800, 5200, 0, 0.12, 2, 0.14);
  hit(c, 3800, 2, 0.12, 0.025, 0.12);
}

/**
 * A cackle: "ha-ha-ha-HA", each "ha" a burst of a buzzy, nasal tone through a vowel-ish filter,
 * hopping up and down in pitch and getting faster — synthesised, but unmistakably a laugh.
 */
export function playCackle(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime;
  const pitches = [310, 360, 300, 380, 330, 420];
  let at = 0;
  pitches.forEach((f, i) => {
    const len = 0.11 - i * 0.008;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f * 1.15, t0 + at);
    osc.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + at + len);
    const vowel = c.createBiquadFilter();
    vowel.type = 'bandpass';
    vowel.frequency.value = 900;
    vowel.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    osc.connect(vowel).connect(g).connect(output(c));
    osc.start(t0 + at);
    osc.stop(t0 + at + len + 0.02);
    // The breath of the "h".
    hit(c, 2500, 1, at, 0.03, 0.06);
    at += len + 0.05 - i * 0.004;
  });
}

/** The trick flower squirting: a short wet spurt, then the hiss of the acid eating something. */
export function playSquirt(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 700, 2200, 0, 0.18, 2.5, 0.2);
  hit(c, 6000, 1.5, 0.3, 0.45, 0.07);
}

/** A jack-in-the-box: the spring's "boing". */
export function playBoing(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const lfo = c.createOscillator();
  const depth = c.createGain();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.1);
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.6);
  lfo.frequency.value = 14;
  depth.gain.value = 50;
  lfo.connect(depth).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
  osc.connect(g).connect(output(c));
  for (const o of [osc, lfo]) {
    o.start(t0);
    o.stop(t0 + 0.7);
  }
}

/** The toy gun's "BANG!": a cork-gun pop, more fun than fright. */
export function playBang(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  hit(c, 1600, 0.7, 0, 0.06, 0.45);
  sweep(c, 900, 200, 0, 0.08, 0.3, 'square');
  sweep(c, 120, 50, 0, 0.18, 0.4, 'sine');
}

/* ------------------------------ Фредди ------------------------------ */

/** One music-box note: a bright plucked tine, a quick bell with a little ring. */
function tine(c: AudioContext, freq: number, at: number, peak: number) {
  sweep(c, freq, freq, at, 0.5, peak, 'triangle');
  sweep(c, freq * 2, freq * 2, at, 0.25, peak * 0.35, 'sine');
  sweep(c, freq * 3.01, freq * 3.01, at, 0.12, peak * 0.15, 'sine');
}

/**
 * Freddy's music box: the Toreador march he plays in the dark, as a tinkling, slightly slow
 * tune. Starts it looping quietly and returns a function that stops it.
 */
const TOREADOR: [number, number][] = [
  [392, 0.36], [440, 0.12], [392, 0.24], [329.6, 0.36], [329.6, 0.36], [329.6, 0.24],
  [293.7, 0.12], [329.6, 0.24], [349.2, 0.24], [329.6, 0.6],
];
export function startMusicBox(prefs: FeedbackPrefs): () => void {
  if (!prefs.sound) return () => {};
  const c = audioContext();
  if (!c) return () => {};
  const total = TOREADOR.reduce((sum, [, d]) => sum + d, 0) + 0.8;
  const play = () => {
    let t = 0;
    for (const [f, d] of TOREADOR) {
      tine(c, f * 2, t, 0.07);
      t += d;
    }
  };
  play();
  const id = window.setInterval(play, total * 1000);
  return () => window.clearInterval(id);
}

/** The jump-scare scream: a harsh, distorted, wavering shriek, loud and short. */
export function playScreech(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = 0.9;
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(x * 6);
  }
  shaper.curve = curve;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
  g.gain.setValueAtTime(0.32, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  shaper.connect(g).connect(output(c));
  for (const [f, d] of [[620, 0], [930, 7], [1240, -9]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = d;
    osc.frequency.setValueAtTime(f * 0.7, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 1.15, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + dur);
    const wob = c.createOscillator();
    const wd = c.createGain();
    wob.frequency.value = 23;
    wd.gain.value = f * 0.06;
    wob.connect(wd).connect(osc.frequency);
    osc.connect(shaper);
    for (const o of [osc, wob]) {
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }
  }
  hit(c, 3000, 0.5, 0, dur * 0.8, 0.18);
}

/** A burst of camera static: the feed coming on. */
export function playStatic(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  hit(c, 4000, 0.4, 0, 0.35, 0.12);
  hit(c, 1200, 0.6, 0.05, 0.25, 0.08);
}

/** Six o'clock: the shift is over — the clock's chime, three slow bell strikes. */
export function playSixAm(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 3; i += 1) {
    bell(c, 784, i * 0.45, 1.1, 0.16);
    bell(c, 1175, i * 0.45 + 0.01, 0.8, 0.06);
  }
}

/** Kids cheering "yaaay": a swell of bright, wavering voices — noise and tones rising together. */
export function playYay(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  for (let i = 0; i < 6; i += 1) {
    const f = 520 + i * 90 + Math.random() * 40;
    const at = Math.random() * 0.08;
    sweep(c, f, f * 1.35, at, 0.7, 0.04, 'sawtooth');
  }
  swish(c, 1500, 2600, 0, 0.8, 0.9, 0.14);
}

/** Mum's slipper: a whistle through the air, then a flat, rubbery smack. */
export function playSlipper(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 900, 3800, 0, 0.3, 1.6, 0.18);
  const at = 0.32;
  hit(c, 1500, 0.6, at, 0.08, 0.5);
  hit(c, 3800, 1.2, at, 0.04, 0.25);
  sweep(c, 210, 80, at, 0.12, 0.45, 'sine');
}

/** Seeing stars: a springy "boing", then little twinkles going round. */
export function playDizzy(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.08);
  osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.45);
  const lfo = c.createOscillator();
  const depth = c.createGain();
  lfo.frequency.value = 18;
  depth.gain.value = 40;
  lfo.connect(depth).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  osc.connect(g).connect(output(c));
  for (const o of [osc, lfo]) {
    o.start(t0);
    o.stop(t0 + 0.55);
  }
  for (let i = 0; i < 6; i += 1) {
    const f = [2093, 2637, 3136][i % 3];
    sweep(c, f, f, 0.45 + i * 0.12, 0.12, 0.07, 'sine');
  }
}

/** A penguin belly-sliding away over the ice: a long hiss that bends down as he goes. */
export function playSlide(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 5200, 1800, 0, 0.6, 3, 0.16);
  swish(c, 2600, 900, 0.05, 0.55, 1.2, 0.08);
}

/** A blow glancing off an ice shield: a bright, short, glassy clank. */
export function playShieldClank(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const k = 0.92 + Math.random() * 0.16;
  hit(c, 4400 * k, 3, 0.03, 0.02, 0.16);
  sweep(c, 2300 * k, 2250 * k, 0.03, 0.16, 0.11, 'sine');
  sweep(c, 3480 * k, 3420 * k, 0.03, 0.1, 0.06, 'sine');
}

/**
 * A crit stopped dead on a steel shield: the thud of the blow taking the shield back, a hard
 * clang off its face and a short, bright ring — heavier and lower than Skipper's ice.
 */
export function playShieldBlock(prefs: FeedbackPrefs) {
  if (prefs.sound) {
    const c = audioContext();
    if (c) {
      const k = 0.94 + Math.random() * 0.12;
      const at = 0.24;
      sweep(c, 170 * k, 60, at, 0.18, 0.5, 'sine');
      hit(c, 900 * k, 1.1, at, 0.06, 0.4);
      hit(c, 3800 * k, 1.6, at, 0.03, 0.35);
      for (const [r, g, d] of [
        [1, 0.16, 0.3],
        [2.76, 0.1, 0.22],
        [5.4, 0.05, 0.14],
      ] as const) {
        sweep(c, 620 * k * r, 620 * k * r * 0.996, at, d, g, 'sine');
      }
    }
  }
  buzz(prefs, [10, 230, 40]);
}

/** A frozen rep: the ice holding Gru takes a crack — a sharp, glassy split and a creak under it. */
export function playIceCrack(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const k = 0.9 + Math.random() * 0.2;
  hit(c, 5200 * k, 2, 0.08, 0.03, 0.22);
  hit(c, 2400 * k, 6, 0.09, 0.05, 0.14);
  sweep(c, 3400 * k, 2900 * k, 0.08, 0.09, 0.09, 'sine');
  sweep(c, 180 * k, 120 * k, 0.08, 0.12, 0.12, 'triangle');
}

/** The ice giving way: a burst of breaking glass — a crash, then shards tinkling down. */
export function playIceShatter(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  hit(c, 3800, 0.8, 0.08, 0.12, 0.3);
  hit(c, 7000, 1.5, 0.08, 0.2, 0.18);
  for (let i = 0; i < 9; i += 1) {
    const f = 2600 + Math.random() * 3600;
    const at = 0.14 + i * 0.035 + Math.random() * 0.02;
    sweep(c, f, f * 0.995, at, 0.09, 0.07, 'sine');
  }
}

/** A minion's giggle: a run of quick, high, bouncing blips. */
export function playGiggle(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  const base = 780 + Math.random() * 120;
  for (let i = 0; i < 5; i += 1) {
    const f = base * (i % 2 ? 1.25 : 1) * (1 - i * 0.04);
    sweep(c, f, f * 1.15, 0.05 + i * 0.075, 0.06, 0.09, 'triangle');
  }
}

/** Gru's ray giving up when you move in time: a sad little deflating "pfff". */
export function playFizzle(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  swish(c, 2400, 500, 0, 0.3, 1.5, 0.12);
  sweep(c, 600, 220, 0, 0.25, 0.08, 'triangle');
}

/** Announces that the minions are done and the boss is in front of you. */
/**
 * The line being said right now, with a meter on it, so the fight screen can move the boss in
 * time with his own voice. One at a time — a new boss's line replaces the last.
 */
let lineMeter: { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; from: number; to: number } | null = null;

/**
 * Plays a boss's line through a level meter (see `bossLineLevel`). If the file is still on its
 * way it waits for it, up to a moment past the cue: a line that lands a beat late is fine, one
 * that starts five seconds into the fight is not.
 */
function playLine(c: AudioContext, name: BossLine, peak: number, delay: number) {
  const startAt = c.currentTime + delay;
  const attempt = () => {
    if (loaded.has(name)) startLine(c, name, peak, Math.max(0, startAt - c.currentTime));
    else if (!failed.has(name) && c.currentTime < startAt + 0.6) window.setTimeout(attempt, 100);
  };
  attempt();
}

function startLine(c: AudioContext, name: BossLine, peak: number, delay: number) {
  const buffer = loaded.get(name);
  if (!buffer) return;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = peak;
  const analyser = c.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(gain);
  gain.connect(output(c));
  gain.connect(analyser);
  const from = c.currentTime + delay;
  src.start(from);
  lineMeter = { analyser, data: new Uint8Array(analyser.fftSize), from, to: from + buffer.duration };
}

/**
 * How loud the boss's line is at this instant, 0..1 — or null when no line is under way (not
 * started yet counts as under way, so a caller can wait for it). Read once a frame.
 */
export function bossLineLevel(): number | null {
  const c = ctx;
  // A suspended context (no tap yet, the phone's audio taken by something else) has a clock that
  // doesn't move: the line would be "about to start" forever. Report it as no line at all.
  if (!lineMeter || !c || c.state !== 'running') return null;
  const now = c.currentTime;
  if (now > lineMeter.to) {
    lineMeter = null;
    return null;
  }
  if (now < lineMeter.from) return 0;
  const { analyser, data } = lineMeter;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += (v - 128) * (v - 128);
  const rms = Math.sqrt(sum / data.length) / 128;
  // Speech sits around 0.05–0.3 RMS; this puts ordinary talking at the middle of the range.
  return Math.min(1, rms * 3.5);
}

/**
 * Starts fetching what a boss's entrance needs — the "Boss Fight" call and his line — ahead of
 * time, so they're in memory by the time he walks out. Safe to call as often as you like.
 */
export function preloadBossCues(line?: BossLine, ...extras: SampleName[]) {
  const c = ctx;
  if (!c) return;
  loadSample(c, 'bossfight');
  if (line) loadSample(c, line);
  for (const extra of extras) loadSample(c, extra);
}

/** The goblin's "mi-mi-mi" taunt, from Clash Royale. Nothing if the recording isn't in yet. */
export function playMimimi(prefs: FeedbackPrefs) {
  if (!prefs.sound) return;
  const c = audioContext();
  if (!c) return;
  loadSample(c, 'mimimi');
  playSample(c, 'mimimi', 0.85, { exact: true });
}

/** When a boss's own line starts: after the "Boss" call has had its say. */
const LINE_AT_SEC = LAND_SEC + 1.45;

export function playBossEncounter(prefs: FeedbackPrefs, line?: BossLine) {
  if (prefs.sound) {
    const c = audioContext();

    // The recorded call, held back until the word actually lands on screen. Everything else
    // in here plays at once, under the darkening — this is the only cue that has to hit a
    // mark, and the mark is the instant the composition is thrown into place.
    //
    // If the file is still on its way — the first boss of a session can come while a dozen
    // other cues are still downloading — it gets until that mark to arrive, rather than the
    // synthesised stand-in being picked the instant it isn't there.
    const sayBoss = () => {
      // The speech synthesiser says the word instead — lowest pitch it allows and slow enough to
      // land as a pronouncement.
      if (speechSupported()) speak('Boss', 0.6, 0);
    };
    if (c) {
      loadSample(c, 'bossfight');
      // Wall-clock, not the audio clock: a suspended context's clock stands still, and the wait
      // would never run out.
      const mark = Date.now() + LAND_SEC * 1000;
      const attempt = () => {
        const left = (mark - Date.now()) / 1000;
        if (loaded.has('bossfight')) playSample(c, 'bossfight', 0.85, { delay: Math.max(0, left), exact: true });
        else if (left > 0 && !failed.has('bossfight')) window.setTimeout(attempt, 60);
        else sayBoss();
      };
      attempt();
    } else window.setTimeout(sayBoss, LAND_SEC * 1000);
    const spoken = Boolean(c) || speechSupported();

    // And then the boss speaks for himself, where he has a line. Only the recording will do —
    // nobody wants the speech synthesiser doing an impression — so without it there's no line.
    if (c && line) {
      loadSample(c, line);
      playLine(c, line, 0.85, LINE_AT_SEC);
    }

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
