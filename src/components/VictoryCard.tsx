import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { db } from '../db/db';
import { BOSSES } from '../data/bosses';
import { SEASON } from '../lib/season';
import { stageRecords } from '../lib/stats';
import { CARD_H, CARD_W, canvasToBlob, renderVictoryCard, saveBlob, shareOrSave } from '../lib/victoryCard';

/**
 * The victory card for one cleared stage: a preview of the picture and the buttons to send it.
 * Lives inside the boss card on the home screen, shown for bosses already beaten.
 *
 * Reads the log once rather than live: the card is a snapshot of a finished fight, and nothing
 * that happens later changes it.
 */
export function VictoryCard({
  bossIndex,
  level,
  rankName,
}: {
  bossIndex: number;
  level: number;
  rankName: string;
}) {
  const boss = BOSSES[bossIndex];
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const fileName = `push-up-legends-${String(bossIndex + 1).padStart(2, '0')}-${boss.id}.png`;

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void (async () => {
      const rows = (await db.reps.orderBy('at').toArray()).filter((r) => r.season === SEASON);
      const record = stageRecords(rows).get(bossIndex) ?? null;
      const canvas = await renderVictoryCard({
        boss,
        index: bossIndex,
        record,
        level,
        rankName,
        defeatedAt: record?.lastAt ?? Date.now(),
      });
      const blob = await canvasToBlob(canvas);
      if (cancelled) return;
      blobRef.current = blob;
      url = URL.createObjectURL(blob);
      setPreview(url);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [boss, bossIndex, level, rankName]);

  const onShare = async () => {
    if (!blobRef.current) return;
    const result = await shareOrSave(blobRef.current, fileName);
    if (result === 'saved') setStatus('Картинка сохранена');
  };

  const onSave = () => {
    if (!blobRef.current) return;
    saveBlob(blobRef.current, fileName);
    setStatus('Картинка сохранена');
  };

  return (
    <div>
      {/* The slot keeps the card's proportions while it's being drawn, so nothing jumps. */}
      <div
        className="w-full overflow-hidden rounded-2xl bg-arena-bg"
        style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}
      >
        {preview ? (
          <img src={preview} alt={`${boss.name} повержен`} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-arena-text-dim">Рисуем…</div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={onShare}
          disabled={!preview}
          className="flex items-center justify-center gap-2 rounded-xl bg-arena-amber py-3 text-sm font-semibold text-arena-bg active:scale-[0.98] disabled:opacity-50"
        >
          <Share2 size={16} /> Поделиться
        </button>
        <button
          onClick={onSave}
          disabled={!preview}
          aria-label="Сохранить картинку"
          className="flex items-center justify-center rounded-xl border border-arena-border bg-arena-surface-2 px-4 text-arena-text active:scale-[0.98] disabled:opacity-50"
        >
          <Download size={16} />
        </button>
      </div>
      {status && <p className="mt-2 text-center text-xs text-arena-text-dim">{status}</p>}
    </div>
  );
}
