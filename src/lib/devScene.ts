import type { SceneKind } from '../components/AbilityScene';

/** What the dev panel can ask the fight screen to play: any ability scene, the boss's entrance, or the finale. */
export type DevScene = SceneKind | 'boss-intro' | 'finale';

export const DEV_SCENE_EVENT = 'arena:dev-scene';

/**
 * Held here rather than sent only as an event: the panel can be opened from any screen, and the
 * fight screen it switches to isn't mounted yet when the button is pressed. It takes the request
 * on mount; the event covers the case where it is already on screen.
 */
let pending: DevScene | null = null;

export function requestDevScene(kind: DevScene) {
  pending = kind;
  window.dispatchEvent(new CustomEvent(DEV_SCENE_EVENT));
}

export function takeDevScene(): DevScene | null {
  const kind = pending;
  pending = null;
  return kind;
}
