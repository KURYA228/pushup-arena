import type { BossDef } from '../data/bosses';
import { bossTier } from '../data/bosses';
import { EnemyIcon } from './EnemyIcon';

/** A boss's artwork. Thin wrapper over {@link EnemyIcon} that fills in colour and silhouette tier. */
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
  return (
    <EnemyIcon
      file={boss.icon}
      color={boss.color}
      tier={bossTier(index)}
      size={size}
      className={className}
    />
  );
}
