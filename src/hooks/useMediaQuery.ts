import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query from JavaScript.
 *
 * Needed where a breakpoint has to change a *number* rather than a class — the enemy artwork
 * sets its own width and height as attributes, so a responsive Tailwind class would be
 * overridden by the inline style it needs anyway.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
