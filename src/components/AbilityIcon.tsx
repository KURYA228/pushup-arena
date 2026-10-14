import clsx from 'clsx';
import { ABILITY_TIPS, type AbilityKind } from '../data/abilities';
import { TierIcon, isImage } from './TierIcon';

/** An ability's badge: the drawn disc where there is one, the emoji otherwise. */
export function AbilityIcon({ kind, className, title }: { kind: AbilityKind; className?: string; title?: string }) {
  const icon = ABILITY_TIPS[kind].icon;
  return (
    <TierIcon
      icon={icon}
      title={title}
      className={clsx(isImage(icon) && 'rounded-full shadow-[0_0_8px_rgba(0,0,0,0.6)]', className)}
    />
  );
}
