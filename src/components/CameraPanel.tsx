import { useEffect, useState } from 'react';
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
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePoseDetection, type ModelQuality } from '../hooks/usePoseDetection';
import { cameraLooksHeadOn, type Strictness } from '../lib/repDetector';
import type { Feedback } from '../hooks/useFeedback';
import { bumpClicker } from '../hooks/useProfile';
import { usePlusCountsReps } from '../lib/devFlags';
import { PushupGuy } from './PushupGuy';
import { db, PROFILE_ID } from '../db/db';

type Mode = 'manual' | 'camera';

const MODE_KEY = 'arena.counterMode';

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
  onUndo: () => void;
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
  /** The camera thumbnail blown up to full width — for setting the phone down, not for the set. */
  const [bigPreview, setBigPreview] = useState(false);
  /** Dev switch: «+» lands a real rep instead of a clicker tap. */
  const plusCounts = usePlusCountsReps();
  /** Taps made on this screen, so «−» in manual mode can take back exactly those and no more. */
  const [sessionTaps, setSessionTaps] = useState(0);
  const clickerTotal = useLiveQuery(() => db.profile.get(PROFILE_ID).then((p) => p?.clickerTaps ?? 0), []) ?? 0;

  // Only the camera counts reps. The game — damage, XP, streak, the total — moves on nothing else.
  const pose = usePoseDetection(() => {
    if (disabled) return;
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
    } else onUndo();
  };

  const { start, stop } = pose;
  useEffect(() => {
    if (mode === 'camera') void start();
    else stop();
  }, [mode, start, stop]);

  const isBusy = pose.status === 'requesting-permission' || pose.status === 'loading-model';
  /** Someone in view, in a push-up position — the understudy copies them; otherwise he sleeps. */
  const following = pose.status === 'tracking' && pose.quality === 'ok' && pose.snapshot.posture === 'ok';
  const { snapshot } = pose;

  // One line telling the user why reps aren't registering — the previous version showed nothing,
  // so a hidden arm and a wrong threshold looked identical from the outside.
  let hint: { text: string; tone: 'warn' | 'info' } | null = null;
  if (pose.status === 'tracking') {
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
                    ? 'Загружаем распознавание…'
                    : pose.status === 'error'
                      ? pose.error
                      : (hint?.text ?? 'Считаю отжимания — каждый повтор бьёт по врагу')}
              </p>

              {pose.status === 'tracking' && (
                <>
                  <p className={clsx('text-[10px] tabular-nums text-arena-text-dim', bigPreview && 'text-center')}>
                    {snapshot.angle != null ? `${snapshot.angle}°` : '—'}
                    {snapshot.rom != null && ` · размах ${snapshot.rom}°`} · {pose.fps} fps
                  </p>
                  {/* The understudy: a little legionary who copies you — down when you go down,
                      a bounce and a quip on every counted rep, asleep while there's nobody to
                      copy. Fills the empty corner, and it's a second way to see the camera
                      really is following you. Centred in the column rather than pushed to its
                      edge, so his Zs have room to rise. */}
                  {!bigPreview && (
                    <div className="flex justify-end pr-6">
                      <PushupGuy
                        className="-my-2 h-[80px] w-[188px]"
                        bare
                        mode={following ? 'follow' : 'sleep'}
                        depth={snapshot.depth}
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
            </>
          )}
        </div>
      )}

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

      {mode === 'camera' ? null : plusCounts ? (
        <p className="mt-2 text-center text-[11px] leading-snug text-arena-red">
          DEV: «+» засчитывает отжимание — выключается в дев-панели
        </p>
      ) : (
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
