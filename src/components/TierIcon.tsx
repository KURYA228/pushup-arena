import clsx from 'clsx';

/**
 * A rank's icon: a drawn badge (a path under `public/`, e.g. `ranks/rank-voin.png`) or, for the
 * ladders that don't have art yet, an emoji. Either way it sits in the text like a character and
 * takes the font size of where it's put, so it drops in wherever the emoji used to be.
 */
export function TierIcon({ icon, title, className }: { icon: string; title?: string; className?: string }) {
  if (!isImage(icon)) {
    return (
      <span title={title} className={className}>
        {icon}
      </span>
    );
  }
  return (
    <img
      src={`${import.meta.env.BASE_URL}${icon}`}
      alt={title ?? ''}
      title={title}
      draggable={false}
      className={clsx('inline-block h-[1.35em] w-[1.35em] shrink-0 object-contain align-[-0.3em]', className)}
    />
  );
}

/** Whether a tier's icon is a picture rather than an emoji. */
export const isImage = (icon: string) => /\.(png|webp|svg)$/i.test(icon);
