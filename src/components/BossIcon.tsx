import { useState } from 'react';
import type { BossDef } from '../data/bosses';
import { bossTier } from '../data/bosses';
import { BossAvatar } from './BossAvatar';

/**
 * The boss's generated artwork. Falls back to the procedural {@link BossAvatar} if the file is
 * missing — the icons live in `public/bosses/` and are produced by `scripts/import-boss-icons.mjs`,
 * so a fresh clone without them still renders something instead of broken-image boxes.
 *
 * `boss.icon` is a bare filename joined to `import.meta.env.BASE_URL`, so the same code works
 * whether the app is served from the domain root or from a GitHub Pages subpath.
 */
export function BossIcon({
  boss,
  index,
  size,
  className,
}: {
  boss: BossDef;
  index: number;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <BossAvatar color={boss.color} tier={bossTier(index)} size={size} className={className} />;
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}bosses/${boss.icon}`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      // The artwork is a circular vignette on black, so clipping to a circle hides the sheet's
      // dark corners instead of letting them read as a square tile on the lighter card.
      className={`rounded-full ${className ?? ''}`}
      style={{ width: size, height: size, objectFit: 'cover' }}
    />
  );
}
