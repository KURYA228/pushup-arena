import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  AlertTriangle,
  Camera,
  Hand,
  Loader2,
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
import type { Strictness } from '../lib/repDetector';
import type { Feedback } from '../hooks/useFeedback';
import { bumpClicker } from '../hooks/useProfile';
import { usePlusCountsReps } from '../lib/devFlags';
import { db, PROFILE_ID } from '../db/db';

type Mode = 'manual' | 'camera';

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
  const [mode, setMode] = useState<Mode>('manual');
  const [showSettings, setShowSettings] = useState(false);
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
  const { snapshot } = pose;

  // One line telling the user why reps aren't registering — the previous version showed nothing,
  // so a hidden arm and a wrong threshold looked identical from the outside.
  let hint: { text: string; tone: 'warn' | 'info' } | null = null;
  if (pose.status === 'tracking') {
    if (pose.quality === 'no-pose') hint = { text: 'Не вижу тебя — попади целиком в кадр', tone: 'warn' };
    else if (pose.quality === 'arm-hidden') hint = { text: 'Не видно рук — разверни камеру вбок', tone: 'warn' };
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
          {/* The container follows the stream's own aspect ratio so the skeleton overlay lines up
              with the video instead of being stretched against a fixed 3:4 box. */}
          <div
            style={{ aspectRatio: String(pose.aspect) }}
            className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-arena-border bg-black md:max-w-md xl:max-w-lg"
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
              <>
                {/* Vertical depth gauge: fills as you descend, with a marker at the depth that
                    actually closes a rep. Makes "not deep enough" visible instead of silent. */}
                <div className="absolute bottom-3 left-3 top-3 w-2 overflow-hidden rounded-full bg-black/50">
                  <div
                    className={clsx(
                      'absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-75',
                      snapshot.depth >= snapshot.downAtDepth ? 'bg-arena-amber' : 'bg-arena-text-dim',
                    )}
                    style={{ height: `${snapshot.depth * 100}%` }}
                  />
                  <div
                    className="absolute inset-x-0 h-px bg-arena-red"
                    style={{ bottom: `${snapshot.downAtDepth * 100}%` }}
                  />
                </div>

                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1 text-[10px] tabular-nums text-arena-text-dim">
                  <span className="rounded-md bg-black/60 px-2 py-1">
                    {snapshot.angle != null ? `${snapshot.angle}°` : '—'}
                    {snapshot.rom != null && ` · размах ${snapshot.rom}°`}
                  </span>
                  <span className="rounded-md bg-black/60 px-2 py-1">{pose.fps} fps</span>
                </div>

                <button
                  onClick={pose.flipCamera}
                  aria-label="Переключить камеру"
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-arena-text active:scale-95"
                >
                  <SwitchCamera size={16} />
                </button>
              </>
            )}

            {isBusy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm text-arena-text-dim">
                <Loader2 className="animate-spin" size={22} />
                {pose.status === 'requesting-permission' ? 'Запрашиваем доступ к камере…' : 'Загружаем модель…'}
              </div>
            )}
            {pose.status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-4 text-center text-sm text-arena-red">
                <AlertTriangle size={22} />
                {pose.error}
              </div>
            )}
          </div>

          {hint && (
            <p
              className={clsx(
                'mt-2 text-center text-xs',
                hint.tone === 'warn' ? 'text-arena-red' : 'text-arena-text-dim',
              )}
            >
              {hint.text}
            </p>
          )}

          <div className="mt-2 flex justify-center gap-2">
            {pose.status === 'error' ? (
              <button
                onClick={() => void pose.start()}
                className="rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs font-medium text-arena-text"
              >
                Повторить попытку
              </button>
            ) : (
              <button
                onClick={pose.recalibrate}
                disabled={pose.status !== 'tracking'}
                className="flex items-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs font-medium text-arena-text disabled:opacity-40"
              >
                <RotateCcw size={13} /> Перекалибровать
              </button>
            )}
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

      {plusCounts ? (
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
