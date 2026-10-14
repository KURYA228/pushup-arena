import type { BossDef } from '../data/bosses';
import { bossTier } from '../data/bosses';
import { EnemyIcon } from './EnemyIcon';

/** A boss's artwork. Thin wrapper over {@link EnemyIcon} that fills in colour and silhouette tier. */
export function BossIcon({
  boss,
  index,
  size,
  maxWidth,
  className,
  bare = false,
  ratio,
  maxShape,
  hug,
  shadowed,
  frame,
  original = true,
  circle,
}: {
  boss: BossDef;
  index: number;
  size: number;
  maxWidth?: number;
  className?: string;
  bare?: boolean;
  ratio?: number;
  maxShape?: number;
  hug?: boolean;
  shadowed?: boolean;
  frame?: { w: number; h: number };
  /**
   * The artwork as drawn. On by default: the lifted version is for the fight screen alone, where
   * the phone is on the floor at arm's length — everywhere else he looks the way he was drawn.
   */
  original?: boolean;
  /** See EnemyIcon. */
  circle?: string;
}) {
  return (
    <EnemyIcon
      file={boss.icon}
      color={boss.color}
      tier={bossTier(index)}
      size={size}
      maxWidth={maxWidth}
      className={className}
      bare={bare}
      ratio={ratio}
      maxShape={maxShape}
      hug={hug}
      shadowed={shadowed}
      frame={frame}
      light={boss.artLight}
      original={original}
      circle={circle}
    />
  );
}
