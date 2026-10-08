import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Search, X } from 'lucide-react';
import clsx from 'clsx';
import type { ProfileRecord } from '../types';
import { adminFetchSave, adminListPlayers, adminWriteSave, type AdminPlayerRow } from '../lib/cloud';
import { applyAdminEdit, type AdminEdit } from '../lib/admin';
import { levelFromTotalXp } from '../data/leveling';
import { UPGRADES, upgradeLevel } from '../data/shop';
import { MAX_FREEZES } from '../lib/streak';

/**
 * Other players' progress, for the admin. Reached through the dev panel and shown only to an
 * account listed in the `admins` table — and the database enforces the same rule on its side,
 * so this screen is a convenience, not the lock (supabase/admin.sql).
 */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<AdminPlayerRow | null>(null);

  const load = () => {
    setError(null);
    adminListPlayers()
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => r.displayName.toLowerCase().includes(query.trim().toLowerCase())),
    [rows, query],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      // Stops here: it sits inside the dev panel, whose backdrop would otherwise take this tap
      // as its own and close both.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="safe-top safe-x fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Админ: игроки"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-arena-red/40 bg-arena-surface"
      >
        <div className="flex items-center gap-2 border-b border-arena-border px-4 py-3">
          {picked && (
            <button onClick={() => setPicked(null)} aria-label="К списку" className="rounded-full p-1 text-arena-text-dim">
              <ChevronLeft size={18} />
            </button>
          )}
          <p className="flex-1 text-sm font-bold uppercase tracking-wider text-arena-red">
            {picked ? picked.displayName : 'Админ · игроки'}
          </p>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full bg-arena-surface-2 p-1.5 text-arena-text-dim">
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {picked ? (
            <PlayerEditor
              row={picked}
              onSaved={() => {
                load();
              }}
            />
          ) : (
            <>
              <label className="relative mb-3 block">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-arena-text-dim" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по имени"
                  className="w-full rounded-xl border border-arena-border bg-arena-surface-2 py-2 pl-8 pr-3 text-sm text-arena-text outline-none focus:border-arena-amber"
                />
              </label>
              {error && <p className="mb-2 text-xs text-arena-red">{error}</p>}
              {!rows && !error && <p className="text-center text-xs text-arena-text-dim">Загрузка…</p>}
              {rows && shown.length === 0 && <p className="text-center text-xs text-arena-text-dim">Никого не найдено</p>}
              <ul className="space-y-1.5">
                {shown.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setPicked(r)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl bg-arena-surface-2 px-3 py-2 text-left active:scale-[0.99]"
                    >
                      <span className="min-w-0 truncate text-sm font-semibold text-arena-text">{r.displayName}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-arena-text-dim">
                        {r.totalPushups} отж · ур. {r.level} · 🔥{r.streak}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

type FieldKey = 'totalPushups' | 'totalXp' | 'level' | 'streak' | 'streakFreezes' | 'rushBestReps' | 'clickerTaps';

const FIELDS: { key: FieldKey; label: string; hint?: string; max?: number }[] = [
  { key: 'totalPushups', label: 'Всего отжиманий' },
  { key: 'totalXp', label: 'XP', hint: 'уровень считается из XP' },
  { key: 'level', label: 'Уровень', hint: 'ставит XP на начало уровня' },
  { key: 'streak', label: 'Стрик, дней', hint: 'будет живым на сегодня' },
  { key: 'streakFreezes', label: 'Заморозки стрика', max: MAX_FREEZES },
  { key: 'rushBestReps', label: 'Рекорд Rush' },
  { key: 'clickerTaps', label: 'Кликер' },
];

function valuesOf(p: ProfileRecord): Record<FieldKey, string> {
  return {
    totalPushups: String(p.totalPushups),
    totalXp: String(p.totalXp),
    level: String(levelFromTotalXp(p.totalXp).level),
    streak: String(p.streak),
    streakFreezes: String(p.streakFreezes ?? 1),
    rushBestReps: String(p.rushBestReps),
    clickerTaps: String(p.clickerTaps ?? 0),
  };
}

function PlayerEditor({ row, onSaved }: { row: AdminPlayerRow; onSaved: () => void }) {
  const [save, setSave] = useState<ProfileRecord | null | undefined>(undefined);
  const [form, setForm] = useState<Record<FieldKey, string> | null>(null);
  const [resetUpgrades, setResetUpgrades] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminFetchSave(row.id)
      .then((p) => {
        setSave(p);
        if (p) setForm(valuesOf(p));
      })
      .catch((e: Error) => {
        setSave(null);
        setStatus({ ok: false, text: e.message });
      });
  }, [row.id]);

  if (save === undefined) return <p className="text-center text-xs text-arena-text-dim">Загружаю сохранение…</p>;
  if (!save || !form) {
    return (
      <p className="text-center text-xs text-arena-text-dim">
        {status?.text ?? 'У игрока нет сохранения в облаке — менять нечего.'}
      </p>
    );
  }

  const original = valuesOf(save);
  const boughtLevels = UPGRADES.reduce((n, u) => n + upgradeLevel(save.upgrades, u.id), 0);

  /** Only the fields that were actually changed go into the edit. Level wins over XP. */
  const edit: AdminEdit = {};
  for (const f of FIELDS) {
    if (form[f.key] === original[f.key] || form[f.key].trim() === '') continue;
    const n = Number(form[f.key]);
    if (Number.isFinite(n)) edit[f.key] = n;
  }
  if (edit.level != null) delete edit.totalXp;
  if (resetUpgrades) edit.resetUpgrades = true;
  const changed = Object.keys(edit).length > 0;

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const next = applyAdminEdit(save, edit, Date.now());
      await adminWriteSave(row.id, next, levelFromTotalXp(next.totalXp).level);
      setSave(next);
      setForm(valuesOf(next));
      setResetUpgrades(false);
      setStatus({ ok: true, text: 'Сохранено. Телефон игрока подхватит при следующей синхронизации.' });
      onSaved();
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-arena-text-dim">
        Изменения уйдут в облачное сохранение. Если игра у игрока открыта — примерно через 15 секунд,
        иначе при следующем запуске. Если он успел позаниматься офлайн, игра спросит, какую версию
        оставить. Статистику по дням это не меняет.
      </p>

      {FIELDS.map((f) => {
        const dirty = form[f.key] !== original[f.key];
        return (
          <label key={f.key} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className={clsx('block text-xs', dirty ? 'font-semibold text-arena-amber' : 'text-arena-text')}>
                {f.label}
              </span>
              {f.hint && <span className="block text-[10px] text-arena-text-dim">{f.hint}</span>}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={f.max}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={clsx(
                'w-28 shrink-0 rounded-lg border bg-arena-surface-2 px-2 py-1.5 text-right text-sm tabular-nums text-arena-text outline-none',
                dirty ? 'border-arena-amber' : 'border-arena-border',
              )}
            />
          </label>
        );
      })}

      <label className="flex items-center gap-2 pt-1 text-xs text-arena-text">
        <input type="checkbox" checked={resetUpgrades} onChange={(e) => setResetUpgrades(e.target.checked)} />
        Сбросить улучшения магазина
        <span className="text-arena-text-dim">(куплено уровней: {boughtLevels}, XP не возвращается)</span>
      </label>

      <button
        onClick={() => void submit()}
        disabled={!changed || busy}
        className="mt-2 w-full rounded-xl bg-arena-red py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? 'Сохраняю…' : 'Сохранить игроку'}
      </button>
      {status && (
        <p className={clsx('text-center text-xs', status.ok ? 'text-arena-amber' : 'text-arena-red')}>{status.text}</p>
      )}
    </div>
  );
}
