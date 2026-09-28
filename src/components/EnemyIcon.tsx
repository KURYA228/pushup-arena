import { useState } from 'react';
import { BossAvatar } from './BossAvatar';

/**
 * Artwork for any arena enemy — boss or minion.
 *
 * Falls back to the procedural {@link BossAvatar} silhouette when the file is missing, which is
 * the normal state for enemies whose art hasn't been drawn yet: a fresh clone, or a roster that
 * has grown ahead of its illustrations. `file` is a bare filename joined to
 * `import.meta.env.BASE_URL`, so the same code works from the domain root or a Pages subpath.
 */
export function EnemyIcon({
  file,
  color,
  tier,
  size,
  className,
}: {
  file: string;
  color: string;
  /** 0..1 — how heavily built the fallback silhouette should look. */
  tier: number;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <BossAvatar color={color} tier={tier} size={size} className={className} />;
  }

  return (
    <img
      src={`${import.meta.env.BASE_URL}bosses/${file}`}
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
