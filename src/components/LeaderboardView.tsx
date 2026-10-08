import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ChevronDown,
  ChevronUp,
  CloudOff,
  Crown,
  Download,
  Flame,
  LogOut,
  Medal,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { ProfileRecord } from '../types';
import type { Cloud, LeaderboardRow } from '../hooks/useCloud';
import { movement, readRanks, saveRanks } from '../lib/rankHistory';
import { AuthView, ChooseNameForm } from './AuthView';
import { Avatar } from './PlayerBadge';
import { CountUp } from './CountUp';

/**
 * The board.
 *
 * Ranking by one number would flatten the game into "who did the most reps", so the same players
 * can be re-sorted by level, bosses or Rush — four different ways to be first. Everything is
 * animated through the change, because watching yourself move is the whole point of a board.
 */

const SORTS = [
  { id: 'pushups', label: 'Отжимания', unit: '', value: (r: LeaderboardRow) => r.totalPushups },
  { id: 'level', label: 'Уровень', unit: 'ур.', value: (r: LeaderboardRow) => r.level },
  { id: 'bosses', label: 'Боссы', unit: '', value: (r: LeaderboardRow) => r.bossesDefeated },
  { id: 'rush', label: 'Rush', unit: '', value: (r: LeaderboardRow) => r.rushBestReps },
] as const;

type SortId = (typeof SORTS)[number]['id'];

const PODIUM_HEIGHT = [92, 68, 52];
const MEDAL = ['#f5c542', '#c3ccd8', '#c1783c'];

export function LeaderboardView({
  cloud,
  profile,
  onRestore,
}: {
  cloud: Cloud;
  profile: ProfileRecord;
  onRestore: (p: ProfileRecord) => Promise<void>;
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortId>('pushups');
  // Snapshotted once: movement is measured against the board as you last left it, not against
  // the previous refresh a second ago.
  const [previous] = useState(readRanks);

  const refresh = useCallback(async () => {
    if (!cloud.session) return;
    setLoading(true);
    try {
      // Own progress first, then everyone else's. Refreshing the board while this device is
      // still behind would show the account's numbers next to a stale profile on the home
      // screen — the exact mismatch this button gets pressed to resolve.
      await cloud.reconcile();
      const fresh = await cloud.fetchLeaderboard();
      setRows(fresh);
      saveRanks(fresh.map((r) => r.id));
    } finally {
      setLoading(false);
    }
    // Deliberately not `[cloud]`: that object is rebuilt whenever anything in it changes,
    // including the sync state this very function touches — and the effect below re-runs on
    // every new identity, which would have it calling itself forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.session, cloud.reconcile, cloud.fetchLeaderboard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Somebody else signing up doesn't reach this tab on its own. Coming back to the window is the
  // moment you'd expect the standings to be current, so it refetches then instead of leaving you
  // looking at whoever was there when you opened it.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const active = SORTS.find((s) => s.id === sort)!;
  const ordered = useMemo(
    () => [...rows].sort((a, b) => active.value(b) - active.value(a)),
    [rows, active],
  );

  if (!cloud.configured) {
    return (
      <div className="arena-page pb-8 pt-16 text-center">
        <CloudOff size={28} className="mx-auto text-arena-text-dim" />
        <h1 className="mt-3 text-lg font-bold text-arena-text">Облако не подключено</h1>
        <p className="mt-2 text-sm leading-snug text-arena-text-dim">
          Нужен бесплатный проект Supabase: создай его, скопируй адрес и публичный ключ в файл{' '}
          <code className="text-arena-text">.env.local</code>. Подробности — в README, раздел
          «Аккаунты и таблица лидеров».
        </p>
        <p className="mt-3 text-xs text-arena-text-dim">
          Пока не подключено, игра работает как раньше — весь прогресс остаётся на устройстве.
        </p>
      </div>
    );
  }

  if (!cloud.ready) {
    return (
      <div className="arena-page pb-8 pt-16 text-center">
        <motion.p
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-sm text-arena-text-dim"
        >
          Проверяем вход…
        </motion.p>
      </div>
    );
  }

  // Reached by signing out from inside the app; the front door lives in App, not here.
  if (!cloud.session) return <AuthView cloud={cloud} />;

  // Still fetching the public row. Without this the "Выбери имя" screen flashed for a couple of
  // seconds after every sign-in, because a missing name and an unfetched one looked identical.
  if (cloud.name === undefined) {
    return (
      <div className="arena-page pb-8 pt-16 text-center">
        <motion.p
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-sm text-arena-text-dim"
        >
          Открываем таблицу…
        </motion.p>
      </div>
    );
  }

  if (cloud.name === null) return <ChooseNameForm cloud={cloud} />;

  const myId = cloud.session.user.id;
  const myIndex = ordered.findIndex((r) => r.id === myId);
  const podium = ordered.slice(0, 3);
  const rest = ordered.slice(3);

  return (
    // A list of names and one number each: it reads worse the wider it gets, so this view keeps
    // its own ceiling instead of filling the page the way the arena screens do.
    <div className="arena-page pb-8 pt-6 [&>*]:mx-auto [&>*]:max-w-2xl">
      <header className="mb-4 flex items-center gap-3">
        <Avatar name={cloud.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-arena-text">{cloud.name}</p>
          <p className="truncate text-[11px] text-arena-text-dim">
            {myIndex >= 0 ? `${myIndex + 1}-е место из ${ordered.length}` : 'ещё не в таблице'}
            {cloud.syncedAt && ' · прогресс отправлен'}
          </p>
        </div>
        <button
          onClick={() => void cloud.logout()}
          aria-label="Выйти"
          className="shrink-0 rounded-lg bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <LogOut size={15} />
        </button>
      </header>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => void cloud.syncNow().then(refresh)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95"
        >
          <Upload size={13} /> Отправить прогресс
        </button>
        <button
          onClick={() => void refresh()}
          aria-label="Обновить"
          className="rounded-lg bg-arena-surface-2 px-3 py-2 text-arena-text active:scale-95"
        >
          <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
        </button>
      </div>

      <ConflictCard cloud={cloud} />

      <SortBar sort={sort} onChange={setSort} />

      {ordered.length === 0 ? (
        <p className="py-10 text-center text-sm text-arena-text-dim">
          {loading ? 'Загружаем таблицу…' : 'Пока никого. Отправь прогресс — и займёшь первую строчку.'}
        </p>
      ) : (
        <>
          {podium.length === 3 && <Podium rows={podium} sortId={sort} myId={myId} />}

          <ol className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {/* The rows pick up where the podium leaves off. With fewer than three players
                  there is no podium, so the list carries the medals itself and starts at one. */}
              {(podium.length === 3 ? rest : ordered).map((row, i) => {
                const rank = (podium.length === 3 ? 3 : 0) + i + 1;
                return (
                  <Row
                    key={row.id}
                    row={row}
                    rank={rank}
                    me={row.id === myId}
                    sortId={sort}
                    delta={sort === 'pushups' ? movement(previous, row.id, rank) : null}
                  />
                );
              })}
            </AnimatePresence>
          </ol>
        </>
      )}

      <div className="mt-5 space-y-2">
        <RestoreButton cloud={cloud} profile={profile} onRestore={onRestore} />
        <DeviceRow cloud={cloud} />
      </div>

      <p className="mt-4 text-[11px] leading-snug text-arena-text-dim">
        Счёт ведётся на устройстве, поэтому цифры здесь держатся на честном слове: подтвердить их
        технически невозможно.
      </p>
    </div>
  );
}

/* ---------------------------- board pieces ---------------------------- */

function SortBar({ sort, onChange }: { sort: SortId; onChange: (s: SortId) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-arena-border bg-arena-surface p-1">
      {SORTS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className="relative flex-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold"
        >
          {sort === s.id && (
            <motion.span
              layoutId="sort-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="absolute inset-0 rounded-lg bg-arena-surface-2 ring-1 ring-arena-amber/40"
            />
          )}
          <span className={clsx('relative', sort === s.id ? 'text-arena-amber' : 'text-arena-text-dim')}>
            {s.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Top three, in the order they'd actually stand: second, first, third. */
function Podium({ rows, sortId, myId }: { rows: LeaderboardRow[]; sortId: SortId; myId: string }) {
  const order = [1, 0, 2];
  const metric = SORTS.find((s) => s.id === sortId)!;
  return (
    <div className="mt-3 flex items-end justify-center gap-2">
      {order.map((place) => {
        const row = rows[place];
        const me = row.id === myId;
        return (
          <div key={row.id} className="flex w-1/3 flex-col items-center">
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * place, type: 'spring', stiffness: 320, damping: 26 }}
              className="flex flex-col items-center"
            >
              {/* The winner wears it. It hovers rather than sitting on the head, which keeps the
                  avatar readable and draws the eye to the middle column. */}
              <motion.span
                className="mb-0.5"
                style={{ color: MEDAL[place], filter: `drop-shadow(0 0 6px ${MEDAL[place]}77)` }}
                animate={place === 0 ? { y: [0, -3, 0] } : {}}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {place === 0 ? (
                  <Crown size={20} className="fill-current" strokeWidth={1.6} />
                ) : (
                  <Medal size={15} strokeWidth={2.1} />
                )}
              </motion.span>
              <Avatar
                name={row.displayName}
                size={place === 0 ? 'md' : 'sm'}
                className={place === 0 ? 'arena-glow' : undefined}
              />
              <p
                className={clsx(
                  'mt-1.5 w-full truncate text-center text-[11px] font-semibold',
                  me ? 'text-arena-amber' : 'text-arena-text',
                )}
              >
                {me ? 'ты' : row.displayName}
              </p>
              <p className="text-[11px] font-bold tabular-nums text-arena-amber">
                <CountUp value={metric.value(row)} />
                {metric.unit && <span className="ml-0.5 font-normal text-arena-text-dim">{metric.unit}</span>}
              </p>
            </motion.div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: PODIUM_HEIGHT[place] }}
              transition={{ delay: 0.08 * place, type: 'spring', stiffness: 220, damping: 26 }}
              className={clsx(
                'mt-1.5 flex w-full items-start justify-center rounded-t-lg border-t-2 pt-1.5',
                me ? 'bg-arena-surface-2 ring-1 ring-inset ring-arena-amber/40' : 'bg-arena-surface',
              )}
              style={{ borderTopColor: MEDAL[place] }}
            >
              <span className="text-sm font-black tabular-nums" style={{ color: MEDAL[place] }}>
                {place + 1}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * What sits where the rank number goes: a crown for the winner, medals behind them, a plain
 * number for everyone else. The top three are worth spotting without reading, and the shape
 * carries further than a digit does.
 */
function RankMark({ rank, size = 17 }: { rank: number; size?: number }) {
  if (rank > 3) {
    return (
      <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-arena-text-dim">
        {rank}
      </span>
    );
  }
  const color = MEDAL[rank - 1];
  return (
    <motion.span
      className="flex w-5 shrink-0 justify-center"
      style={{ color, filter: `drop-shadow(0 0 5px ${color}66)` }}
      // The winner's crown keeps a slow shine; the medals sit still.
      animate={rank === 1 ? { scale: [1, 1.13, 1], rotate: [0, -6, 0] } : {}}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {rank === 1 ? (
        <Crown size={size} className="fill-current" strokeWidth={1.6} />
      ) : (
        <Medal size={size} strokeWidth={2.1} />
      )}
    </motion.span>
  );
}

function Row({
  row,
  rank,
  me,
  sortId,
  delta,
}: {
  row: LeaderboardRow;
  rank: number;
  me: boolean;
  sortId: SortId;
  delta: number | null;
}) {
  const metric = SORTS.find((s) => s.id === sortId)!;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        me ? 'border-arena-amber/60 bg-arena-surface-2' : 'border-arena-border bg-arena-surface',
      )}
    >
      <RankMark rank={rank} />
      <Avatar name={row.displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-arena-text">
          {row.displayName}
          {delta !== null && (
            <span
              className={clsx(
                'flex items-center text-[10px] font-bold',
                delta > 0 ? 'text-emerald-400' : 'text-arena-red',
              )}
            >
              {delta > 0 ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {Math.abs(delta)}
            </span>
          )}
        </p>
        <p className="truncate text-[11px] text-arena-text-dim">
          уровень {row.level} · боссов {row.bossesDefeated} · Rush {row.rushBestReps}
        </p>
      </div>
      {row.streak > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-arena-red">
          <Flame size={12} />
          {row.streak}
        </span>
      )}
      <span className="shrink-0 text-sm font-bold tabular-nums text-arena-text">
        {metric.value(row)}
      </span>
    </motion.li>
  );
}

/**
 * Shown only when both this device and the account moved on independently — the one case the
 * app refuses to decide by itself, because either answer throws away somebody's set. Everything
 * else reconciles silently.
 */
function ConflictCard({ cloud }: { cloud: Cloud }) {
  const [busy, setBusy] = useState(false);
  if (!cloud.conflict) return null;
  const mine = cloud.conflict.mine.totalPushups;
  const theirs = cloud.conflict.theirs.totalPushups;

  const run = (action: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl border border-arena-amber/50 bg-arena-surface p-3"
    >
      <p className="text-xs font-semibold text-arena-text">Прогресс разошёлся</p>
      <p className="mt-1 text-[11px] leading-snug text-arena-text-dim">
        На этом устройстве <span className="text-arena-text">{mine}</span> отжиманий, в аккаунте{' '}
        <span className="text-arena-text">{theirs}</span>. Записи делались независимо, поэтому
        выбрать может только ты — вторая будет потеряна.
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          disabled={busy}
          onClick={run(cloud.takeCloud)}
          className="flex-1 rounded-lg bg-arena-amber px-3 py-2 text-xs font-bold text-black active:scale-95 disabled:opacity-50"
        >
          Взять из аккаунта
        </button>
        <button
          disabled={busy}
          onClick={run(cloud.keepLocal)}
          className="flex-1 rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95 disabled:opacity-50"
        >
          Оставить здешний
        </button>
      </div>
    </motion.div>
  );
}

/* ---------------------------- device & save ---------------------------- */

/** The state of "remember me", available after signing in and not only on the login form. */
function DeviceRow({ cloud }: { cloud: Cloud }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-arena-border bg-arena-surface px-3 py-2">
      <span className="min-w-0 flex-1 text-[11px] leading-snug text-arena-text-dim">
        {cloud.remember
          ? 'Устройство запомнено — вход сохранится после закрытия приложения.'
          : 'Устройство не запоминается — вход слетит при закрытии вкладки.'}
      </span>
      <button
        onClick={() => cloud.setRemember(!cloud.remember)}
        className="shrink-0 rounded-lg bg-arena-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-arena-text active:scale-95"
      >
        {cloud.remember ? 'Забыть' : 'Запомнить'}
      </button>
    </div>
  );
}

/** Pulling the cloud save down can overwrite local progress, so it asks first. */
function RestoreButton({
  cloud,
  profile,
  onRestore,
}: {
  cloud: Cloud;
  profile: ProfileRecord;
  onRestore: (p: ProfileRecord) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<{ profile: ProfileRecord; updatedAt: string } | null>(
    null,
  );
  const [status, setStatus] = useState<string | null>(null);

  if (confirming) {
    const theirs = confirming.profile;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-arena-red/50 bg-arena-surface p-3"
      >
        <p className="text-xs leading-snug text-arena-text">
          В облаке: {theirs.totalPushups} отжиманий. Здесь сейчас: {profile.totalPushups}. Загрузка
          заменит местный прогресс.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              void onRestore(theirs);
              setConfirming(null);
              setStatus('Прогресс загружен из облака.');
            }}
            className="flex-1 rounded-lg bg-arena-red px-3 py-1.5 text-xs font-semibold text-white"
          >
            Заменить
          </button>
          <button
            onClick={() => setConfirming(null)}
            className="flex-1 rounded-lg bg-arena-surface-2 px-3 py-1.5 text-xs text-arena-text"
          >
            Отмена
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <button
        onClick={async () => {
          try {
            const save = await cloud.fetchSave();
            if (!save) setStatus('В облаке пока ничего нет.');
            else setConfirming(save);
          } catch {
            // `fetchSave` now separates "nothing saved" from "couldn't ask", and the two
            // deserve different words.
            setStatus('Не удалось связаться с сервером.');
          }
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95"
      >
        <Download size={13} /> Загрузить прогресс с другого устройства
      </button>
      {status && <p className="text-center text-[11px] text-arena-text-dim">{status}</p>}
    </>
  );
}
