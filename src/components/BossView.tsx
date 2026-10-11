import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion } from 'framer-motion';
import type { ProfileRecord, RepResult, RepUndo, ToastKind } from '../types';
import type { useProfile } from '../hooks/useProfile';
import type { Feedback } from '../hooks/useFeedback';
import { ACHIEVEMENTS } from '../data/achievements';
import { BOSSES, stageProgressLabel, type BossDef } from '../data/bosses';
import { CRYSTAL_REPS, FREEZE_PAUSE_MS, HALF_HP, SET_BREAK_MS, abilityName, abilityValue, describeAbility, hasAbility } from '../data/abilities';
import { perksFrom } from '../data/shop';
import { FreezeRayWarning, IceBlock, SHOT_FLY_S } from './GruFx';
import { MomWatch } from './NicoleFx';
import { CameraFeed, EnrageEyes, LightsFlicker } from './FreddyFx';
import { LaughGas } from './JokerFx';
import { TitansSignal } from './RobinFx';
import { BogatyrWall } from './Kyiv';
import { DragonWeak, EndCrystals, EndHitParticles, EnderAmbient, InfectionBadge } from './EnderFx';
import { HpMarks, IceShield, RetreatPlaster, hpMarks } from './SkipperFx';
import { BossIcon } from './BossIcon';
import { BossTalk } from './BossTalk';
import { BossBriefing, markBriefed, wasBriefed } from './BossBriefing';
import { AbilityStamp, AbilityStatus, FrostOverlay } from './AbilityFx';
import type { AbilityEvent } from '../data/combat';
import { DEV_SCENE_EVENT, takeDevScene } from '../lib/devScene';
import { BossIntro } from './BossIntro';
import { BOSS_INTRO_SEC } from '../lib/bossCut';
import { EnemyIcon } from './EnemyIcon';
import { StagePath } from './StagePath';
import { Heartbeat, PulseTrace } from './Heartbeat';
import { BOSS_HEARTS, MINION_HEARTS } from '../lib/vitals';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { CameraPanel } from './CameraPanel';
import { Camera, Search, Zap } from 'lucide-react';
import clsx from 'clsx';
import { HintCard } from './HintCard';
import { useHint } from '../lib/hints';
import { streakNotices } from '../lib/streak';
import { bossLineLevel, preloadBossCues } from '../lib/feedback';
import { HitFx, type Hit } from './HitFx';
import { AbilityScene, SCENE_MS, type Scene, type SceneKind } from './AbilityScene';

type Derived = NonNullable<ReturnType<typeof useProfile>['derived']>;

interface DamagePop {
  id: number;
  text: string;
  crit: boolean;
  /** Sideways offset in px, so a fast set fans its numbers out instead of stacking them. */
  x: number;
}

let popId = 0;

/** Height over width for the fight artwork — the sheets are cut as portraits. */
const ART_RATIO = 1.12;

/**
 * Everything on the fight screen that isn't the artwork: the stage path, the pulse, the health
 * bar, the mode switch and the counter. Measured, not guessed — the figure is sized from
 * whatever is left, because a laptop at 800px tall has *less* room than a phone, and a fixed
 * size pushed the plus button below the fold there.
 */
// Measured with the hand counter below, the shorter of the two: the stage card, the pulse, the
// health bar, the mode switch, the counter and the tab bar, with a little to spare. The camera
// panel is taller, so in camera mode the page scrolls a little — the boss stays on screen,
// which is what you look at from the floor.
const CHROME_PX = 432;
const ART_MIN = 180;
/** The name and the line under it (the title, with the boss's ability chips), below the picture. */
const NAME_PX = 62;
/**
 * The widest the fight artwork is shown, width over height. The sheets are wide scenes with the
 * figure in the middle; trimming their sides makes the figure itself bigger on a phone.
 */
const ART_MAX_SHAPE = 1.15;

export function BossView({
  profile,
  derived,
  registerBossRep,
  revertRep,
  tickArena,
  feedback,
  notify,
  endReplay,
}: {
  profile: ProfileRecord;
  derived: Derived;
  registerBossRep: () => Promise<RepResult>;
  revertRep: (u: RepUndo) => Promise<void>;
  tickArena: () => Promise<number>;
  feedback: Feedback;
  notify: (kind: ToastKind, title: string, description?: string) => void;
  /** Leaves a rematch; the real progress comes back. */
  endReplay: () => Promise<void>;
}) {
  const [pops, setPops] = useState<DamagePop[]>([]);
  const [shake, setShake] = useState<'hit' | 'crit' | null>(null);
  /** The blow on screen right now — the streak, the flash and the sparks (HitFx). */
  const [hit, setHit] = useState<Hit | null>(null);
  /** The fight block, and the enemy's picture inside it — where a blow's effects are laid. */
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  /** The HP bar — where Skipper's penguins come out to wave goodbye. */
  const hpBarRef = useRef<HTMLDivElement>(null);
  /**
   * A boss's send-off is playing (coins, the pig's pop, the minions, the penguins): the next
   * enemy waits off stage until it's over, and the space the boss stood in is held open so the
   * bar the penguins are standing on doesn't jump out from under them.
   */
  const [interlude, setInterlude] = useState<number | null>(null);
  const enemyBoxRef = useRef<HTMLDivElement>(null);
  const holdStage = (ms: number) => {
    setInterlude(enemyBoxRef.current?.offsetHeight ?? 0);
    window.setTimeout(() => setInterlude(null), ms);
  };
  /** An ability acted out over the screen (AbilityScene). */
  const [scene, setScene] = useState<Scene | null>(null);
  /** `at` overrides where it plays — for a scene that outlives the enemy it was about. */
  const playScene = (kind: SceneKind, at?: DOMRect) => {
    const r = at ?? artRef.current?.getBoundingClientRect();
    const id = ++popId;
    setScene({
      id,
      kind,
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.top + r.height / 2 : window.innerHeight / 3,
      art: `${import.meta.env.BASE_URL}bosses/${derived.boss.icon}`,
    });
    window.setTimeout(() => setScene((cur) => (cur?.id === id ? null : cur)), SCENE_MS[kind]);
  };
  const [flash, setFlash] = useState<'win' | null>(null);
  /** The ability moment on screen right now, if any — see AbilityFx. */
  const [stamp, setStamp] = useState<{ id: number; event: AbilityEvent } | null>(null);
  /**
   * Gru's ray is in the air: everything that says "frozen" — the word, the blue at the screen's
   * edges, the counter — waits for the bolt to land, so the freeze happens when he's hit.
   */
  const [frostPending, setFrostPending] = useState(false);
  /** Bumped on every crit the Joker turns into a joke, to flash his reminder chip. */
  const [jokePulse, setJokePulse] = useState(0);
  /**
   * The scouting report on this stage's boss. Every time the third minion falls — beaten before
   * or not, on a replay too — the boss walks out first (the "BOSS" cut, the call, his line) and
   * the report comes up once he's said his piece. Also on request from the stage card, and once
   * on its own if you land on a boss some other way (below).
   */
  const [briefing, setBriefing] = useState(false);
  /** A report waiting for the boss to finish his entrance. */
  const briefAfterEntrance = useRef(false);
  // Arriving some other way — a reload, a jump from the dev panel — there's no entrance to wait
  // for, so the report just comes up on its own. Checked when the timer fires: the new boss can
  // show up a moment before the rep that brought him has flagged his entrance.
  const bossUp = !derived.allBossesDefeated && derived.enemy.isBoss;
  // His entrance cues, fetched while you're still on his minions — and again after the first tap
  // of a session, which is when audio becomes available at all.
  useEffect(() => {
    preloadBossCues(derived.boss.line);
    const again = () => preloadBossCues(derived.boss.line);
    window.addEventListener('pointerdown', again, { once: true });
    return () => window.removeEventListener('pointerdown', again);
  }, [derived.boss.line]);
  useEffect(() => {
    if (!bossUp || wasBriefed(derived.boss.id)) return;
    const id = window.setTimeout(() => {
      if (!briefAfterEntrance.current) setBriefing(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, [bossUp, derived.boss.id]);
  const closeBriefing = () => {
    markBriefed(derived.boss.id);
    setBriefing(false);
  };
  const [impact, setImpact] = useState<'hit' | 'crit' | null>(null);
  /** The dark-and-"BOSS" cut, shown once the third minion falls. */
  const [bossIntro, setBossIntro] = useState(false);
  /** Which ability chip under the boss's name has its description open. */
  const [openAbility, setOpenAbility] = useState<string | null>(null);
  // A new boss closes whatever the last one had open.
  useEffect(() => setOpenAbility(null), [derived.boss.id]);
  const enemyControls = useAnimationControls();
  const calm = useReducedMotion();
  /**
   * The boss "talking": the loudness of his line, read every frame while it plays, for
   * `BossTalk` to move him with — so he moves with what he actually says, pauses included.
   */
  const talk = useMotionValue(0);
  const [talking, setTalking] = useState(false);
  useEffect(() => {
    if (!talking || calm) return;
    let raf = 0;
    let smooth = 0;
    let started = false;
    const since = performance.now();
    const tick = () => {
      const level = bossLineLevel();
      if (level === null) {
        // Null is either "finished" or "not scheduled yet" — the file can still be loading
        // when the boss walks out. Before it has started, give it a few seconds; after, settle
        // back to rest and stop.
        smooth *= 0.85;
        talk.set(smooth);
        const gaveUp = !started && performance.now() - since > 5000;
        if ((started && smooth < 0.01) || gaveUp) {
          talk.set(0);
          setTalking(false);
          return;
        }
      } else {
        if (level > 0) started = true;
        // Quick to rise, slower to fall — how a mouth looks, more or less.
        smooth += (level - smooth) * (level > smooth ? 0.5 : 0.15);
        talk.set(smooth);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      talk.set(0);
    };
  }, [talking, calm, talk]);
  const [fightHint, dismissFightHint] = useHint('fight');
  const wide = useMediaQuery('(min-width: 768px)');

  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined'
      ? { h: 800, w: 390 }
      : { h: window.innerHeight, w: window.innerWidth },
  );
  useEffect(() => {
    const onResize = () => setViewport({ h: window.innerHeight, w: window.innerWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // The name and the title line sit under the picture, so they come out of the height the
  // picture may take.
  const namePx = NAME_PX;
  const artWidth = Math.max(
    ART_MIN,
    Math.round(Math.min(wide ? 420 : 320, (viewport.h - CHROME_PX - namePx) / ART_RATIO)),
  );
  /**
   * How wide the artwork is allowed to get when the picture itself is a wide one. The column
   * minus its gutters — a landscape illustration held to the portrait width would be shrunk
   * for no reason, since its height is what's cheap.
   */
  // Edge to edge on a phone: the picture's own edges are feathered into the background, so it
  // needs no gutter of its own.
  const artRoom = Math.min(viewport.w, wide ? 560 : 400);
  // A stack, not a single slot: you can add ten reps by hand, so you must be able to take ten
  // back. The old single-slot version undid exactly one press and then silently did nothing.
  const undoStackRef = useRef<RepUndo[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const busyRef = useRef(false);

  const boss = derived.boss;
  const enemy = derived.enemy;
  const regenerating = enemy.isBoss && hasAbility(boss.abilities, 'regen');
  const hpPct = Math.max(0, Math.min(100, (profile.enemyHp / Math.max(1, enemy.hp)) * 100));
  // While a send-off plays the bar stays empty: the next enemy's full bar belongs to his entrance.
  const shownPct = interlude != null ? 0 : hpPct;
  /** HP as a share of the fight's full, for the abilities that switch on at a threshold. */
  const hpFrac = profile.enemyHp / Math.max(1, profile.fight.enemyMaxHp || enemy.hp);
  // Freddy's scream is close: the lights go and the music box starts, until it goes off.
  const screamNear =
    enemy.isBoss &&
    !derived.allBossesDefeated &&
    hasAbility(boss.abilities, 'scream') &&
    !profile.fight.screamUsed &&
    hpFrac > HALF_HP &&
    hpFrac <= 0.6 &&
    !bossIntro;
  useEffect(() => {
    if (!screamNear) return;
    return feedback.musicBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screamNear]);

  // A regenerating boss heals on the clock, so it has to be driven while you rest — waiting for
  // your next rep would leave the bar frozen exactly when the pressure should be visible.
  useEffect(() => {
    if (!regenerating) return;
    const id = window.setInterval(() => {
      void tickArena().then((healed) => {
        if (healed > 0) addPop(`+${healed} HP`, true);
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerating, tickArena]);

  const addPop = (text: string, crit: boolean) => {
    const id = ++popId;
    setPops((p) => [...p, { id, text, crit, x: Math.round((Math.random() - 0.5) * 90) }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };

  const handleRep = async () => {
    if (busyRef.current || derived.allBossesDefeated) return;
    busyRef.current = true;
    // Where the enemy being hit is drawn, taken before the rep lands: a killing blow swaps him
    // out, and the strike has to play over the one it struck, to the end.
    const art = artRef.current?.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    const box =
      art && stage ? { left: art.left - stage.left, top: art.top - stage.top, width: art.width, height: art.height } : null;
    try {
      // How much ice there was before this rep, to tell the rep that breaks it.
      const frozenBefore = enemy.isBoss ? (profile.fight.frozenLeft ?? 0) : 0;
      // HP an infected minion is carrying, to show it pass on when he falls.
      const carriedBefore = profile.fight.carriedHp ?? 0;
      const result = await registerBossRep();
      undoStackRef.current.push(result.undo);
      setUndoDepth(undoStackRef.current.length);
      // One cue per rep, picked by significance. Firing them all meant the rep that reached a
      // boss played the plain beep, the announcement and the level-up chime on top of each
      // other — three sounds for one event, which just reads as noise.
      // The creeper is the last before the dragon: it goes off first, and he walks out after.
      const creeper = !enemy.isBoss && boss.id === 'nameless' && derived.stageStep === 2;
      if (result.bossReached) {
        if (creeper) {
          holdStage(1500);
          window.setTimeout(() => playEntrance(boss.line), 1500);
        } else playEntrance(boss.line);
        // First time against him: the scouting report once he's done talking.
        // Every time he walks out — the first time, again after a loss of the thread, on a replay.
        briefAfterEntrance.current = true;
      } else if (result.bossDefeated || result.bossRebeaten || result.minionDefeated) feedback.bossDefeat();
      else if (result.leveledUp) feedback.levelUp();
      // The named cue belongs to the boss himself, not to the three who come first. `enemy`
      // is read from before the rep landed, which is the one being hit — after it, a killing
      // blow would already have moved on to the next.
      else feedback.rep(result.isCrit, enemy.isBoss ? boss.hitSound : undefined);

      // A rep that lands for nothing has to say why, or the counter looks broken.
      const BLOCKED_TEXT = {
        'blind-spot': 'СЛЕПАЯ ЗОНА',
        'odd-rep': 'НЕ В СЧЁТ',
        'last-stand': 'НЕ УМИРАЕТ!',
        fee: '🪙 В КАССУ!',
        piggy: '🥚 ЯЙЦО УКРАДЕНО!',
        frozen: '❄ ЗАМОРОЖЕН',
        slacking: 'НЕ ОТЛЫНИВАЙ!',
        joke: '🃏 ХА-ХА, ШУТКА!',
        tribute: '👑 ДАНЬ В КАЗНУ!',
      } as const;
      if (result.events.includes('frozen')) {
        setFrostPending(true);
        window.setTimeout(() => {
          setFrostPending(false);
          addPop(BLOCKED_TEXT.frozen, false);
        }, SHOT_FLY_S * 1000);
      } else if (result.blocked) addPop(BLOCKED_TEXT[result.blocked], false);
      // A rep swallowed by an ability shows where it went.
      const BLOCKED_SCENE: Partial<Record<NonNullable<typeof result.blocked>, SceneKind>> = {
        fee: 'coins',
        piggy: 'egg',
        joke: 'cards',
        slacking: 'slipper',
        frozen: 'ice-chip',
        tribute: 'tribute',
      };
      const swallowed = result.blocked && BLOCKED_SCENE[result.blocked];
      // The rep Gru's ray fires on has its own scene, once the bolt lands — no chip of ice first.
      if (swallowed && !result.events.includes('frozen')) playScene(swallowed);
      // The tsar's tribute: a strum on the gusli as it goes in, Antipka's quill as he writes it down.
      if (result.blocked === 'tribute') {
        feedback.gusli();
        window.setTimeout(feedback.quill, 1000);
      }
      // A blow on the bogatyrs' shields rings off them.
      if (enemy.isBoss && (profile.fight.guardLeft ?? 0) > 0 && !result.blocked) feedback.shieldClank();
      // The Joker's card: it turns over, and he laughs.
      if (result.blocked === 'joke') {
        setJokePulse((n) => n + 1);
        window.setTimeout(feedback.cardFlip, 520);
        window.setTimeout(feedback.cackle, 950);
      }
      // Mum's slipper lands a third of a second in: the smack, and the screen jumps with it.
      if (result.blocked === 'slacking') {
        feedback.slipper();
        window.setTimeout(() => {
          setShake('crit');
          window.setTimeout(() => setShake(null), 380);
        }, 330);
      }
      // Gru's ice: every frozen rep cracks it, and the last one breaks it.
      if (result.blocked === 'frozen') {
        const lastOne = frozenBefore === 1 && !result.events.includes('frozen');
        if (lastOne) {
          playScene('ice-shatter');
          feedback.iceShatter();
          void enemyControls.start({
            x: [0, -8, 8, -5, 5, 0],
            filter: ['brightness(1.8) hue-rotate(160deg)', 'brightness(1) hue-rotate(0deg)'],
            transition: { duration: 0.45 },
          });
        } else if (result.events.includes('frozen')) {
          // The ice forms when the bolt hits him, so it crackles then.
          window.setTimeout(feedback.iceCrack, SHOT_FLY_S * 1000);
        } else feedback.iceCrack();
      }
      else addPop(result.isCrit ? `-${result.damage} КРИТ!` : `-${result.damage}`, result.isCrit);
      if (result.healed > 0) addPop(`+${result.healed} HP`, true);
      if (result.revived) notify('info', 'Он поднялся', 'Зеркало вернуло его с половиной HP');
      playAbilityEvents(result.events);
      setShake(result.isCrit ? 'crit' : 'hit');
      window.setTimeout(() => setShake(null), result.isCrit ? 380 : 220);

      // The enemy itself takes it: flashes white, is knocked back away from the blow and
      // rocks back into place — harder on a crit, which also holds a beat first (a hit-stop, the
      // fighting-game trick that makes a heavy blow feel heavy). Shaking only the card made the
      // hit feel like it landed on the interface rather than on him.
      const away = Math.random() < 0.5 ? -1 : 1;
      // An ability going off moves him its own way (playAbilityEvents); the recoil would cut it off.
      if (result.blocked === 'fee' && !result.events.length) krabsGreed();
      else if (result.blocked === 'piggy') pigLaugh();
      else if (!result.events.length) void enemyControls.start(
        result.blocked
          ? { scale: [1, 0.97, 1], transition: { duration: 0.2 } }
          : result.isCrit
            ? {
                scale: [1, 1.04, 1.04, 0.82, 1.07, 1],
                x: [0, 0, 0, 26 * away, -6 * away, 0],
                rotate: [0, 0, 0, 9 * away, -4 * away, 0],
                filter: ['brightness(1)', 'brightness(2.6)', 'brightness(2.6)', 'brightness(1.4)', 'brightness(1)', 'brightness(1)'],
                transition: { duration: 0.5, times: [0, 0.06, 0.18, 0.4, 0.7, 1], ease: 'easeOut' },
              }
            : {
                scale: [1, 0.92, 1.02, 1],
                x: [0, 12 * away, -3 * away, 0],
                rotate: [0, 3.5 * away, -1.5 * away, 0],
                filter: ['brightness(1)', 'brightness(1.9)', 'brightness(1.05)', 'brightness(1)'],
                transition: { duration: 0.3, ease: 'easeOut' },
              },
      );
      if (!result.blocked) {
        if (box) setHit({ id: ++popId, crit: result.isCrit, box });
        setImpact(result.isCrit ? 'crit' : 'hit');
        window.setTimeout(() => setImpact(null), result.isCrit ? 320 : 200);
      }

      // The pig's fort soaking up part of a blow, now and then — his armour, made visible. Only
      // on a plain landed hit with nothing else playing over it, and not every time, or it's noise.
      const fortHit =
        enemy.isBoss && boss.id === 'brawler' && !result.blocked && !result.events.length && Math.random() < 0.28;
      if (fortHit && !(result.bossDefeated || result.bossRebeaten)) {
        playScene('planks');
        feedback.woodCrack();
      }
      // A blow on Skipper while his ice shield's up rings off it.
      const shieldUp =
        enemy.isBoss &&
        hasAbility(boss.abilities, 'bulwark') &&
        profile.enemyHp / Math.max(1, profile.fight.enemyMaxHp || enemy.hp) > 0.6;
      if (shieldUp && !result.blocked && !result.events.includes('bulwark-broken')) feedback.shieldClank();
      // Freddy going down: the power goes, the music box plays in the dark, the clock strikes six.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'titanprime' && art) {
        playScene('power-out', art);
        const stop = feedback.musicBox();
        window.setTimeout(stop, 2600);
        window.setTimeout(feedback.sixAm, 2800);
        window.setTimeout(feedback.yay, 3300);
        holdStage(SCENE_MS['power-out']);
      }
      // Nicole going down: seeing stars.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'wraith' && art) {
        playScene('dizzy', art);
        feedback.dizzy();
        holdStage(SCENE_MS.dizzy);
      }
      // Skipper going down: the unit smiles and waves, and slides off.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'steelguard' && art) {
        playScene('penguins-wave', hpBarRef.current?.getBoundingClientRect() ?? art);
        holdStage(SCENE_MS['penguins-wave']);
        window.setTimeout(feedback.slide, 1750);
      }
      // The Ender stage: the creeper goes off; the infection passes on; the dragon drinks your XP;
      // and the dragon dies the way he does in the game.
      if (creeper && (result.minionDefeated || result.bossReached) && art) {
        playScene('creeper-boom', art);
        feedback.creeperHiss();
        window.setTimeout(feedback.explosion, 950);
      } else if (result.minionDefeated && carriedBefore > 0) {
        window.setTimeout(() => {
          playScene('infect-pass');
          feedback.squirt();
        }, 350);
      }
      const orbs =
        enemy.isBoss && boss.id === 'nameless' && !result.blocked && !result.events.length && Math.random() < 0.2;
      if (orbs && !(result.bossDefeated || result.bossRebeaten)) {
        playScene('xp-orbs');
        window.setTimeout(feedback.xpOrbs, 500);
      }
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'nameless' && art) {
        playScene('ender-death', art);
        feedback.dragonDeath();
        window.setTimeout(feedback.xpOrbs, 2300);
        window.setTimeout(feedback.portal, 2550);
        [4050, 4470, 4890, 5310, 5730, 6150].forEach((ms) => window.setTimeout(feedback.salute, ms));
        window.setTimeout(feedback.fanfare, 4500);
        holdStage(SCENE_MS['ender-death']);
      } else if (enemy.isBoss && boss.id === 'nameless') {
        // A long fight, so it's marked out: he roars as he's driven past each quarter of his
        // health, and again when the last of his crystals goes and he's open to full damage.
        const max = Math.max(1, profile.fight.enemyMaxHp || enemy.hp);
        const before = profile.enemyHp / max;
        const after = (profile.enemyHp - result.damage + result.healed) / max;
        const passed = [0.75, 0.5, 0.25].some((t) => before > t && after <= t);
        const lastCrystal = result.events.includes('crystal') && (profile.fight.crystalsBroken ?? 0) === 2;
        if (passed || lastCrystal) {
          window.setTimeout(() => {
            playScene('dragon-roar');
            feedback.roar();
            setShake('crit');
            window.setTimeout(() => setShake(null), 380);
            void enemyControls.start({
              scale: [1, 1.18, 0.95, 1],
              rotate: [0, -6, 4, 0],
              transition: { duration: 0.8, ease: 'easeOut' },
            });
            if (lastCrystal) addPop('УРОН ПОЛНЫЙ!', true);
          }, result.events.length ? 1300 : 150);
        }
      }
      // The tsar going down: the crown rolls along the bar, Antipka catches it, bells and a salute.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'bloodking' && art) {
        playScene('crown-roll', hpBarRef.current?.getBoundingClientRect() ?? art);
        feedback.bells();
        window.setTimeout(feedback.bells, 2600);
        [850, 1400, 1950, 2500, 3050, 3600, 4150].forEach((ms) => window.setTimeout(feedback.salute, ms));
        holdStage(SCENE_MS['crown-roll']);
      }
      // Robin's armour: now and then his staff whirls up and a blow clacks off it.
      const staff =
        enemy.isBoss && boss.id === 'ironmaw' && !result.blocked && !result.events.length && Math.random() < 0.25;
      if (staff && !(result.bossDefeated || result.bossRebeaten)) {
        playScene('staff-block');
        feedback.staffBlock();
      }
      // Robin going down: a smoke bomb, and only his cape left.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'ironmaw' && art) {
        playScene('smoke-cape', art);
        feedback.poof();
        window.setTimeout(feedback.communicator, 1150);
        holdStage(SCENE_MS['smoke-cape']);
      }
      // The Joker's "Изматывание": now and then his lapel flower squirts acid at the rep's XP.
      const acid =
        enemy.isBoss && boss.id === 'voidhammer' && !result.blocked && !result.events.length && Math.random() < 0.2;
      if (acid && !(result.bossDefeated || result.bossRebeaten)) {
        playScene('acid-flower');
        window.setTimeout(feedback.squirt, 280);
      }
      // The Joker going down: a jack-in-the-box.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'voidhammer' && art) {
        playScene('jack-box', art);
        window.setTimeout(feedback.boing, 600);
        window.setTimeout(feedback.bang, 1400);
        window.setTimeout(feedback.cackle, 1600);
        holdStage(SCENE_MS['jack-box']);
      }
      // Gru's "Изматывание": now and then a minion runs off with the rep's XP.
      const xpThief =
        enemy.isBoss && boss.id === 'berserker' && !result.blocked && !result.events.length && Math.random() < 0.2;
      if (xpThief && !(result.bossDefeated || result.bossRebeaten)) {
        playScene('minion-thief');
        feedback.giggle();
      }
      // And when he goes down, his minions carry him off.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'berserker' && art) {
        playScene('minions-carry', art);
        holdStage(SCENE_MS['minions-carry']);
        feedback.giggle();
      }
      // And he goes the way pigs go: pop.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'brawler' && art) {
        playScene('pig-poof', art);
        holdStage(SCENE_MS['pig-poof'] - 300);
        feedback.poof();
      }

      // Krabs going down gives it all back: his gold bursts out of him and rolls off the floor.
      if ((result.bossDefeated || result.bossRebeaten) && enemy.isBoss && boss.id === 'grunt' && art) {
        playScene('coin-spill', art);
        holdStage(SCENE_MS['coin-spill'] - 300);
      }

      if (result.replayWon) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен снова!`, 'Ты догнал свой прогресс — дальше как было');
      } else if (result.bossRebeaten) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен снова!`, 'Дальше — следующий этап');
      } else if (result.bossDefeated) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 900);
        notify('boss-defeat', `${result.enemyName} повержен!`, 'Этап пройден — впереди новый');
      } else if (result.minionDefeated) {
        setFlash('win');
        window.setTimeout(() => setFlash(null), 600);
        notify('boss-defeat', `${result.enemyName} повержен!`, 'Следующий уже ждёт');
      }
      if (result.leveledUp) notify('level-up', `Новый уровень: ${result.newLevel}`);
      for (const [title, desc] of streakNotices(result)) notify('info', title, desc);
      if (result.weeklyBonus > 0) notify('record', 'Цель недели выполнена!', `+${result.weeklyBonus} XP`);
      for (const id of result.newAchievements) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        if (def) notify('achievement', `Достижение: ${def.title}`, def.description);
      }
    } finally {
      busyRef.current = false;
    }
  };

  /** Krabs taking the fee: a pleased little hop, rubbing his claws, with a greedy red gleam. */
  const krabsGreed = () =>
    void enemyControls.start({
      y: [0, -14, 0, -6, 0],
      rotate: [0, -5, 5, -3, 0],
      scale: [1, 1.05, 0.98, 1.02, 1],
      filter: ['brightness(1) saturate(1)', 'brightness(1.25) saturate(1.6)', 'brightness(1.1) saturate(1.3)', 'brightness(1) saturate(1)'],
      transition: { duration: 0.55, ease: 'easeOut' },
    });

  /** The pig with an egg he shouldn't have: a snorting laugh — shaking, puffing up, going greener. */
  const pigLaugh = () =>
    void enemyControls.start({
      x: [0, -5, 5, -5, 5, -3, 3, 0],
      scaleX: [1, 1.1, 1.06, 1.12, 1.05, 1.08, 1],
      scaleY: [1, 0.94, 0.97, 0.93, 0.97, 0.95, 1],
      filter: ['brightness(1) saturate(1)', 'brightness(1.2) saturate(1.7) hue-rotate(-10deg)', 'brightness(1) saturate(1)'],
      transition: { duration: 0.7, ease: 'easeInOut' },
    });

  /**
   * Plays out the moments a rep's abilities set off. The most important one gets the stamp —
   * a scream beats a crystal beats the rest — and a few get a move of the boss's own on top.
   */
  const playAbilityEvents = (events: AbilityEvent[]) => {
    if (!events.length) return;
    const ORDER: AbilityEvent[] = ['scream', 'scream-burned', 'scream-survived', 'crystal', 'treasury', 'retreat', 'bulwark-broken', 'frozen', 'covered', 'fee-paid', 'crit-blocked'];
    const top = ORDER.find((e) => events.includes(e)) ?? events[0];
    const id = ++popId;
    const stampAt = top === 'frozen' ? SHOT_FLY_S * 1000 : 0;
    window.setTimeout(() => setStamp({ id, event: top }), stampAt);
    window.setTimeout(() => setStamp((cur) => (cur?.id === id ? null : cur)), stampAt + 1300);

    // The scene for it, in the same order of importance as the word.
    const SCENES: Partial<Record<AbilityEvent, SceneKind>> = {
      scream: 'scream',
      'scream-burned': 'scream-burned',
      'scream-survived': 'scream-survived',
      crystal: 'crystal',
      retreat: 'retreat',
      frozen: 'freeze',
      covered: 'covered',
      treasury: 'treasury',
      'bulwark-broken': 'ice-shatter',
      'crit-blocked': 'karate-block',
    };
    const kind = SCENES[top];
    // Gru's freeze waits for the ray's bolt to reach him.
    if (kind === 'freeze') window.setTimeout(() => playScene(kind), SHOT_FLY_S * 1000);
    else if (kind) playScene(kind);

    if (events.includes('bulwark-broken')) feedback.iceShatter();
    if (events.includes('crit-blocked')) feedback.karateBlock();
    // An End crystal: the arrow into it, then the blast.
    if (events.includes('crystal')) {
      feedback.arrow();
      window.setTimeout(feedback.explosion, 280);
    }
    // The Titans covering Robin: Cyborg's cannon first, then Starfire's bolts.
    if (events.includes('covered')) {
      window.setTimeout(feedback.sonicCannon, 400);
      window.setTimeout(feedback.starbolts, 700);
      window.setTimeout(feedback.poof, 1000);
      // And the ring closing into a dome.
      window.setTimeout(feedback.shieldClank, 1800);
    }
    // Freddy: the shriek as he lunges, the camera's static as the feed comes on after it; the
    // clock striking six when you've lived through it.
    if (events.includes('scream')) {
      window.setTimeout(feedback.screech, 430);
      window.setTimeout(feedback.cameraStatic, 1400);
    }
    if (events.includes('scream-survived')) {
      window.setTimeout(feedback.sixAm, 450);
      window.setTimeout(feedback.yay, 950);
    }

    if (events.includes('fee-paid')) {
      // The till rings once the whole fee is in; the register itself is the rep's own scene.
      feedback.feePaid();
      krabsGreed();
    }

    if (events.includes('scream')) {
      // Freddy lunging at the screen; the scene does the blackout and the jump at you.
      void enemyControls.start({
        scale: [1, 1.55, 1.4, 1],
        rotate: [0, -4, 4, -3, 0],
        transition: { duration: 0.7, ease: 'easeOut' },
      });
    } else if (events.includes('retreat')) {
      // Skipper vanishes into Rico's smoke and the scene's copy of him does the sliding; he's
      // back in place as it slides home. The poof and the hiss of the slide go with it.
      void enemyControls.start({
        opacity: [1, 1, 0, 0, 1],
        transition: { duration: 2.3, times: [0, 0.29, 0.31, 0.93, 1] },
      });
      window.setTimeout(feedback.poof, 660);
      window.setTimeout(feedback.slide, 800);
      window.setTimeout(feedback.slide, 1450);
    } else if (events.includes('crystal')) {
      void enemyControls.start({
        scale: [1, 0.9, 1.06, 1],
        filter: ['brightness(1)', 'brightness(2.2)', 'brightness(1)'],
        transition: { duration: 0.5 },
      });
    } else if (events.includes('treasury')) {
      // The tsar rises on his gold, lit up by it.
      void enemyControls.start({
        y: [0, -18, -18, 0],
        scale: [1, 1.08, 1.08, 1],
        filter: ['brightness(1) sepia(0)', 'brightness(1.5) sepia(0.5)', 'brightness(1.3) sepia(0.3)', 'brightness(1) sepia(0)'],
        transition: { duration: 1.4, times: [0, 0.25, 0.7, 1] },
      });
    } else if (events.includes('frozen')) {
      void enemyControls.start({
        filter: ['hue-rotate(0deg) brightness(1)', 'hue-rotate(160deg) brightness(1.6)', 'hue-rotate(0deg) brightness(1)'],
        transition: { duration: 0.8, delay: SHOT_FLY_S },
      });
    }
  };

  /**
   * The dev panel's "play this" buttons. Run through the same paths a real rep takes — the scene,
   * and the stamp for the ones that have a word — so what you see is what a fight would show.
   * A moment's delay so the panel has closed and the screen has settled before it plays.
   */
  const devSceneRef = useRef<() => void>(() => {});
  devSceneRef.current = () => {
    const kind = takeDevScene();
    if (!kind) return;
    window.setTimeout(() => {
      if (kind === 'boss-intro') return playEntrance(boss.line);
      const STAMP_FOR: Partial<Record<SceneKind, AbilityEvent>> = {
        freeze: 'frozen',
        scream: 'scream',
        'scream-burned': 'scream-burned',
        'scream-survived': 'scream-survived',
        retreat: 'retreat',
        crystal: 'crystal',
        covered: 'covered',
        treasury: 'treasury',
        'karate-block': 'crit-blocked',
      };
      const event = STAMP_FOR[kind];
      if (event) playAbilityEvents([event]);
      else if (kind === 'penguins-wave' || kind === 'crown-roll') playScene(kind, hpBarRef.current?.getBoundingClientRect());
      else playScene(kind);
      // A boss's send-off holds the stage, as it does for real.
      if (kind === 'penguins-wave' || kind === 'minions-carry' || kind === 'pig-poof' || kind === 'coin-spill' || kind === 'dizzy' || kind === 'power-out' || kind === 'jack-box' || kind === 'smoke-cape' || kind === 'crown-roll' || kind === 'ender-death') {
        holdStage(SCENE_MS[kind]);
      }
    }, 400);
  };
  useEffect(() => {
    const run = () => devSceneRef.current();
    run();
    window.addEventListener(DEV_SCENE_EVENT, run);
    return () => window.removeEventListener(DEV_SCENE_EVENT, run);
  }, []);

  /** The boss walks out: the "BOSS" cut, the call, and his line if he has one. */
  const playEntrance = (line: BossDef['line']) => {
    feedback.bossEncounter(line);
    if (line) setTalking(true);
    // The cut to the boss. Cleared on a timer rather than by the animation, so a tab
    // backgrounded mid-flourish can't leave the veil hanging over the fight.
    setBossIntro(true);
    window.setTimeout(() => setBossIntro(false), BOSS_INTRO_SEC * 1000);
  };

  // The report comes once the cut has cleared and he's finished talking — never over his line,
  // however long it runs. (A boss with no line never starts talking, and a line that can't play
  // gives up within seconds; under reduced motion nothing tracks the talking, so the cut alone
  // decides.)
  useEffect(() => {
    if (bossIntro || (talking && !calm) || !briefAfterEntrance.current) return;
    const id = window.setTimeout(() => {
      if (!briefAfterEntrance.current) return;
      briefAfterEntrance.current = false;
      setBriefing(true);
    }, 400);
    return () => window.clearTimeout(id);
  }, [bossIntro, talking, calm]);

  const handleUndo = async () => {
    if (busyRef.current) return;
    const last = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    if (!last) return;
    busyRef.current = true;
    try {
      await revertRep(last);
    } finally {
      busyRef.current = false;
    }
  };

  if (derived.allBossesDefeated) {
    return (
      <div className="arena-page flex flex-col items-center pb-8 pt-16 text-center">
        <h1 className="mt-3 text-xl font-bold text-arena-text">Все боссы арены повержены</h1>
        <p className="mt-2 text-sm text-arena-text-dim">
          Ты прошёл всех {BOSSES.length} противников. Заходи в Speed Rush, чтобы продолжать качаться и бить рекорды.
        </p>
      </div>
    );
  }

  return (
    <div className="arena-page pb-8 pt-6">
      {/* A rematch says so, with the way out: the real progress waits until he falls or you leave. */}
      {derived.replaying && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-arena-amber/50 bg-arena-amber/10 px-3 py-2"
        >
          <span className="text-xs leading-snug text-arena-text">
            <b className="text-arena-amber">Перепрохождение</b> · твой этап {(profile.replay?.returnTo.currentBossIndex ?? 0) + 1}{' '}
            ждёт впереди
          </span>
          <button
            onClick={() => void endReplay()}
            className="shrink-0 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-semibold text-arena-text active:scale-95"
          >
            Выйти
          </button>
        </motion.div>
      )}

      {/* Where you are, written into the card's top edge rather than on a line of its own —
          every line saved here goes to the artwork. */}
      <div className="relative mb-2 mt-1 rounded-2xl border border-arena-border bg-arena-surface px-3 pb-1.5 pt-2.5">
        <div className="absolute inset-x-3 -top-2 flex justify-between text-[10px] leading-4 text-arena-text-dim">
          {/* Doubles as the way back into the scouting report. */}
          <button
            type="button"
            onClick={() => setBriefing(true)}
            className="pointer-events-auto flex items-center gap-1 rounded bg-arena-bg px-1.5 font-semibold text-arena-amber active:scale-95"
          >
            Этап {derived.bossIndex + 1} / {BOSSES.length} · <Search size={10} /> разведка
          </button>
          <span className="rounded bg-arena-bg px-1.5">{stageProgressLabel(derived.stageStep)}</span>
        </div>
        <StagePath boss={boss} step={derived.stageStep} color={boss.color} />
      </div>

      {/*
        No frame. The enemy is the screen, not an illustration inside a box — the card that used
        to hold him capped how large he could be and clipped him at its own edges.
      */}
      <motion.div
        animate={
          shake === 'crit'
            ? { x: [0, -11, 10, -7, 6, -3, 0], y: [0, 5, -6, 4, -2, 1, 0] }
            : shake === 'hit'
              ? { x: [0, -5, 5, -3, 2, 0], y: [0, 2, -1, 0, 0, 0] }
              : { x: 0, y: 0 }
        }
        transition={{ duration: shake === 'crit' ? 0.38 : 0.22 }}
        ref={stageRef}
        className="relative mb-2 text-center"
      >
        {/* The blow, over the enemy but outside him: it outlives the enemy it killed. */}
        <HitFx hit={hit} />
        {/* Soft washes rather than filled rectangles: with the box gone there are no edges for
            a solid colour to sit inside, so they bloom from the middle instead. */}
        <AbilityScene scene={scene} />
        <AbilityStamp stamp={stamp} />
        {flash === 'win' && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(245,158,11,0.85), transparent 68%)' }}
          />
        )}
        <AnimatePresence>
          {impact && (
            <motion.div
              key={impact}
              initial={{ opacity: impact === 'crit' ? 0.5 : 0.24 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: impact === 'crit' ? 0.32 : 0.2 }}
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.9), transparent 66%)' }}
            />
          )}
        </AnimatePresence>

        {/* Keyed by enemy: the one you just killed shrinks away before the next walks in. */}
        <div ref={enemyBoxRef} style={interlude != null ? { minHeight: interlude } : undefined}>
        <AnimatePresence mode="wait">
          {interlude == null && (
          <motion.div
            key={enemy.name}
            initial={{ opacity: 0, scale: 0.86, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 10, y: 16 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative flex flex-col items-center"
          >
            {enemy.isBoss && (
              <AbilityStatus
                boss={boss}
                fight={frostPending ? { ...profile.fight, frozenLeft: 0 } : profile.fight}
                pulse={jokePulse}
              />
            )}
            <div ref={artRef}>
            <motion.div animate={enemyControls} className="relative">
              {enemy.isBoss && hasAbility(boss.abilities, 'bulwark') && (
                <IceShield
                  // Not while he's walking out and saying his piece: the shield goes up once
                  // he's done talking, as the fight starts.
                  ready={!bossIntro && !talking}
                  hpFrac={profile.enemyHp / Math.max(1, profile.fight.enemyMaxHp || enemy.hp)}
                  hitId={hit?.id ?? null}
                />
              )}
              {enemy.isBoss && hasAbility(boss.abilities, 'retreat') && <RetreatPlaster used={!!profile.fight.retreatUsed} />}
              {enemy.isBoss && boss.id === 'nameless' && (
                <>
                  <EndHitParticles hitId={hit?.id ?? null} />
                  <DragonWeak active={hpFrac > 0 && hpFrac < 0.15} />
                </>
              )}
              {enemy.isBoss && hasAbility(boss.abilities, 'endCrystals') && (
                <EndCrystals
                  broken={profile.fight.crystalsBroken ?? 0}
                  progress={profile.fight.setReps % CRYSTAL_REPS}
                  of={CRYSTAL_REPS}
                />
              )}
              {!enemy.isBoss && hasAbility(boss.abilities, 'infection') && (
                <InfectionBadge left={Math.max(0, abilityValue(boss.abilities, 'infection') - profile.fight.repsOnEnemy)} />
              )}
              {enemy.isBoss && hasAbility(boss.abilities, 'treasury') && (
                <BogatyrWall left={profile.fight.guardLeft ?? 0} of={abilityValue(boss.abilities, 'treasury')} hitId={hit?.id ?? null} />
              )}
              {enemy.isBoss && hasAbility(boss.abilities, 'enrage') && (
                <EnrageEyes active={hpFrac > 0 && hpFrac < 0.4} eyes={boss.id === 'titanprime'} />
              )}
              {enemy.isBoss && hasAbility(boss.abilities, 'freezeRay') && (
                <IceBlock frozenLeft={profile.fight.frozenLeft ?? 0} of={abilityValue(boss.abilities, 'freezeRay')} />
              )}
              {enemy.isBoss ? (
                <BossTalk talk={talk} active={talking} color={boss.color}>
                  <BossIcon
                    boss={boss}
                    index={derived.bossIndex}
                    size={artWidth}
                    maxWidth={artRoom}
                    ratio={ART_RATIO}
                    maxShape={ART_MAX_SHAPE}
                    hug
                    bare
                  />
                </BossTalk>
              ) : (
                <EnemyIcon
                  file={enemy.icon}
                  color={boss.color}
                  tier={derived.stageStep * 0.18}
                  size={Math.round(artWidth * 0.92)}
                  maxWidth={Math.round(artRoom * 0.92)}
                  ratio={ART_RATIO}
                  maxShape={ART_MAX_SHAPE}
                  hug
                  bare
                  light={boss.artLight}
                />
              )}
            </motion.div>
            </div>

            {/* Under the picture, not over it: laid on top, the name and its scrim hid the
                bottom of the artwork. */}
            <div className="pointer-events-none relative mt-1 flex flex-col items-center text-center">
              <div className="relative flex items-center gap-2.5">
                <h2 className="text-3xl font-black leading-none text-arena-text md:text-4xl">
                  {enemy.name}
                </h2>
                <Heartbeat
                  pct={hpPct}
                  size={wide ? 26 : 21}
                  hearts={enemy.isBoss ? BOSS_HEARTS : MINION_HEARTS}
                />
              </div>
              {/* The title, and the boss's abilities as chips on the same line — a line of
                  their own each ate into the picture. Tap a chip for what it does. */}
              <div className="relative mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-2">
                <p className="text-xs leading-snug text-arena-text-dim md:text-sm">
                  {enemy.isBoss ? boss.title : `подчинённый ${boss.nameGenitive}`}
                </p>
                {enemy.isBoss &&
                  boss.abilities.map((a) => (
                    <button
                      key={a.kind}
                      type="button"
                      onClick={() => setOpenAbility((k) => (k === a.kind ? null : a.kind))}
                      aria-expanded={openAbility === a.kind}
                      className={clsx(
                        'pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight',
                        openAbility === a.kind
                          ? 'border-arena-amber bg-arena-amber/15 text-arena-amber'
                          : 'border-arena-amber/40 text-arena-amber',
                      )}
                    >
                      <Zap size={10} />
                      {abilityName(a)}
                    </button>
                  ))}
              </div>
              <AnimatePresence>
                {enemy.isBoss && openAbility && (
                  <motion.div
                    key={openAbility}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="pointer-events-auto absolute inset-x-4 top-full z-20 mt-1 rounded-xl border border-arena-amber/40 bg-arena-surface px-3 py-2 text-[11px] leading-snug text-arena-text shadow-lg"
                    onClick={() => setOpenAbility(null)}
                  >
                    {boss.abilities
                      .filter((a) => a.kind === openAbility)
                      .map((a) => (
                        <span key={a.kind}>
                          <b className="text-arena-amber">{abilityName(a)}</b> — {describeAbility(a)}
                        </span>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
        </div>

        <div className="mt-1">
          <PulseTrace pct={shownPct} className="h-7" />
        </div>

        <div ref={hpBarRef} className="relative mt-0.5 h-4 rounded-full bg-arena-surface-2">
          <motion.div
            className="h-full rounded-full bg-arena-red"
            animate={{ width: `${shownPct}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          />
          {enemy.isBoss && interlude == null && <HpMarks marks={hpMarks(boss, profile.fight)} pct={hpPct} />}
          {/* Under a quarter left the bar breathes — the moment you should push harder is the
              one moment the screen shouldn't be still. */}
          {interlude == null && hpPct > 0 && hpPct <= 25 && (
            <motion.div
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-0 rounded-full bg-arena-red blur-[3px]"
            />
          )}
        </div>
        <p className="mt-1 text-xs tabular-nums text-arena-text-dim">
          {interlude != null ? '\u00a0' : `${profile.enemyHp} / ${enemy.hp} HP`}
        </p>

        <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2">
          <AnimatePresence>
            {pops.map((p) => (
              <motion.span
                key={p.id}
                // Thrown out of the blow in a little arc: up and to one side, then settling.
                initial={{ opacity: 0, x: 0, y: 10, scale: 0.3, rotate: 0 }}
                animate={{
                  opacity: 1,
                  x: [0, p.x * 0.7, p.x],
                  y: [10, -52, -40],
                  // A crit overshoots harder and wobbles, so it punches above the ordinary rep.
                  scale: p.crit ? [0.3, 2.3, 1.6] : [0.3, 1.45, 1.1],
                  rotate: p.crit ? [0, -12, 8, -4, 0] : [0, p.x > 0 ? 6 : -6, 0],
                }}
                exit={{ opacity: 0, y: -70, scale: 0.8, transition: { duration: 0.25 } }}
                transition={{ duration: p.crit ? 0.55 : 0.42, ease: 'easeOut' }}
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl"
                style={{
                  fontFamily: "'Russo One', var(--font-sans)",
                  // Plain damage numbers wear your title's colour — one of the things a rank is for.
                  color: p.crit ? '#ff4d2e' : p.text.startsWith('-') ? derived.rank.color : '#e6e7eb',
                  // A dark outline keeps them readable over any part of the artwork.
                  textShadow: `-1.5px -1.5px 0 #0b0c0f, 1.5px -1.5px 0 #0b0c0f, -1.5px 1.5px 0 #0b0c0f, 1.5px 1.5px 0 #0b0c0f, 0 0 14px ${
                    p.crit ? '#ff4d2ecc' : p.text.startsWith('-') ? `${derived.rank.color}99` : '#00000000'
                  }`,
                }}
              >
                {p.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Gru's ray: the edges of the screen ice over while reps are frozen. */}
      <FrostOverlay active={enemy.isBoss && !frostPending && (profile.fight.frozenLeft ?? 0) > 0} />
      <LightsFlicker active={screamNear} />
      <EnderAmbient
        active={enemy.isBoss && !derived.allBossesDefeated && boss.id === 'nameless' && interlude == null && !bossIntro}
        under={() => artRef.current?.getBoundingClientRect().bottom ?? null}
        onTeleport={feedback.teleport}
      />
      <TitansSignal
        // Only once something's at stake: the Titans undo a set's damage, and a set that has done
        // none (the one carried over from his last minion, say) has nothing to lose.
        enabled={
          !derived.allBossesDefeated &&
          enemy.isBoss &&
          hasAbility(boss.abilities, 'teamwork') &&
          interlude == null &&
          profile.fight.damageThisSet > 0
        }
        lastRepAt={profile.fight.lastRepAt}
        setReps={profile.fight.setReps}
        need={abilityValue(boss.abilities, 'teamwork')}
        breakMs={SET_BREAK_MS + perksFrom(profile.upgrades).breathMs}
        onBeep={feedback.communicator}
      />
      <LaughGas
        active={enemy.isBoss && !derived.allBossesDefeated && hasAbility(boss.abilities, 'jokerCard') && interlude == null}
        under={() => artRef.current?.getBoundingClientRect().bottom ?? null}
      />
      <CameraFeed
        active={enemy.isBoss && !!profile.fight.scream}
        reps={profile.fight.scream?.reps ?? 0}
        need={abilityValue(boss.abilities, 'scream')}
      />
      <MomWatch
        enabled={!derived.allBossesDefeated && enemy.isBoss && hasAbility(boss.abilities, 'strictMom')}
        lastRepAt={profile.fight.lastRepAt}
        limitMs={abilityValue(boss.abilities, 'strictMom')}
      />
      <FreezeRayWarning
        enabled={
          !derived.allBossesDefeated &&
          enemy.isBoss &&
          hasAbility(boss.abilities, 'freezeRay') &&
          (profile.fight.frozenLeft ?? 0) === 0
        }
        lastRepAt={profile.fight.lastRepAt}
        fireMs={FREEZE_PAUSE_MS + perksFrom(profile.upgrades).breathMs}
        onFizzle={feedback.fizzle}
        aimAt={() => {
          const r = artRef.current?.getBoundingClientRect();
          return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        }}
      />

      <CameraPanel onRep={handleRep} onUndo={handleUndo} canUndo={undoDepth > 0} feedback={feedback} />

      {/* Floats over the top of the screen rather than taking a place in the layout: the fight
          screen is sized to fit a phone exactly, so a card in the flow would either push the
          counter off the bottom or sit below the fold where a newcomer never scrolls. */}
      <AnimatePresence>
        {fightHint && (
          <div className="safe-top arena-page fixed inset-x-0 top-0 z-30 pt-3">
            <HintCard icon={<Camera size={16} />} title="Как бить" onClose={dismissFightHint}>
              <p>
                Нажми <b className="text-arena-text">«Камера (AI)»</b>, поставь телефон на пол сбоку
                от себя, чтобы в кадр попадал ты целиком, — и отжимайся. Каждый повтор — удар.
              </p>
              <p className="mt-1">
                «+» — только кликер: считает нажатия, но босса не бьёт.
              </p>
            </HintCard>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {briefing && <BossBriefing key="briefing" boss={boss} index={derived.bossIndex} onClose={closeBriefing} />}
      </AnimatePresence>

      <AnimatePresence>
        {bossIntro && (
          <BossIntro
            key="boss-intro"
            boss={boss}
            index={derived.bossIndex}
            // Bigger than the fight screen's artwork, and bigger on a phone than it used to
            // be: stacked under the name there is a whole empty half-screen below it, and the
            // figure is the thing the cut is announcing. Still a share of the width rather
            // than a flat number, so a narrow phone does not get a picture wider than itself.
            // The height is a limit too, and only starts to bite on a short window: stacked
            // under the name on a phone, or beside the word on a laptop turned landscape,
            // a figure sized from the width alone runs off the top and bottom of the screen.
            size={Math.min(
              wide ? 440 : 330,
              Math.round(viewport.w * (wide ? 0.46 : 0.86)),
              Math.round(viewport.h * (wide ? 0.62 : 0.46)),
            )}
            // The sheets are wide scenes, so the width is what limits them, not `size`: held to
            // a portrait's width a wide picture came out barely a third of the screen tall.
            room={Math.round(Math.min(wide ? 620 : 430, viewport.w * (wide ? 0.48 : 0.86)))}
            wide={wide}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
