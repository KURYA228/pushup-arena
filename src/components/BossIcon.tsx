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
    />
  );
}
