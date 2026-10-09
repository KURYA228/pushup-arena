import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DrawingUtils as DrawingUtilsT,
  Landmark,
  NormalizedLandmark,
  PoseLandmarker as PoseLandmarkerT,
} from '@mediapipe/tasks-vision';
import {
  ARMS,
  RepDetector,
  angleAt,
  type DetectorSnapshot,
  type PoseSample,
  type Strictness,
} from '../lib/repDetector';

// Loaded lazily on first camera use so the ~1.5MB MediaPipe JS never ships in the main bundle
// for people who only use manual counting.
type VisionModule = typeof import('@mediapipe/tasks-vision');
let visionModulePromise: Promise<VisionModule> | null = null;
function loadVisionModule(): Promise<VisionModule> {
  if (!visionModulePromise) visionModulePromise = import('@mediapipe/tasks-vision');
  return visionModulePromise;
}

// MediaPipe assets are fetched from CDN/Google storage at runtime (not bundled — see README
// for how to self-host them under public/mediapipe for full offline support). The engine's
// version comes from the installed package (vite.config.ts): the JS and the WASM it loads have to
// be the same release, and a hard-coded one had drifted two majors behind.
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${__MEDIAPIPE_VERSION__}/wasm`;

/**
 * How long the first load (engine + model, ~15MB) may take before we call it failed. Generous —
 * a slow phone network is the normal case on first use — but finite: a stalled download used to
 * leave "Загружаем модель…" on screen forever.
 */
const MODEL_TIMEOUT_MS = 60_000;
/** No new video frame for this long while tracking: nudge the video back into playing. */
const STALL_NUDGE_MS = 2500;
/** Still nothing after this long: tear the camera down and open it again. */
const STALL_RESTART_MS = 6000;
/** This many failed inferences in a row means the engine itself is broken, not one bad frame. */
const MAX_FRAME_ERRORS = 20;

/** `full` tracks limbs noticeably better under the foreshortening a push-up produces; `lite` is ~2x faster. */
export type ModelQuality = 'lite' | 'full';
const MODEL_URLS: Record<ModelQuality, string> = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

export type Facing = 'user' | 'environment';

export type PoseStatus =
  | 'idle'
  | 'requesting-permission'
  | 'loading-model'
  | 'tracking'
  | 'error';

/** Why the detector currently isn't counting, so the UI can say something useful instead of nothing. */
export type TrackingQuality = 'ok' | 'no-pose' | 'arm-hidden';

/** Both joints of an arm must be at least this confident before we trust its angle. */
const MIN_VISIBILITY = 0.5;
/**
 * Hips only have to be this visible to judge posture. Lower than for the arm: their position
 * matters roughly (is the torso flat or upright?), and at floor level in side view they're often
 * half-hidden behind the near leg.
 */
const MIN_HIP_VISIBILITY = 0.3;
const SHOULDERS = [11, 12] as const;
const HIPS = [23, 24] as const;

/**
 * Torso lean from horizontal, in degrees, from the metric 3D landmarks: the midpoint of the
 * visible shoulders to the midpoint of the visible hips. World axes follow the camera, and a
 * phone stood up on the floor has its "down" along gravity, so in a push-up this is small and
 * sitting or standing it's near 90. `null` when no hip is visible enough to say.
 */
function torsoTilt(world: Landmark[], screen: NormalizedLandmark[]): number | null {
  const mid = (idx: readonly number[], min: number) => {
    const seen = idx.filter((i) => visibility(screen[i]) >= min && world[i]);
    if (!seen.length) return null;
    return {
      x: seen.reduce((a, i) => a + world[i].x, 0) / seen.length,
      y: seen.reduce((a, i) => a + world[i].y, 0) / seen.length,
      z: seen.reduce((a, i) => a + world[i].z, 0) / seen.length,
    };
  };
  const sh = mid(SHOULDERS, MIN_VISIBILITY);
  const hip = mid(HIPS, MIN_HIP_VISIBILITY);
  if (!sh || !hip) return null;
  const dx = hip.x - sh.x;
  const dy = hip.y - sh.y;
  const dz = hip.z - sh.z;
  const flat = Math.hypot(dx, dz);
  if (flat === 0 && dy === 0) return null;
  return (Math.atan2(Math.abs(dy), flat) * 180) / Math.PI;
}
/** Cap inference at ~33 fps. Cameras deliver 30, so anything above this is wasted battery. */
const MIN_FRAME_INTERVAL_MS = 30;

const PREF_KEY = 'arena.pose.prefs';

interface Prefs {
  model: ModelQuality;
  facing: Facing;
  strictness: Strictness;
}

const DEFAULT_PREFS: Prefs = { model: 'full', facing: 'user', strictness: 'normal' };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // Private mode / storage disabled — preferences just won't persist.
  }
}

/** Rejects if `p` hasn't settled in `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, error: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(error)), ms);
    p.then(
      (v) => {
        window.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(id);
        reject(e);
      },
    );
  });
}

// One landmarker per model quality (and delegate), shared across mounts so switching views
// doesn't re-download.
const landmarkerCache = new Map<string, Promise<PoseLandmarkerT>>();
/**
 * Set once the GPU path has failed at runtime on this device. Some phones create the GPU
 * delegate fine and then lose the context mid-session; after that, only the CPU is trusted.
 */
let gpuBroken = false;

function getLandmarker(quality: ModelQuality): Promise<PoseLandmarkerT> {
  const key = `${quality}|${gpuBroken ? 'cpu' : 'gpu'}`;
  const cached = landmarkerCache.get(key);
  if (cached) return cached;

  const created = loadVisionModule().then(async ({ FilesetResolver, PoseLandmarker }) => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URLS[quality], delegate: 'GPU' as const },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      // Slightly above the 0.5 defaults: a hallucinated low-confidence pose is worse than no pose,
      // because it feeds garbage angles into the rep detector.
      minPoseDetectionConfidence: 0.6,
      minPosePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };
    if (gpuBroken) {
      return PoseLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
      });
    }
    try {
      return await PoseLandmarker.createFromOptions(vision, options);
    } catch {
      // Some browsers/devices don't support the GPU delegate — fall back to CPU.
      return await PoseLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
      });
    }
  });

  const bounded = withTimeout(created, MODEL_TIMEOUT_MS, 'model-timeout');
  // Don't cache a rejected load, or a transient network failure would poison every later attempt.
  bounded.catch(() => landmarkerCache.delete(key));
  landmarkerCache.set(key, bounded);
  return bounded;
}

const visibility = (l: NormalizedLandmark | undefined) => l?.visibility ?? 0;

/**
 * Builds one detector sample: the elbow angle averaged over whichever arms are confidently visible
 * (from metric 3D landmarks), plus shoulder and wrist positions in image space for the
 * body-engagement test. Image x is scaled by the aspect ratio so x and y share a unit — without
 * that, distances in normalized landmark space are stretched along one axis.
 */
function extractSample(world: Landmark[], screen: NormalizedLandmark[], aspect: number): PoseSample | null {
  let angleSum = 0;
  let arms = 0;
  let best: (typeof ARMS)[number] | null = null;
  let bestVis = 0;

  for (const arm of ARMS) {
    const vis = visibility(screen[arm.shoulder]) + visibility(screen[arm.elbow]) + visibility(screen[arm.wrist]);
    const usable =
      visibility(screen[arm.shoulder]) >= MIN_VISIBILITY &&
      visibility(screen[arm.elbow]) >= MIN_VISIBILITY &&
      visibility(screen[arm.wrist]) >= MIN_VISIBILITY;
    if (!usable) continue;
    const a = angleAt(world[arm.shoulder], world[arm.elbow], world[arm.wrist]);
    if (a == null) continue;
    angleSum += a;
    arms += 1;
    if (vis > bestVis) {
      bestVis = vis;
      best = arm;
    }
  }
  if (arms === 0 || !best) return null;

  const pt = (i: number) => ({ x: screen[i].x * aspect, y: screen[i].y });
  const shoulder = pt(best.shoulder);
  const wrist = pt(best.wrist);
  const elbow = pt(best.elbow);

  // Reference length for scale-free travel: torso if the hip is visible, otherwise the upper arm.
  const armLen = Math.hypot(shoulder.x - elbow.x, shoulder.y - elbow.y);
  let scale = armLen;
  if (visibility(screen[best.hip]) >= MIN_VISIBILITY) {
    const hip = pt(best.hip);
    scale = Math.max(scale, Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y));
  }

  return { angle: angleSum / arms, shoulder, wrist, scale, torsoTilt: torsoTilt(world, screen) };
}

/**
 * Camera-based rep counter. Tracks body keypoints with MediaPipe Pose and hands the elbow angle to
 * {@link RepDetector}, which learns your personal range of motion instead of assuming fixed
 * thresholds. Angles come from `worldLandmarks` (metric 3D) rather than the normalized 2D
 * landmarks, so they don't skew with frame aspect ratio or collapse when the camera faces you
 * head-on and the elbow bends along the view axis.
 */
export function usePoseDetection(onRep: () => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const drawingUtilsRef = useRef<DrawingUtilsT | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerT | null>(null);
  const visionRef = useRef<VisionModule | null>(null);

  // Incremented on every stop/restart. Async continuations compare against it and bail out,
  // so a frame still in flight can never resurrect the loop after the camera was shut down.
  const runIdRef = useRef(0);
  /** Whether the user wants the camera on, independent of the current start/stop transition. */
  const activeRef = useRef(false);

  const lastVideoTimeRef = useRef(-1);
  const lastFrameAtRef = useRef(0);
  /** When the video last produced a frame we hadn't seen — the stall watchdog reads it. */
  const lastNewFrameAtRef = useRef(0);
  const frameErrorsRef = useRef(0);
  /** Reopens the camera from scratch; set once `open` exists. */
  const restartRef = useRef<() => void>(() => {});
  const fpsCounterRef = useRef({ frames: 0, since: 0 });

  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const detectorRef = useRef<RepDetector | null>(null);
  if (!detectorRef.current) detectorRef.current = new RepDetector(prefs.strictness);

  const [status, setStatus] = useState<PoseStatus>('idle');
  const statusRef = useRef(status);
  statusRef.current = status;
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<TrackingQuality>('no-pose');
  const [fps, setFps] = useState(0);
  const [aspect, setAspect] = useState(3 / 4);
  const [snapshot, setSnapshot] = useState<DetectorSnapshot>(() => detectorRef.current!.snapshot());

  const drawSkeleton = useCallback((landmarks: NormalizedLandmark[] | undefined, vision: VisionModule) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;
    if (!drawingUtilsRef.current) drawingUtilsRef.current = new vision.DrawingUtils(ctx);
    const du = drawingUtilsRef.current;
    du.drawConnectors(landmarks, vision.PoseLandmarker.POSE_CONNECTIONS, {
      color: 'rgba(245, 158, 11, 0.4)',
      lineWidth: 3,
    });
    du.drawLandmarks(landmarks, { color: 'rgba(245, 158, 11, 0.8)', radius: 3 });
    // Highlight the arms, since they're what the count actually depends on.
    const armPoints = ARMS.flatMap((a) => [landmarks[a.shoulder], landmarks[a.elbow], landmarks[a.wrist]]);
    du.drawLandmarks(armPoints, { color: '#f59e0b', radius: 6 });
  }, []);

  const teardown = useCallback(() => {
    runIdRef.current += 1;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    lastVideoTimeRef.current = -1;
    detectorRef.current?.markPoseLost();
    setQuality('no-pose');
    setFps(0);
    setStatus('idle');
  }, []);

  const open = useCallback(async () => {
    setError(null);
    const runId = ++runIdRef.current;
    const alive = () => runId === runIdRef.current && activeRef.current;

    try {
      setStatus('requesting-permission');
      // In-app browsers (Telegram, Instagram, VK) and pages opened over plain http have no
      // camera API at all. Name that, instead of failing on an undefined.
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('no-camera-api'), { name: 'NoCameraApi' });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: prefsRef.current.facing,
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      if (!alive()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // The camera can be taken away mid-session — a call, another app grabbing it, the OS
      // reclaiming it in the background. Reopen rather than sit on a dead stream.
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (alive()) restartRef.current();
        }),
      );
      const video = videoRef.current;
      if (!video) throw new Error('no-video-element');
      video.srcObject = stream;
      await video.play();
      if (!alive()) return;
      if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);

      setStatus('loading-model');
      const [lm, vision] = await Promise.all([getLandmarker(prefsRef.current.model), loadVisionModule()]);
      if (!alive()) return;
      landmarkerRef.current = lm;
      visionRef.current = vision;
      // DrawingUtils is bound to a canvas context; a restart may have swapped it.
      drawingUtilsRef.current = null;

      detectorRef.current?.markPoseLost();
      lastVideoTimeRef.current = -1;
      lastNewFrameAtRef.current = performance.now();
      frameErrorsRef.current = 0;
      fpsCounterRef.current = { frames: 0, since: performance.now() };
      setStatus('tracking');

      const tick = () => {
        if (!alive()) return;
        rafRef.current = requestAnimationFrame(tick);

        const v = videoRef.current;
        const landmarker = landmarkerRef.current;
        const vis = visionRef.current;
        if (!v || !landmarker || !vis || v.readyState < 2) return;

        const now = performance.now();
        // The camera runs at ~30fps while rAF fires at 60–120Hz. Re-running inference on a frame
        // we already processed wastes battery and perturbs MediaPipe's internal temporal tracker.
        if (v.currentTime === lastVideoTimeRef.current) {
          // No new frame. Briefly that's normal; for seconds it means the video has stalled —
          // iOS pauses it on its own after an interruption — and the counter would sit there
          // looking alive while counting nothing.
          const stalled = now - lastNewFrameAtRef.current;
          if (stalled > STALL_RESTART_MS) {
            restartRef.current();
          } else if (stalled > STALL_NUDGE_MS && v.paused) {
            void v.play().catch(() => {});
          }
          return;
        }
        lastNewFrameAtRef.current = now;
        if (now - lastFrameAtRef.current < MIN_FRAME_INTERVAL_MS) return;
        lastVideoTimeRef.current = v.currentTime;
        lastFrameAtRef.current = now;

        try {
          const result = landmarker.detectForVideo(v, now);
          const screen = result.landmarks[0];
          const world = result.worldLandmarks[0];
          drawSkeleton(screen, vis);

          const detector = detectorRef.current!;
          if (!screen || !world) {
            detector.markPoseLost();
            setQuality('no-pose');
          } else {
            const sample = extractSample(world, screen, v.videoWidth / Math.max(1, v.videoHeight));
            if (sample == null) {
              detector.markPoseLost();
              setQuality('arm-hidden');
            } else {
              setQuality('ok');
              if (detector.push(sample, now)) onRepRef.current();
            }
          }
          setSnapshot(detector.snapshot());

          frameErrorsRef.current = 0;
          const c = fpsCounterRef.current;
          c.frames += 1;
          if (now - c.since >= 1000) {
            setFps(Math.round((c.frames * 1000) / (now - c.since)));
            c.frames = 0;
            c.since = now;
          }
        } catch {
          // A single bad frame must not kill the loop — rAF is already rescheduled above.
          detectorRef.current?.markPoseLost();
          // But a run of them means the engine is broken (typically a lost GPU context):
          // retry on the CPU rather than fail silently every frame from here on.
          frameErrorsRef.current += 1;
          if (frameErrorsRef.current >= MAX_FRAME_ERRORS) {
            gpuBroken = true;
            restartRef.current();
          }
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      if (runId !== runIdRef.current) return;
      const err = e as Error & { name?: string };
      let message = 'Не удалось получить доступ к камере.';
      if (err.name === 'NoCameraApi') {
        message =
          'Этот браузер не даёт доступ к камере. Открой игру в Safari или Chrome — встроенные браузеры Telegram и Instagram камеру не пускают.';
      } else if (err.message === 'model-timeout') {
        message = 'Модель распознавания грузится слишком долго — проверь интернет и нажми «Повторить попытку».';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Доступ к камере запрещён. Разреши камеру в настройках браузера и попробуй снова.';
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        message = 'Подходящая камера не найдена на этом устройстве.';
      } else if (err.name === 'NotReadableError') {
        message = 'Камера занята другим приложением.';
      } else if (String(err.message || '').toLowerCase().includes('fetch')) {
        message = 'Не удалось загрузить модель распознавания — нужен интернет при первом запуске камеры.';
      }
      teardown();
      setError(message);
      setStatus('error');
    }
  }, [drawSkeleton, teardown]);

  const start = useCallback(async () => {
    activeRef.current = true;
    await open();
  }, [open]);

  const stop = useCallback(() => {
    activeRef.current = false;
    teardown();
  }, [teardown]);

  // A full reopen: used by the stall watchdog, a camera track that ended, and a broken engine.
  // Throttled so a camera that keeps failing doesn't spin in a restart loop.
  const lastRestartAtRef = useRef(0);
  restartRef.current = () => {
    if (!activeRef.current) return;
    const now = performance.now();
    if (now - lastRestartAtRef.current < 4000) return;
    lastRestartAtRef.current = now;
    teardown();
    activeRef.current = true;
    void open();
  };

  // Back from the background or an unlocked screen. iOS ends the camera track or pauses the video
  // when the app is hidden, and nothing tells the page — it just stops getting frames. Check on
  // the way back in and pick up where things are: play a paused video, reopen a dead camera.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !activeRef.current) return;
      // An error on screen (no permission, no camera) waits for "Повторить попытку" — coming
      // back to the app must not re-raise the permission prompt on its own every time.
      if (statusRef.current === 'error') return;
      const track = streamRef.current?.getVideoTracks()[0];
      const video = videoRef.current;
      if (!track || track.readyState === 'ended') {
        restartRef.current();
      } else if (video?.paused) {
        lastNewFrameAtRef.current = performance.now();
        void video.play().catch(() => restartRef.current());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  /** Forget the learned range and relearn from the next few reps. */
  const recalibrate = useCallback(() => {
    detectorRef.current?.reset();
    setSnapshot(detectorRef.current!.snapshot());
  }, []);

  const setStrictness = useCallback((s: Strictness) => {
    detectorRef.current?.setStrictness(s);
    setPrefs((p) => {
      const next = { ...p, strictness: s };
      savePrefs(next);
      return next;
    });
  }, []);

  const setModel = useCallback((m: ModelQuality) => {
    setPrefs((p) => {
      const next = { ...p, model: m };
      savePrefs(next);
      return next;
    });
  }, []);

  const flipCamera = useCallback(() => {
    setPrefs((p) => {
      const next: Prefs = { ...p, facing: p.facing === 'user' ? 'environment' : 'user' };
      savePrefs(next);
      return next;
    });
  }, []);

  // Restart the pipeline when the camera or model preference changes, but only while running.
  const restartKey = `${prefs.facing}|${prefs.model}`;
  const lastRestartKeyRef = useRef(restartKey);
  useEffect(() => {
    if (lastRestartKeyRef.current === restartKey) return;
    lastRestartKeyRef.current = restartKey;
    if (!activeRef.current) return;
    teardown();
    activeRef.current = true;
    void open();
  }, [restartKey, open, teardown]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      teardown();
    };
  }, [teardown]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    quality,
    fps,
    aspect,
    snapshot,
    mirrored: prefs.facing === 'user',
    facing: prefs.facing,
    model: prefs.model,
    strictness: prefs.strictness,
    start,
    stop,
    recalibrate,
    setStrictness,
    setModel,
    flipCamera,
  };
}
