import { useState } from 'react';
import { BossAvatar } from './BossAvatar';

/**
 * Where the picture stops being a picture.
 *
 * Two ways to get this wrong, and I have now had both. Fade too hard and the figure's head
 * goes with the background — the top of the artwork dissolves and, with light behind it, the
 * lit screen comes through where the head should be. Fade too little and the picture ends in
 * a straight horizontal line, which reads as a photograph with its top cut off; that is worse,
 * because a soft edge is at least ambiguous and a ruled one is plainly a mistake.
 *
 * So: a core that stays fully solid most of the way out, which covers every head in the
 * roster, and a fade that reaches nothing exactly at the picture's own edge.
 *
 * That last part is the whole trick, and it is why the radii are 50% and not more. A radius
 * over half the box puts the gradient's transparent stop outside the element, so the fade is
 * still part way through where the picture ends — it stops mid-dissolve and leaves a ruled
 * edge. At 58%/54% the mask was around three quarters opaque along the top. For a long time
 * nothing showed, because every illustration in the roster happened to be dark at its edges
 * and dark at three quarters opacity still reads as black. The first one with a bright
 * background — a red arch behind a throne — put a straight red line across the screen.
 */
const FEATHER = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 76%, transparent 100%)';

/**
 * Darkening laid over the outer part of the same picture. These illustrations come with
 * backgrounds of their own — a street, a city — and dimming the edges is what makes the
 * character read as standing in front of something rather than pasted onto it.
 *
 * It now goes all the way to black rather than stopping at 70%, and on the same ellipse as
 * the mask. Belt and braces for the edge above: whatever the fade has not finished dissolving
 * is black by the time it gets there, so a bright background cannot draw a line even if the
 * mask leaves a hair of it behind.
 */
const BACKDROP =
  'radial-gradient(ellipse 50% 50% at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.88) 86%, #000 100%)';

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
  maxWidth,
  className,
  bare = false,
  ratio = 1,
}: {
  file: string;
  color: string;
  /** 0..1 — how heavily built the fallback silhouette should look. */
  tier: number;
  /** Width in pixels; the height follows from `ratio`. */
  size: number;
  /**
   * How wide the artwork may grow if its own shape asks for it — the room actually available
   * on screen. Only wide pictures ever use it; `size` alone is the default.
   */
  maxWidth?: number;
  className?: string;
  /**
   * Drops the plate the artwork normally sits on, so the figure reads as a cut-out rather than
   * a tile. Used where the enemy is the subject of the screen instead of an entry in a list.
   */
  bare?: boolean;
  /**
   * Height as a multiple of the width. The artwork is shot as a portrait, so cropping it into a
   * square box throws away the head — which is the part worth showing.
   */
  ratio?: number;
}) {
  const [failed, setFailed] = useState(false);
  /** The picture's own proportions, once the browser has them. */
  const [shape, setShape] = useState<number | null>(null);
  const height = Math.round(size * ratio);

  if (failed) {
    return <BossAvatar color={color} tier={tier} size={size} className={className} />;
  }

  // A PNG is assumed to be a real cut-out with its own transparency and is left alone. A JPEG
  // is a rectangular photograph, so on the fight screen its edge has to be dissolved instead.
  const cutout = /\.png$/i.test(file);

  // On the fight screen the artwork is fitted to its own shape instead of being cropped to
  // fill the slot. Cropping only works while every picture happens to be roughly square: a
  // wide one loses its sides, and whatever is left of the figure sits small in the middle.
  //
  // A wide picture is then allowed past `size`, out to `maxWidth`, because for such a picture
  // the height is the cheap direction — holding it to a width meant for a portrait would
  // shrink the figure for no reason. The slot's height is the other limit, and the outer box
  // keeps its reserved size either way, so nothing below moves about.
  const room = Math.max(size, maxWidth ?? size);
  const fitW = bare && shape ? Math.min(room, height * shape) : size;
  const fitH = bare && shape ? Math.round(fitW / shape) : height;
  const w = Math.round(fitW);

  const img = (
    <img
      src={`${import.meta.env.BASE_URL}bosses/${file}`}
      alt=""
      aria-hidden="true"
      width={w}
      height={fitH}
      loading="lazy"
      onError={() => setFailed(true)}
      // Measured on mount as well as on load. A picture already in the cache — which it is,
      // every time but the first — fires `load` a tick after the first paint, and in that
      // tick there is nothing to fit to, so the frame is drawn cropped. On the fight screen
      // nobody sees one frame; in the boss cut the artwork arrives on screen at that exact
      // moment, and the top of the figure was visibly sliced off.
      ref={(el) => {
        if (el?.complete && el.naturalWidth && el.naturalHeight) {
          setShape(el.naturalWidth / el.naturalHeight);
        }
      }}
      onLoad={(e) => {
        const el = e.currentTarget;
        if (el.naturalWidth && el.naturalHeight) setShape(el.naturalWidth / el.naturalHeight);
      }}
      className={bare || cutout ? undefined : `rounded-full ${className ?? ''}`}
      style={{
        width: w,
        height: fitH,
        // Contain, not cover: a cut-out that isn't square would otherwise be trimmed at the
        // sides, and a figure is usually taller than it is wide. The same goes for any
        // artwork whose proportions aren't known yet — better a moment of letterboxing than
        // a moment with the head cut off.
        objectFit: cutout || (bare && !shape) ? 'contain' : 'cover',
        ...(cutout
          ? { filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55))' }
          : bare
            ? {
                // An elliptical fade, so the picture has no edge to read as a frame. No
                // `screen` blending here: it used to drop the black background of the older
                // vignette art, but it also bleaches anything bright — a lit street, a sky —
                // and these illustrations have backgrounds of their own.
                maskImage: FEATHER,
                WebkitMaskImage: FEATHER,
              }
            : null),
      }}
    />
  );

  // A cut-out PNG carries its own transparency and needs nothing behind it; everything else on
  // the fight screen gets the vignette so the figure lifts off its own background.
  if (!bare || cutout) return cutout ? <span className={className}>{img}</span> : img;

  return (
    // The outer box keeps the full reserved size whatever shape the picture turns out to be,
    // so nothing below it moves when the image finally loads.
    <span
      className={`relative flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: Math.max(size, w), height }}
    >
      <span className="relative block" style={{ width: w, height: fitH }}>
        {img}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: BACKDROP, maskImage: FEATHER, WebkitMaskImage: FEATHER }}
        />
      </span>
    </span>
  );
}
