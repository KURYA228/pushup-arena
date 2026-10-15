import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  AlertTriangle,
  Camera,
  Hand,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  SwitchCamera,
  Vibrate,
  BellOff,
  Gauge,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePoseDetection, type ModelQuality } from '../hooks/usePoseDetection';
import { cameraLooksHeadOn, type Strictness } from '../lib/repDetector';
import { CHALLENGE_TEXT } from '../lib/liveness';
import { SCREEN_THRESHOLDS, type ScreenReadings, type TellName } from '../lib/screenTells';
import type { ScreenCheck } from '../hooks/usePoseDetection';
import type { Feedback } from '../hooks/useFeedback';
import { bumpClicker } from '../hooks/useProfile';
import { usePlusCountsReps } from '../lib/devFlags';
import { PushupGuy } from './PushupGuy';
import { db, PROFILE_ID } from '../db/db';

type Mode = 'manual' | 'camera';

const MODE_KEY = 'arena.counterMode';
const METER_KEY = 'arena.screenMeter';

/** What the understudy says on a counted rep — one per rep, round and round. */
const QUIPS = ['уф!', 'ещё!', 'красава', 'босс плачет', 'мощь', 'не сдавайся', 'легенда', 'пол дрожит', 'ага!', 'жми!'];
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'camera' ? 'camera' : 'manual';
  } catch {
    return 'manual';
  }
}

const STRICTNESS_LABELS: { id: Strictness; label: string }[] = [
  { id: 'soft', label: 'Мягко' },
  { id: 'normal', label: 'Обычно' },
  { id: 'strict', label: 'Строго' },
];

const MODEL_LABELS: { id: ModelQuality; label: string }[] = [
  { id: 'lite', label: 'Быстрая' },
  { id: 'full', label: 'Точная' },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-arena-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={clsx(
            'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
            value === o.id ? 'bg-arena-amber text-black' : 'text-arena-text-dim',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CameraPanel({
  onRep,
  onUndo,
  canUndo,
  feedback,
  disabled,
}: {
  onRep: () => void;
  /** Takes back the last counted rep — «−1», and a failed anti-cheat command, rep by rep. */
  onUndo: () => void | Promise<void>;
  /** Greys out the minus button when the undo stack is empty, instead of it doing nothing. */
  canUndo: boolean;
  feedback: Feedback;
  disabled?: boolean;
}) {
  // Remembered across screens and sessions: someone who counts with the camera shouldn't have to
  // switch it back on for every fight and every Rush.
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // No storage — it just won't be remembered.
    }
  };
  const [showSettings, setShowSettings] = useState(false);
  /** The screen-tell numbers on screen, for setting the thresholds from real runs. */
  const [meter, setMeterState] = useState(() => {
    try {
      return localStorage.getItem(METER_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setMeter = (on: boolean) => {
    setMeterState(on);
    try {
      localStorage.setItem(METER_KEY, on ? '1' : '0');
    } catch {
      // Not remembered — harmless.
    }
  };
  /** The camera thumbnail blown up to full width — for setting the phone down, not for the set. */
  const [bigPreview, setBigPreview] = useState(false);
  /** Dev switch: «+» lands a real rep instead of a clicker tap. */
  const plusCounts = usePlusCountsReps();
  /** Taps made on this screen, so «−» in manual mode can take back exactly those and no more. */
  const [sessionTaps, setSessionTaps] = useState(0);
  const clickerTotal = useLiveQuery(() => db.profile.get(PROFILE_ID).then((p) => p?.clickerTaps ?? 0), []) ?? 0;

  /**
   * Camera reps actually handed to the game since the last anti-cheat command was passed — the
   * most a failed one may take back. The detector can count a rep the game then ignores (the
   * fight is locked for a scene), and undoing for that one would take an honest rep instead.
   */
  const unconfirmedRef = useRef(0);

  // Only the camera counts reps. The game — damage, XP, streak, the total — moves on nothing else.
  const pose = usePoseDetection(() => {
    if (disabled) return;
    unconfirmedRef.current += 1;
    onRep();
  });

  /**
   * «+» is a clicker: it counts presses and nothing more. A tap can't tell a push-up from a
   * finger, so it stays out of the game entirely and keeps its own tally instead.
   */
  const addByHand = () => {
    if (disabled) return;
    if (plusCounts) {
      onRep();
      return;
    }
    void bumpClicker(1);
    setSessionTaps((n) => n + 1);
    feedback.rep();
  };

  // «−» undoes whatever the current mode adds: a tap in manual mode, a counted rep on camera.
  // With the dev switch on, «+» adds reps, so «−» takes reps back in both modes.
  const undoesClicks = mode === 'manual' && !plusCounts;
  const canTakeBack = undoesClicks ? sessionTaps > 0 : canUndo;
  const takeBack = () => {
    if (disabled || !canTakeBack) return;
    if (undoesClicks) {
      void bumpClicker(-1);
      setSessionTaps((n) => n - 1);
    } else {
      unconfirmedRef.current = Math.max(0, unconfirmedRef.current - 1);
      void onUndo();
    }
  };

  const { start, stop } = pose;
  useEffect(() => {
    if (mode === 'camera') void start();
    else stop();
  }, [mode, start, stop]);

  // The anti-cheat command (lib/liveness.ts): said out loud once when it's given, and a short
  // cue once it's done. Keyed by ids so a re-render never says it twice.
  const live = pose.liveness;
  const saidRef = useRef({ challenge: live.challengeId, passed: live.passedId, failed: live.failedId });
  const undoRef = useRef(onUndo);
  undoRef.current = onUndo;
  // A failed command takes back every rep since the last one passed — the same undo as «−1», so
  // damage, XP and the day's count all go back with it.
  useEffect(() => {
    const said = saidRef.current;
    if (live.failedId === said.failed) return;
    said.failed = live.failedId;
    const n = Math.min(live.revoked, unconfirmedRef.current);
    unconfirmedRef.current = 0;
    if (n <= 0) return;
    void (async () => {
      for (let i = 0; i < n; i++) await undoRef.current();
    })();
  }, [live.failedId, live.revoked]);
  const { challenge: sayChallenge, challengePassed } = feedback;
  useEffect(() => {
    const said = saidRef.current;
    if (live.challengeId !== said.challenge) {
      said.challenge = live.challengeId;
      if (live.kind && mode === 'camera') sayChallenge(CHALLENGE_TEXT[live.kind]);
    }
    if (live.passedId !== said.passed) {
      said.passed = live.passedId;
      unconfirmedRef.current = 0;
      if (mode === 'camera') challengePassed();
    }
  }, [live.challengeId, live.passedId, live.kind, mode, sayChallenge, challengePassed]);
  const checking = mode === 'camera' && pose.status === 'tracking' && live.state !== 'counting';

  const isBusy = pose.status === 'requesting-permission' || pose.status === 'loading-model';
  /** Someone in view, in a push-up position — the understudy copies them; otherwise he sleeps. */
  const following = pose.status === 'tracking' && pose.quality === 'ok' && pose.snapshot.posture === 'ok';
  const { snapshot } = pose;

  // One line telling the user why reps aren't registering — the previous version showed nothing,
  // so a hidden arm and a wrong threshold looked identical from the outside.
  let hint: { text: string; tone: 'warn' | 'info' } | null = null;
  if (pose.status === 'tracking' && live.state !== 'counting') {
    hint = { text: 'Проверка: выполни команду сверху — до этого повторы не считаются', tone: 'warn' };
  } else if (pose.status === 'tracking') {
    if (pose.quality === 'no-pose') hint = { text: 'Не вижу тебя — попади целиком в кадр', tone: 'warn' };
    else if (pose.quality === 'arm-hidden') hint = { text: 'Не видно рук — разверни камеру вбок', tone: 'warn' };
    // Posture first: if it isn't a push-up position, nothing else on this list matters.
    else if (snapshot.posture === 'unknown')
      hint = { text: 'Не видно корпуса — отодвинь телефон, чтобы в кадре были плечи и бёдра', tone: 'warn' };
    else if (snapshot.posture === 'upright')
      hint = { text: 'Прими упор лёжа — стоя и сидя повторы не считаются', tone: 'info' };
    // Checked before "waiting for the body": from the front a real push-up fails both tests,
    // and only this one tells you what to actually change.
    else if (cameraLooksHeadOn(snapshot))
      hint = { text: 'Сгиб локтей почти не виден — поставь телефон сбоку от себя, на уровне пола', tone: 'warn' };
    else if (!snapshot.bodyEngaged)
      hint = { text: 'Жду движения корпуса — движения одной рукой не считаются', tone: 'info' };
    else if (!snapshot.calibrated)
      hint = { text: 'Подстраиваюсь под тебя — сделай 2–3 отжимания', tone: 'info' };
  }

  return (
    <div className="w-full">
      {/* The command, over everything at the top of the screen: big enough to read from the floor. */}
      {checking && (
        <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-2">
          <div
            className={clsx(
              'w-full max-w-md rounded-2xl border-2 px-4 py-3 text-center shadow-2xl',
              live.state === 'blocked' ? 'border-arena-red bg-arena-bg/95' : 'border-arena-amber bg-arena-bg/95',
            )}
          >
            {live.state === 'blocked' ? (
              <>
                <p className="text-lg font-black uppercase text-arena-red">Не успел</p>
                <p className="mt-0.5 text-xs text-arena-text-dim">
                  {live.revoked > 0
                    ? `Отменено повторов: ${live.revoked}. Сейчас будет новая команда`
                    : 'Повторы не считаются — сейчас будет новая команда'}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-arena-text-dim">Проверка, что это ты</p>
                <p className="mt-0.5 text-2xl font-black uppercase text-arena-amber">
                  {live.kind ? CHALLENGE_TEXT[live.kind] : ''}
                </p>
                <p className="mt-0.5 text-xs text-arena-text-dim">
                  {live.kind === 'hold-top' ? 'Руки прямые, не двигайся 2 секунды' : 'Оторви руку от пола и вытяни вперёд'} ·{' '}
                  <span className="tabular-nums text-arena-text">{live.secondsLeft} с</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-arena-surface-2">
                  <div className="h-full rounded-full bg-arena-amber transition-[width] duration-100" style={{ width: `${live.progress * 100}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-3 flex justify-center gap-2">
        <button
          onClick={() => setMode('manual')}
          className={clsx(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'manual' ? 'bg-arena-amber text-black' : 'bg-arena-surface-2 text-arena-text-dim',
          )}
        >
          <Hand size={14} /> Вручную
        </button>
        <button
          onClick={() => setMode('camera')}
          className={clsx(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'camera' ? 'bg-arena-amber text-black' : 'bg-arena-surface-2 text-arena-text-dim',
          )}
        >
          <Camera size={14} /> Камера (AI)
        </button>
      </div>

      {mode === 'camera' && (
        <div className="mb-3">
          {/*
            Compact by default: a thumbnail with the skeleton and the depth gauge, and the hint and
            controls beside it. Mid-set the boss is what you want to see — the full-size preview
            used to push him off the screen. Tap the thumbnail to blow it up while you set the
            phone down, tap again to shrink it. The same <video> both ways, so the stream is
            never interrupted by the switch.
          */}
          <div
            className={clsx(
              'flex gap-3 rounded-2xl border border-arena-border bg-arena-surface p-2',
              bigPreview ? 'flex-col items-center' : 'items-stretch',
            )}
          >
            <button
              type="button"
              onClick={() => setBigPreview((b) => !b)}
              aria-label={bigPreview ? 'Уменьшить камеру' : 'Увеличить камеру, чтобы выставить кадр'}
              style={{ aspectRatio: String(pose.aspect) }}
              className={clsx(
                'relative shrink-0 overflow-hidden rounded-xl bg-black',
                bigPreview ? 'w-full max-w-xs md:max-w-md' : 'w-24',
              )}
            >
              <video
                ref={pose.videoRef}
                playsInline
                muted
                className={clsx('h-full w-full object-cover', pose.mirrored && '-scale-x-100')}
              />
              <canvas
                ref={pose.canvasRef}
                className={clsx('absolute inset-0 h-full w-full', pose.mirrored && '-scale-x-100')}
              />

              {pose.status === 'tracking' && (
                // Vertical depth gauge: fills as you descend, with a marker at the depth that
                // actually closes a rep. Makes "not deep enough" visible instead of silent.
                <div
                  className={clsx(
                    'absolute left-1.5 overflow-hidden rounded-full bg-black/50',
                    bigPreview ? 'bottom-3 top-3 w-2' : 'bottom-1.5 top-1.5 w-1.5',
                  )}
                >
                  <div
                    className={clsx(
                      'absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-75',
                      snapshot.depth >= snapshot.downAtDepth ? 'bg-arena-amber' : 'bg-arena-text-dim',
                    )}
                    style={{ height: `${snapshot.depth * 100}%` }}
                  />
                  <div className="absolute inset-x-0 h-px bg-arena-red" style={{ bottom: `${snapshot.downAtDepth * 100}%` }} />
                </div>
              )}

              {isBusy && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-arena-text-dim">
                  <Loader2 className="animate-spin" size={bigPreview ? 22 : 16} />
                </span>
              )}
              {pose.status === 'error' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/85 text-arena-red">
                  <AlertTriangle size={bigPreview ? 22 : 16} />
                </span>
              )}

            </button>

            <div className={clsx('flex min-w-0 flex-1 flex-col justify-between gap-1.5', bigPreview && 'w-full')}>
              {/* What's going on, in one line: loading, an error, or why reps aren't counting. */}
              <p
                className={clsx(
                  'text-xs leading-snug',
                  pose.status === 'error' || hint?.tone === 'warn' ? 'text-arena-red' : 'text-arena-text-dim',
                  bigPreview && 'text-center',
                )}
              >
                {pose.status === 'requesting-permission'
                  ? 'Запрашиваем доступ к камере…'
                  : pose.status === 'loading-model'
                    ? 'Загружаем распознавание… В первый раз — до минуты, дальше быстро.'
                    : pose.status === 'error'
                      ? pose.error
                      : (hint?.text ?? 'Считаю отжимания — каждый повтор бьёт по врагу')}
              </p>

              {/* Something the camera changed on its own — said once, dismissable. */}
              {pose.notice && pose.status === 'tracking' && (
                <button
                  type="button"
                  onClick={pose.dismissNotice}
                  className={clsx('rounded-lg bg-arena-amber/10 px-2 py-1 text-left text-[10px] leading-snug text-arena-amber', bigPreview && 'text-center')}
                >
                  {pose.notice} ✕
                </button>
              )}
              {pose.status === 'tracking' && (
                <>
                  <p className={clsx('text-[10px] tabular-nums text-arena-text-dim', bigPreview && 'text-center')}>
                    {snapshot.angle != null ? `${snapshot.angle}°` : '—'}
                    {snapshot.rom != null && ` · размах ${snapshot.rom}°`} · {pose.fps} fps
                  </p>
                  {/* The understudy: a legionary who pushes along while the camera sees you,
                      cheers each counted rep, and sleeps while there's nobody to copy. Fills the
                      empty corner, and it's a second way to see the camera really is following
                      you. */}
                  {!bigPreview && (
                    <div className="flex justify-center">
                      <PushupGuy
                        className="h-[88px] w-[112px]"
                        mode={following ? 'follow' : 'sleep'}
                        repKey={snapshot.reps}
                        quip={QUIPS[snapshot.reps % QUIPS.length]}
                      />
                    </div>
                  )}
                </>
              )}

              <div className={clsx('flex flex-wrap gap-1.5', bigPreview && 'justify-center')}>
                {pose.status === 'error' ? (
                  <button
                    onClick={() => void pose.start()}
                    className="rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-medium text-arena-text"
                  >
                    Повторить попытку
                  </button>
                ) : (
                  <>
                    {/* «−1» lives here in camera mode, so the whole counter fits beside the boss
                        instead of a button row below the fold. */}
                    <button
                      onClick={takeBack}
                      disabled={disabled || !canTakeBack}
                      aria-label="Убрать одно повторение"
                      className="flex items-center gap-1 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-medium text-arena-text disabled:opacity-40"
                    >
                      <Minus size={12} /> 1
                    </button>
                    {/* Spelled out as its own button beside the picture, rather than a label on
                        it — a caption over the video read as part of the video. The thumbnail
                        itself still toggles too. */}
                    <button
                      onClick={() => setBigPreview((b) => !b)}
                      className="flex items-center gap-1 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-medium text-arena-text"
                    >
                      {bigPreview ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      {bigPreview ? 'Свернуть' : 'Крупнее'}
                    </button>
                    <button
                      onClick={pose.recalibrate}
                      disabled={pose.status !== 'tracking'}
                      className="flex items-center gap-1 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-medium text-arena-text disabled:opacity-40"
                    >
                      <RotateCcw size={12} /> Калибровка
                    </button>
                    <button
                      onClick={pose.flipCamera}
                      disabled={pose.status !== 'tracking'}
                      aria-label="Переключить камеру"
                      className="flex items-center gap-1 rounded-lg bg-arena-surface-2 px-2.5 py-1 text-[11px] font-medium text-arena-text disabled:opacity-40"
                    >
                      <SwitchCamera size={12} /> Камера
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings sit outside the camera block: sound and vibration matter in manual mode too,
          and hiding them behind the camera toggle made them unreachable there. */}
      <div className="mb-3 flex justify-center">
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs font-medium text-arena-text"
        >
          <Settings2 size={13} /> Настройки
        </button>
      </div>

      {showSettings && (
        <div className="mb-3 space-y-3 rounded-xl border border-arena-border bg-arena-surface p-3">
          <div>
            <p className="mb-1.5 text-[11px] text-arena-text-dim">
              Отклик на засчитанный повтор — лёжа лицом в пол экрана не видно
            </p>
            <div className="space-y-1.5">
              <Toggle
                icon={feedback.prefs.sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
                label="Звук"
                checked={feedback.prefs.sound}
                onChange={feedback.setSound}
              />
              {feedback.prefs.sound && (
                <Toggle
                  icon={<BellOff size={14} />}
                  label="Даже в беззвучном режиме"
                  checked={feedback.prefs.loud}
                  onChange={feedback.setLoud}
                  note={
                    feedback.canBeLoud
                      ? 'может ставить на паузу музыку из других приложений'
                      : 'не поддерживается этим браузером (нужен iOS 16.4+)'
                  }
                />
              )}
              <Toggle
                icon={<Vibrate size={14} />}
                label="Вибрация"
                checked={feedback.prefs.vibration}
                onChange={feedback.setVibration}
                note={feedback.canVibrate ? undefined : 'не поддерживается этим браузером'}
              />
            </div>
          </div>

          {mode === 'camera' && (
            <>
              <div>
                <p className="mb-1 text-[11px] text-arena-text-dim">
                  Засчитывать повтор — если считает лишнее, ставь «Строго»
                </p>
                <Segmented
                  value={pose.strictness}
                  options={STRICTNESS_LABELS}
                  onChange={pose.setStrictness}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-arena-text-dim">
                  Модель — «Точная» распознаёт лучше, но тяжелее для телефона
                </p>
                <Segmented value={pose.model} options={MODEL_LABELS} onChange={pose.setModel} />
              </div>
              <Toggle
                icon={<Gauge size={14} />}
                label="Замеры детектора экрана"
                checked={meter}
                onChange={setMeter}
                note="для настройки защиты от видео"
              />
            </>
          )}
        </div>
      )}

      {mode === 'camera' && meter && pose.status === 'tracking' && <ScreenMeter check={pose.screenCheck} />}

      {/* The −/+ row is manual mode only. With the camera on there's no "+": the camera is the
          count, and a button beside it only invites tapping instead of pushing. Its «−1» moves
          into the camera strip above. */}
      {mode === 'manual' && (
      <div className="relative flex items-center justify-center gap-4">
        <button
          onClick={takeBack}
          disabled={disabled || !canTakeBack}
          aria-label={undoesClicks ? 'Убрать одно нажатие кликера' : 'Убрать одно повторение'}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-arena-border bg-arena-surface-2 text-arena-text-dim active:scale-95 disabled:opacity-30"
        >
          <Minus size={20} />
        </button>
        <motion.button
          onClick={addByHand}
          disabled={disabled}
          aria-label={plusCounts ? 'Добавить одно повторение (dev)' : 'Кликер: добавить нажатие'}
          whileTap={{ scale: 0.9 }}
          className="arena-glow flex h-16 w-16 items-center justify-center rounded-full bg-arena-amber text-black active:scale-95 disabled:opacity-30"
        >
          <Plus size={26} strokeWidth={2.6} />
        </motion.button>
        <div className="w-12" />
      </div>
      )}

      {/* Nothing under the button while the dev switch has «+» counting reps: the switch lives
          in the dev panel, and a warning line on the fight screen only got in the way. */}
      {mode === 'camera' || plusCounts ? null : (
      <p className="mt-2 text-center text-[11px] leading-snug text-arena-text-dim">
        <span className="font-semibold uppercase tracking-wider text-arena-amber">Кликер</span>{' '}
        <span className="tabular-nums text-arena-text">{clickerTotal}</span>
        {sessionTaps > 0 && <span className="tabular-nums"> (+{sessionTaps})</span>} · в зачёт идут
        только отжимания с камеры
      </p>
      )}
    </div>
  );
}

const TELL_ROWS: { tell: TellName; label: string; value: (r: ScreenReadings) => string; limit: string }[] = [
  {
    tell: 'glow',
    label: 'Свечение',
    value: (r) => `${r.glow.toFixed(2)} · края ${Math.round(r.edgeLuma)}`,
    limit: `≥${SCREEN_THRESHOLDS.glow} и края ≤${SCREEN_THRESHOLDS.maxEdgeLuma}`,
  },
  { tell: 'border', label: 'Рамка', value: (r) => r.border.toFixed(2), limit: `≥${SCREEN_THRESHOLDS.border}` },
  { tell: 'bands', label: 'Полосы', value: (r) => r.bands.toFixed(2), limit: `≥${SCREEN_THRESHOLDS.bands}` },
  { tell: 'moire', label: 'Муар', value: (r) => r.moire.toFixed(2), limit: `≥${SCREEN_THRESHOLDS.moire}` },
  { tell: 'glare', label: 'Блики', value: (r) => r.glare.toFixed(2), limit: `≥${SCREEN_THRESHOLDS.glare}` },
  { tell: 'small', label: 'Размер тела', value: (r) => r.size.toFixed(2), limit: `≤${SCREEN_THRESHOLDS.maxSize}` },
];

/**
 * The screen-tell readings, live. For two runs side by side — yourself, then a video of
 * push-ups on another screen — so the thresholds in lib/screenTells.ts can be set from what a
 * real phone actually sees.
 */
function ScreenMeter({ check }: { check: ScreenCheck }) {
  const r = check.readings;
  return (
    <div className="mb-3 rounded-xl border border-arena-border bg-arena-surface p-3 text-[11px]">
      <p className="mb-1.5 flex items-center justify-between text-arena-text-dim">
        <span>Замеры детектора экрана</span>
        <span className={clsx('font-semibold', check.tells.length >= 3 ? 'text-arena-red' : check.tells.length >= 2 ? 'text-arena-amber' : 'text-arena-text')}>
          признаков: {check.tells.length}
        </span>
      </p>
      {!r ? (
        <p className="text-arena-text-dim">Жду, когда ты появишься в кадре…</p>
      ) : (
        <div className="space-y-0.5 tabular-nums">
          {TELL_ROWS.map((row) => {
            const on = check.tells.includes(row.tell);
            return (
              <div key={row.tell} className="flex items-baseline gap-2">
                <span className={clsx('w-24 shrink-0', on ? 'font-semibold text-arena-red' : 'text-arena-text')}>
                  {on ? '● ' : ''}
                  {row.label}
                </span>
                <span className={clsx('flex-1', on ? 'text-arena-red' : 'text-arena-text')}>{row.value(r)}</span>
                <span className="text-[10px] text-arena-text-dim">{row.limit}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  note?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center gap-2 rounded-lg bg-arena-surface-2 px-2.5 py-2 text-left"
    >
      <span className={clsx('shrink-0', checked ? 'text-arena-amber' : 'text-arena-text-dim')}>{icon}</span>
      <span className="flex-1 text-xs text-arena-text">
        {label}
        {note && <span className="ml-1 text-[10px] text-arena-text-dim">({note})</span>}
      </span>
      <span
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-arena-amber' : 'bg-arena-border',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
