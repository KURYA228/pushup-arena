/**
 * Getting the camera going, and the second tries that keeps it from failing on what's usually a
 * phone being slow rather than anything being wrong. Kept apart from the pose hook so it can be
 * tested without a camera.
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Opens the camera, forgiving what a phone gets wrong on the first try:
 *  - "busy" (NotReadableError / AbortError) right after the previous stream was stopped — a flip
 *    or a restart — because the OS releases the camera a moment late: wait and try again;
 *  - a camera that can't do the size or frame rate asked for (OverconstrainedError): ask again
 *    with nothing but the side it faces;
 *  - no camera on the side asked for (NotFoundError, a laptop has no back one): take any camera.
 * Permission refusals and the like are thrown straight away — retrying those just nags.
 */
export async function openCamera(
  facing: 'user' | 'environment',
  media: Pick<MediaDevices, 'getUserMedia'> = navigator.mediaDevices,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];
  let last: unknown = null;
  for (let i = 0; i < attempts.length; i += 1) {
    for (let busy = 0; busy < 3; busy += 1) {
      try {
        return await media.getUserMedia(attempts[i]);
      } catch (e) {
        last = e;
        const name = (e as { name?: string }).name;
        if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
          await wait(500 * (busy + 1));
          continue;
        }
        if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError' || name === 'NotFoundError') break;
        throw e;
      }
    }
  }
  throw last;
}

/**
 * Starts the video, once more if the first go was cut short. A play() that's interrupted by the
 * stream being swapped in rejects with AbortError and means nothing; muted and inline are set
 * here too, since iOS refuses to autoplay a video that isn't both.
 */
export async function startVideo(video: HTMLVideoElement, wait: (ms: number) => Promise<void> = sleep): Promise<void> {
  video.muted = true;
  video.playsInline = true;
  for (let i = 0; i < 3; i += 1) {
    try {
      await video.play();
      return;
    } catch (e) {
      if (i === 2) throw Object.assign(new Error('play-failed'), { name: 'PlayFailed', cause: e });
      await wait(250);
    }
  }
}

