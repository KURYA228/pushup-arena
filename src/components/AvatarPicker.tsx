import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Loader2, Lock, Type, X } from 'lucide-react';
import clsx from 'clsx';
import { AVATAR_GALLERY } from '../lib/avatar';
import { bossArtUrl } from '../lib/bossArt';
import { Avatar } from './PlayerBadge';

/**
 * Choosing an avatar: a photo off the phone, the letter of your name, or a portrait from the arena
 * — but those are earned: a boss's face once you've beaten him, a minion's once you're past him.
 * The rest show locked and say what it takes. A pick saves at once; the big preview at the top
 * shows what everyone will see on the board.
 */
export function AvatarPicker({
  name,
  level,
  avatar,
  unlocked,
  onPick,
  onUpload,
  onClose,
}: {
  name: string;
  level?: number;
  avatar: string | null;
  /** The gallery portraits earned so far (src/lib/avatar.ts `unlockedAvatars`). */
  unlocked: Set<string>;
  /** Saves a gallery pick, or null for the letter. Resolves to an error message, or null. */
  onPick: (value: string | null) => Promise<{ message: string } | null>;
  /** Uploads a photo and makes it the avatar. */
  onUpload: (file: File) => Promise<{ message: string } | null>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** What's being saved right now: a gallery value, 'photo', 'letter' — or nothing. */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What a tapped locked portrait takes to earn. */
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (what: string, job: () => Promise<{ message: string } | null>) => {
    if (busy) return;
    setBusy(what);
    setError(null);
    setHint(null);
    try {
      const err = await job();
      if (err) setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Аватарка"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-sm flex-col rounded-3xl border border-arena-border bg-arena-surface p-5"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <p className="text-center text-[11px] uppercase tracking-widest text-arena-text-dim">Аватарка</p>
        {/* What everyone sees on the board. */}
        <motion.div key={avatar ?? 'letter'} className="mt-3 flex justify-center" initial={{ scale: 0.85 }} animate={{ scale: 1 }}>
          <Avatar name={name} avatar={avatar} level={level} size="lg" />
        </motion.div>
        <p className="mt-2 text-center text-[11px] text-arena-text-dim">Так тебя увидят в таблице лидеров</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-arena-amber px-3 py-2.5 text-xs font-bold text-black active:scale-[0.98] disabled:opacity-60"
          >
            {busy === 'photo' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Своё фото
          </button>
          <button
            type="button"
            onClick={() => void run('letter', () => onPick(null))}
            disabled={!!busy || !avatar}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-arena-surface-2 px-3 py-2.5 text-xs font-medium text-arena-text active:scale-[0.98] disabled:opacity-50"
          >
            {busy === 'letter' ? <Loader2 size={14} className="animate-spin" /> : <Type size={14} />}
            Буква имени
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so picking the same file again still fires.
            e.target.value = '';
            if (file) void run('photo', () => onUpload(file));
          }}
        />

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] leading-snug text-red-300">{error}</p>}

        <p className="mt-4 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wider text-arena-text-dim">
          <span>Или кто-то с арены</span>
          <span className="normal-case tracking-normal">
            открыто {unlocked.size} из {AVATAR_GALLERY.length}
          </span>
        </p>
        {hint && <p className="mt-2 rounded-lg bg-arena-surface-2 px-3 py-2 text-[11px] leading-snug text-arena-text-dim">{hint}</p>}
        <div className="-mx-1 mt-2 grid min-h-0 flex-1 auto-rows-max grid-cols-4 content-start gap-2 overflow-y-auto px-1 pb-1">
          {AVATAR_GALLERY.map((g) => {
            const on = avatar === g.value;
            const open = unlocked.has(g.value);
            return (
              <button
                key={g.value}
                type="button"
                title={open ? g.label : g.hint}
                aria-label={open ? g.label : `${g.label} — закрыто. ${g.hint}`}
                aria-pressed={on}
                disabled={!!busy}
                onClick={() => (open ? void run(g.value, () => onPick(g.value)) : setHint(g.hint))}
                className={clsx(
                  'relative aspect-square overflow-hidden rounded-full border-2 transition active:scale-95',
                  on ? 'border-arena-amber' : 'border-transparent',
                )}
              >
                <img
                  src={bossArtUrl(g.file, true)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={clsx('h-full w-full select-none object-cover', !open && 'opacity-30 blur-[2px] grayscale')}
                  style={{ objectPosition: '50% 25%' }}
                />
                {!open && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Lock size={16} className="text-arena-text-dim" />
                  </span>
                )}
                {(on || busy === g.value) && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {busy === g.value ? <Loader2 size={16} className="animate-spin text-white" /> : <Check size={18} className="text-arena-amber" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
