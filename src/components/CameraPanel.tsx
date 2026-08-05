import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { usePoseDetection, type ModelQuality } from '../hooks/usePoseDetection';
import type { Strictness } from '../lib/repDetector';

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
  disabled,
}: {
  onRep: () => void;
  onUndo: () => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('manual');
  const [showSettings, setShowSettings] = useState(false);
  const pose = usePoseDetection(() => {
    if (!disabled) onRep();
  });

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
            className="relative mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-arena-border bg-black"
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
              <>
                <button
                  onClick={pose.recalibrate}
                  disabled={pose.status !== 'tracking'}
                  className="flex items-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs font-medium text-arena-text disabled:opacity-40"
                >
                  <RotateCcw size={13} /> Перекалибровать
                </button>
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="flex items-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs font-medium text-arena-text"
                >
                  <Settings2 size={13} /> Настройки
                </button>
              </>
            )}
          </div>

          {showSettings && (
            <div className="mt-2 space-y-2 rounded-xl border border-arena-border bg-arena-surface p-3">
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
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onUndo}
          disabled={disabled}
          aria-label="Убрать одно повторение"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-arena-border bg-arena-surface-2 text-arena-text-dim active:scale-95 disabled:opacity-30"
        >
          <Minus size={20} />
        </button>
        <button
          onClick={() => !disabled && onRep()}
          disabled={disabled}
          aria-label="Добавить одно повторение"
          className="arena-glow flex h-16 w-16 items-center justify-center rounded-full bg-arena-amber text-black active:scale-95 disabled:opacity-30"
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
        <div className="w-12" />
      </div>
    </div>
  );
}
