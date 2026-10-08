import type { BossDef } from '../data/bosses';
import { BOSSES } from '../data/bosses';
import { fightDuration, plural, type StageRecord } from './stats';

/**
 * The victory card: a picture of the win, drawn on a canvas so it can go out through the share
 * sheet as an ordinary image — a screenshot of the modal would carry the buttons and the
 * phone's status bar with it.
 *
 * 4:5 portrait, the shape messengers and stories crop least.
 */
export const CARD_W = 1080;
export const CARD_H = 1350;

const BG = '#0b0c0f';
const TEXT = '#e6e7eb';
const DIM = '#9aa0ab';
const AMBER = '#f59e0b';
const BORDER = '#2a2e37';
/** No web font is bundled, so the card uses whatever the phone draws its own UI with. */
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface VictoryCardData {
  boss: BossDef;
  index: number;
  /** Null when the fight predates the rep log — the card then shows the win without numbers. */
  record: StageRecord | null;
  level: number;
  rankName: string;
  defeatedAt: number;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Shrinks the font until the line fits — boss names run from «Мор» to «Багровый Царь». */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    size -= 4;
  } while (ctx.measureText(text).width > width && size > 24);
}

/** Splits a line at word boundaries so it fits `width`; at most `lines` lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > width && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.slice(0, lines);
}

export async function renderVictoryCard(data: VictoryCardData): Promise<HTMLCanvasElement> {
  const { boss, index, record } = data;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The boss's own colour, blooming behind him.
  const glow = ctx.createRadialGradient(CARD_W / 2, 470, 40, CARD_W / 2, 470, 640);
  glow.addColorStop(0, `${boss.color}55`);
  glow.addColorStop(1, `${boss.color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Artwork, fitted into the top of the card and dissolved into the background on every side,
  // the same way the fight screen does it — a hard-edged rectangle reads as a pasted photo.
  const art = await loadImage(`${import.meta.env.BASE_URL}bosses/${boss.icon}`);
  if (art) {
    const box = { x: 90, y: 60, w: 900, h: 820 };
    const scale = Math.min(box.w / art.naturalWidth, box.h / art.naturalHeight);
    const w = art.naturalWidth * scale;
    const h = art.naturalHeight * scale;
    const x = box.x + (box.w - w) / 2;
    const y = box.y + (box.h - h) / 2;
    ctx.drawImage(art, x, y, w, h);

    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(w / 2, h / 2);
    const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    fade.addColorStop(0.55, 'rgba(11,12,15,0)');
    fade.addColorStop(0.95, BG);
    ctx.fillStyle = fade;
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
    ctx.restore();
  }

  // The bottom of the art sinks into the text block.
  const scrim = ctx.createLinearGradient(0, 620, 0, 900);
  scrim.addColorStop(0, 'rgba(11,12,15,0)');
  scrim.addColorStop(1, BG);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 620, CARD_W, 280);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = AMBER;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`ПОВЕРЖЕН · ЭТАП ${index + 1} / ${BOSSES.length}`, CARD_W / 2, 790);

  ctx.fillStyle = TEXT;
  fitText(ctx, boss.name, 900, 132, CARD_W - 140);
  ctx.fillText(boss.name, CARD_W / 2, 920);

  ctx.fillStyle = DIM;
  ctx.font = `500 38px ${FONT}`;
  wrap(ctx, boss.title, CARD_W - 180, 2).forEach((line, i) => {
    ctx.fillText(line, CARD_W / 2, 980 + i * 46);
  });

  // Three numbers, or a plain line when the fight happened before the log existed.
  const statsY = 1090;
  if (record) {
    const cells: [string, string][] = [
      // A stage the log only caught part of shows its count as a lower bound.
      [`${record.reps}${record.complete ? '' : '+'}`, plural(record.reps, 'отжимание', 'отжимания', 'отжиманий')],
      [String(record.crits), plural(record.crits, 'крит', 'крита', 'критов')],
      [fightDuration(record), 'в бою'],
    ];
    const colW = (CARD_W - 120) / 3;
    cells.forEach(([value, label], i) => {
      const cx = 60 + colW * i + colW / 2;
      ctx.fillStyle = TEXT;
      fitText(ctx, value, 800, 76, colW - 30);
      ctx.fillText(value, cx, statsY + 40);
      ctx.fillStyle = DIM;
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText(label, cx, statsY + 88);
    });
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      const x = 60 + colW * i;
      ctx.beginPath();
      ctx.moveTo(x, statsY - 20);
      ctx.lineTo(x, statsY + 100);
      ctx.stroke();
    }
  }

  // Footer: who, when, and where from.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 1230);
  ctx.lineTo(CARD_W - 60, 1230);
  ctx.stroke();

  ctx.font = `600 32px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT;
  ctx.fillText(`${data.rankName} · ур. ${data.level}`, 60, 1290);
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.fillText(
    new Date(data.defeatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
    CARD_W - 60,
    1290,
  );
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText('PUSH UP LEGENDS', CARD_W / 2, 1330);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/**
 * Hands the picture to the system share sheet where there is one (phones), and falls back to a
 * download where there isn't (most desktop browsers). Returns what actually happened.
 */
export async function shareOrSave(blob: Blob, name: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      // Closing the share sheet rejects with AbortError — that's a choice, not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  saveBlob(blob, name);
  return 'saved';
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
