import { getRank, glows } from '../data/ranks';
import clsx from 'clsx';

/**
 * A player's avatar: the first letter of the name over a colour derived from the name itself.
 * Nobody uploads a picture in a push-up app, but a board of identical grey rows is unreadable —
 * a stable colour per player makes finding yourself instant.
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
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  /** Wears the frame of this level's title (see src/data/ranks.ts), when given. */
  level?: number;
}) {
  const trimmed = name.trim();
  const hue = hueOf(trimmed.toLowerCase());
  const rank = level != null ? getRank(level) : null;
  const avatar = (
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
      {rank.minLevel >= 95 && (
        <span aria-hidden className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] leading-none">
          👑
        </span>
      )}
    </span>
  );
}
