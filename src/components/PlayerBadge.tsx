import { getRank, glows } from '../data/ranks';
import clsx from 'clsx';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { avatarSrc } from '../lib/avatar';

/**
 * A player's avatar: the picture they chose (a portrait from the gallery or their own photo, see
 * src/lib/avatar.ts), or else the first letter of the name over a colour derived from the name
 * itself — a board of identical grey rows is unreadable, a stable colour per player makes finding
 * yourself instant.
 */

/** FNV-style fold: small, stable across reloads, and spread evenly enough over the wheel. */
function hueOf(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/** The Бессмертный crown, in px, for each avatar size — big enough to read as a crown. */
const CROWN_PX = { sm: 16, md: 20, lg: 28 } as const;

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-base',
  lg: 'h-16 w-16 text-2xl',
} as const;

export function Avatar({
  name,
  size = 'sm',
  className,
  level,
  avatar: chosen,
  noCrown = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Wears the frame of this level's title (see src/data/ranks.ts), when given. */
  level?: number;
  /** What they chose for it (src/lib/avatar.ts); the letter when there's nothing, or it won't load. */
  avatar?: string | null;
  /** Leave the Бессмертный crown off — first place on the board wears the board's own crown. */
  noCrown?: boolean;
}) {
  const trimmed = name.trim();
  const hue = hueOf(trimmed.toLowerCase());
  const rank = level != null ? getRank(level) : null;
  const src = avatarSrc(chosen);
  const [broken, setBroken] = useState<string | null>(null);
  const avatar = src && broken !== src ? (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      onError={() => setBroken(src)}
      className={clsx('shrink-0 select-none rounded-full bg-arena-surface-2 object-cover', SIZES[size], className)}
      style={{ objectPosition: '50% 25%' }}
    />
  ) : (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-bold uppercase',
        SIZES[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 62% 34%), hsl(${(hue + 40) % 360} 58% 20%))`,
        color: `hsl(${hue} 90% 88%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 50% 45% / 0.55)`,
      }}
    >
      {trimmed.slice(0, 1) || '?'}
    </span>
  );
  if (!rank) return avatar;
  // The title's frame: a ring in its colour, glowing from Легенда up; Бессмертный wears a crown.
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="rounded-full p-[2px]"
        style={{
          background: rank.color,
          boxShadow: glows(rank) ? `0 0 10px ${rank.color}, 0 0 2px ${rank.color}` : undefined,
        }}
      >
        {avatar}
      </span>
      {rank.minLevel >= 95 && !noCrown && <ImmortalCrown px={CROWN_PX[size]} />}
    </span>
  );
}

/** Бессмертный's crown: sat on top of the frame, bobbing gently up and down. */
function ImmortalCrown({ px }: { px: number }) {
  const calm = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 leading-none drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]"
      style={{ top: -px * 0.85, fontSize: px }}
      animate={calm ? {} : { y: [0, -px * 0.18, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      👑
    </motion.span>
  );
}
