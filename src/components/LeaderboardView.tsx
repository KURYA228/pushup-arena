import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { CloudOff, Download, Flame, LogOut, Mail, RefreshCw, Upload } from 'lucide-react';
import type { ProfileRecord } from '../types';
import type { Cloud, LeaderboardRow } from '../hooks/useCloud';

/**
 * Accounts and the leaderboard.
 *
 * Signed out — or with no Supabase project wired up — this is the only screen that changes;
 * everything else in the app keeps working offline exactly as before.
 */
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

  const refresh = useCallback(async () => {
    if (!cloud.session) return;
    setLoading(true);
    try {
      setRows(await cloud.fetchLeaderboard());
    } finally {
      setLoading(false);
    }
  }, [cloud]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cloud.configured) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  if (!cloud.ready) {
    return (
      <Shell>
        <p className="text-sm text-arena-text-dim">Проверяем вход…</p>
      </Shell>
    );
  }

  if (!cloud.session) return <AuthForm cloud={cloud} />;

  // Signed in with no public row yet — happens when the account was confirmed from a different
  // device, where the name chosen at sign-up was never stored. Without this the board would
  // quietly never show them.
  if (cloud.name === null) return <ChooseNameForm cloud={cloud} />;

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-arena-text">Таблица лидеров</h1>
          <p className="mt-0.5 truncate text-xs text-arena-text-dim">
            ты играешь как «{cloud.name ?? '…'}»
            {cloud.syncedAt && ' · прогресс отправлен'}
          </p>
        </div>
        <button
          onClick={() => void cloud.logout()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-arena-surface-2 px-2.5 py-1.5 text-[11px] text-arena-text-dim active:scale-95"
        >
          <LogOut size={13} /> Выйти
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
          className="flex items-center justify-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95"
        >
          <RefreshCw size={13} className={clsx(loading && 'animate-spin')} /> Обновить
        </button>
      </div>

      <RestoreButton cloud={cloud} profile={profile} onRestore={onRestore} />

      <ol className="mt-4 space-y-1.5">
        {rows.length === 0 && !loading && (
          <p className="py-6 text-center text-sm text-arena-text-dim">
            Пока никого. Отправь прогресс — и займёшь первую строчку.
          </p>
        )}
        {rows.map((row, i) => {
          const me = row.id === cloud.session?.user.id;
          return (
            <li
              key={row.id}
              className={clsx(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                me ? 'border-arena-amber/60 bg-arena-surface-2' : 'border-arena-border bg-arena-surface',
              )}
            >
              <span
                className={clsx(
                  'w-6 shrink-0 text-center text-sm font-bold tabular-nums',
                  i === 0 ? 'text-arena-amber' : 'text-arena-text-dim',
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-arena-text">{row.displayName}</p>
                <p className="text-[11px] text-arena-text-dim">
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
                {row.totalPushups}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] leading-snug text-arena-text-dim">
        Счёт ведётся на устройстве, поэтому цифры здесь держатся на честном слове: подтвердить их
        технически невозможно.
      </p>
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
  const [confirming, setConfirming] = useState<{ profile: ProfileRecord; updatedAt: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (confirming) {
    const theirs = confirming.profile;
    return (
      <div className="rounded-xl border border-arena-red/50 bg-arena-surface p-3">
        <p className="text-xs leading-snug text-arena-text">
          В облаке: {theirs.totalPushups} отжиманий. Здесь сейчас: {profile.totalPushups}.
          Загрузка заменит местный прогресс.
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
      </div>
    );
  }

  return (
    <>
      <button
        onClick={async () => {
          const save = await cloud.fetchSave();
          if (!save) setStatus('В облаке пока ничего нет.');
          else setConfirming(save);
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-arena-surface-2 px-3 py-2 text-xs font-medium text-arena-text active:scale-95"
      >
        <Download size={13} /> Загрузить прогресс с другого устройства
      </button>
      {status && <p className="mt-1.5 text-center text-[11px] text-arena-text-dim">{status}</p>}
    </>
  );
}

function ChooseNameForm({ cloud }: { cloud: Cloud }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-10">
      <h1 className="text-xl font-bold text-arena-text">Выбери имя</h1>
      <p className="mt-1 text-xs leading-snug text-arena-text-dim">
        Ты вошёл, но в таблице лидеров тебя ещё нет — под этим именем тебя увидят остальные.
      </p>
      <div className="mt-4">
        <Field label="Имя в таблице" value={name} onChange={setName} placeholder="2–24 символа" />
      </div>
      {error && <p className="mt-2 text-xs text-arena-red">{error}</p>}
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const err = await cloud.rename(name);
            if (err) setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy || name.trim().length < 2}
        className="arena-glow mt-4 w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-95 disabled:opacity-40"
      >
        {busy ? 'Минуту…' : 'Занять имя'}
      </button>
      <button
        onClick={() => void cloud.logout()}
        className="mt-3 w-full text-center text-xs text-arena-text-dim underline"
      >
        Выйти
      </button>
    </div>
  );
}

function AuthForm({ cloud }: { cloud: Cloud }) {
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'up') {
        const { error: err, needsConfirmation } = await cloud.register(email, password, displayName);
        if (err) setError(err.message);
        else if (needsConfirmation) setAwaitingConfirm(true);
      } else {
        const err = await cloud.login(email, password, displayName);
        if (err) setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Registering with confirmation switched on creates the account but no session. Saying nothing
  // here is what made the button look broken: the account appears in Supabase, and the app just
  // sits on the same form.
  if (awaitingConfirm) {
    return (
      <div className="mx-auto max-w-md px-4 pb-8 pt-10 text-center">
        <Mail size={28} className="mx-auto text-arena-amber" />
        <h1 className="mt-3 text-lg font-bold text-arena-text">Подтверди почту</h1>
        <p className="mt-2 text-sm leading-snug text-arena-text-dim">
          Аккаунт создан, но проект требует подтверждения адреса. Открой письмо от Supabase на{' '}
          <span className="text-arena-text">{email}</span> и перейди по ссылке — после этого
          возвращайся и входи.
        </p>
        <p className="mt-3 text-xs leading-snug text-arena-text-dim">
          Письма нет? Отключи подтверждение в Supabase: Authentication → Sign In / Providers →
          Email → Confirm email. Уже созданный аккаунт при этом придётся подтвердить вручную в
          разделе Users или удалить и зарегистрироваться заново.
        </p>
        <button
          onClick={() => {
            setAwaitingConfirm(false);
            setMode('in');
          }}
          className="mt-5 w-full rounded-xl bg-arena-surface-2 py-2.5 text-sm font-medium text-arena-text"
        >
          Я подтвердил — войти
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      <h1 className="text-xl font-bold text-arena-text">
        {mode === 'up' ? 'Создать аккаунт' : 'Вход'}
      </h1>
      <p className="mt-1 text-xs leading-snug text-arena-text-dim">
        Нужен только чтобы попасть в таблицу лидеров. Без него игра работает полностью — прогресс
        просто остаётся на этом устройстве.
      </p>

      <div className="mt-4 space-y-2">
        {mode === 'up' && (
          <Field
            label="Имя в таблице"
            value={displayName}
            onChange={setDisplayName}
            placeholder="как тебя увидят другие"
          />
        )}
        <Field label="Почта" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        <Field label="Пароль" value={password} onChange={setPassword} type="password" placeholder="от 6 символов" />
      </div>

      {error && <p className="mt-2 text-xs leading-snug text-arena-red">{error}</p>}

      <button
        onClick={() => void submit()}
        disabled={busy || !email || !password || (mode === 'up' && displayName.trim().length < 2)}
        className="arena-glow mt-4 w-full rounded-xl bg-arena-amber py-3 text-sm font-bold text-black active:scale-95 disabled:opacity-40"
      >
        {busy ? 'Минуту…' : mode === 'up' ? 'Создать аккаунт' : 'Войти'}
      </button>

      <button
        onClick={() => {
          setMode(mode === 'up' ? 'in' : 'up');
          setError(null);
        }}
        className="mt-3 w-full text-center text-xs text-arena-text-dim underline"
      >
        {mode === 'up' ? 'У меня уже есть аккаунт' : 'Создать новый аккаунт'}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-arena-text-dim">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text placeholder:text-arena-text-dim/60"
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 pb-8 pt-16 text-center">{children}</div>;
}
