import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ArrowRight,
  Camera,
  Check,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  WifiOff,
} from 'lucide-react';
import type { Cloud } from '../hooks/useCloud';
import { Avatar } from './PlayerBadge';

/**
 * The way into an account.
 *
 * Three states, in the order a returning player meets them: a greeting for a device that already
 * knows you (password only), the full form for a new one, and the wait for a confirmation e-mail.
 * None of it gates the game — signing in only buys a place on the board.
 */
export function AuthView({ cloud, onSkip }: { cloud: Cloud; onSkip?: () => void }) {
  const [identified, setIdentified] = useState(Boolean(cloud.lastAccount));
  const [signInAnyway, setSignInAnyway] = useState(false);

  // Signed in as far as this device is concerned — the server just couldn't be reached. Asking
  // for a password here would be wrong twice over: it isn't needed, and it wouldn't work either.
  const body =
    cloud.unreachable && !signInAnyway ? (
      <Unreachable cloud={cloud} onSignInAnyway={() => setSignInAnyway(true)} />
    ) : cloud.lastAccount && identified ? (
      <WelcomeBack cloud={cloud} onReject={() => setIdentified(false)} />
    ) : (
      <FullForm cloud={cloud} />
    );

  return (
    <Stage>
      {body}
      {/* Only present when this screen is the app's front door — the game is never gated. */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-arena-text-dim active:scale-95"
        >
          <Swords size={13} /> Играть без аккаунта
        </button>
      )}
    </Stage>
  );
}

/** Signed in, but with no public row yet — the name chosen at sign-up never reached this device. */
export function ChooseNameForm({ cloud }: { cloud: Cloud }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const err = await cloud.rename(name);
      if (err) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stage>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={name || '?'} size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-arena-text">Выбери имя</h1>
            <p className="mt-0.5 text-xs leading-snug text-arena-text-dim">
              Под ним тебя увидят остальные на арене.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Field label="Имя в таблице" value={name} onChange={setName} placeholder="2–24 символа" />
        </div>

        <ErrorLine error={error} />

        <PrimaryButton onClick={submit} disabled={busy || name.trim().length < 2} busy={busy}>
          Занять имя
        </PrimaryButton>

        <button
          onClick={() => void cloud.logout()}
          className="mt-3 w-full text-center text-xs text-arena-text-dim underline"
        >
          Выйти
        </button>
      </motion.div>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */

function Unreachable({ cloud, onSignInAnyway }: { cloud: Cloud; onSignInAnyway: () => void }) {
  const who = cloud.lastAccount?.name ?? cloud.lastAccount?.email ?? null;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const again = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (!(await cloud.retry())) setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="text-center"
    >
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex justify-center"
      >
        <WifiOff size={30} className="text-arena-text-dim" />
      </motion.div>

      <h1 className="mt-3 text-lg font-bold text-arena-text">Сервер не отвечает</h1>
      <p className="mt-2 text-sm leading-snug text-arena-text-dim">
        {who ? (
          <>
            Ты по-прежнему в аккаунте <span className="text-arena-text">{who}</span> — вход
            сохранён на этом устройстве. Заново вводить пароль не нужно, таблица появится сама,
            как только вернётся связь.
          </>
        ) : (
          <>
            Вход сохранён на этом устройстве. Заново вводить пароль не нужно — таблица появится
            сама, как только вернётся связь.
          </>
        )}
      </p>
      <p className="mt-2 text-xs leading-snug text-arena-text-dim">
        Игра тем временем работает целиком: отжимания, боссы и Rush считаются на устройстве и
        уедут в облако позже.
      </p>

      {failed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-arena-red"
        >
          Связи всё ещё нет.
        </motion.p>
      )}

      <button
        onClick={() => void again()}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-arena-surface-2 py-2.5 text-sm font-medium text-arena-text active:scale-95 disabled:opacity-50"
      >
        <RefreshCw size={14} className={clsx(busy && 'animate-spin')} />
        {busy ? 'Пробуем…' : 'Повторить'}
      </button>

      <button
        onClick={onSignInAnyway}
        className="mt-3 w-full text-center text-xs text-arena-text-dim underline"
      >
        Войти другим аккаунтом
      </button>
    </motion.div>
  );
}

function WelcomeBack({ cloud, onReject }: { cloud: Cloud; onReject: () => void }) {
  const account = cloud.lastAccount!;
  const shown = account.name ?? account.email;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const err = await cloud.login(account.email, password, account.name ?? '');
      if (err) setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.05 }}
        className="flex justify-center"
      >
        <Avatar name={shown} size="lg" className="arena-glow" />
      </motion.div>

      <h1 className="mt-4 text-xl font-bold text-arena-text">С возвращением</h1>
      <p className="mt-1 truncate text-sm font-semibold text-arena-amber">{shown}</p>
      <p className="mt-0.5 truncate text-[11px] text-arena-text-dim">{account.email}</p>

      <form
        className="mt-5 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <PasswordField value={password} onChange={setPassword} autoFocus />
        <ErrorLine error={error} />
        <PrimaryButton type="submit" disabled={busy || password.length < 6} busy={busy}>
          Войти <ArrowRight size={15} />
        </PrimaryButton>
      </form>

      <button
        onClick={() => {
          cloud.forgetDevice();
          onReject();
        }}
        className="mt-3 w-full text-center text-xs text-arena-text-dim underline"
      >
        Это не я — войти в другой аккаунт
      </button>
    </motion.div>
  );
}

function FullForm({ cloud }: { cloud: Cloud }) {
  const [mode, setMode] = useState<'in' | 'up'>(cloud.lastAccount ? 'in' : 'up');
  const [email, setEmail] = useState(cloud.lastAccount?.email ?? '');
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
  if (awaitingConfirm) return <AwaitingConfirm email={email} onDone={() => { setAwaitingConfirm(false); setMode('in'); }} />;

  const ready =
    !busy && email.trim().length > 3 && password.length >= 6 && (mode === 'in' || displayName.trim().length >= 2);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <h1 className="text-center text-[26px] font-black uppercase leading-none tracking-[0.06em] text-arena-text">
        Push Up
        <br />
        <span className="text-arena-amber">Legends</span>
      </h1>
      <p className="mt-2.5 text-center text-xs leading-snug text-arena-text-dim">
        Отжимания — это удары. Пятнадцать боссов, у каждого своя способность, и сорок пять
        подчинённых по дороге к ним.
      </p>

      <div className="mt-4 flex justify-center gap-2">
        <Feature icon={Swords} label="15 боссов" />
        <Feature icon={Camera} label="счёт с камеры" />
        <Feature icon={Trophy} label="общий зачёт" />
      </div>

      <p className="mt-4 text-xs leading-snug text-arena-text-dim">
        Аккаунт нужен только чтобы соревноваться с другими. Без него игра работает полностью —
        прогресс просто остаётся на этом устройстве.
      </p>

      <Segmented mode={mode} onChange={(m) => { setMode(m); setError(null); }} />

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void submit();
        }}
      >
        <AnimatePresence initial={false}>
          {mode === 'up' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pb-2">
                <Field
                  label="Имя в таблице"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="как тебя увидят другие"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Почта" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        <div className="mt-2">
          <PasswordField value={password} onChange={setPassword} />
        </div>

        <RememberSwitch on={cloud.remember} onChange={cloud.setRemember} />

        <ErrorLine error={error} />

        <PrimaryButton type="submit" disabled={!ready} busy={busy}>
          {mode === 'up' ? 'Создать аккаунт' : 'Войти'}
        </PrimaryButton>
      </form>
    </motion.div>
  );
}

function AwaitingConfirm({ email, onDone }: { email: string; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="text-center"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex justify-center"
      >
        <Mail size={34} className="text-arena-amber" />
      </motion.div>
      <h1 className="mt-3 text-lg font-bold text-arena-text">Подтверди почту</h1>
      <p className="mt-2 text-sm leading-snug text-arena-text-dim">
        Аккаунт создан, но проект требует подтверждения адреса. Открой письмо от Supabase на{' '}
        <span className="text-arena-text">{email}</span> и перейди по ссылке — после этого
        возвращайся и входи.
      </p>
      <p className="mt-3 text-xs leading-snug text-arena-text-dim">
        Письма нет? Отключи подтверждение в Supabase: Authentication → Sign In / Providers → Email
        → Confirm email. Уже созданный аккаунт при этом придётся подтвердить вручную в разделе
        Users или удалить и зарегистрироваться заново.
      </p>
      <button
        onClick={onDone}
        className="mt-5 w-full rounded-xl bg-arena-surface-2 py-2.5 text-sm font-medium text-arena-text active:scale-95"
      >
        Я подтвердил — войти
      </button>
    </motion.div>
  );
}

/* ---------------------------- pieces ---------------------------- */

/** Three words on what the game actually is, for someone who opened it for the first time. */
function Feature({
  icon: Icon,
  label,
}: {
  icon: typeof Swords;
  label: string;
}) {
  return (
    <span className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-arena-border bg-arena-surface px-1.5 py-2">
      <Icon size={15} className="text-arena-amber" />
      <span className="text-center text-[10px] leading-tight text-arena-text-dim">{label}</span>
    </span>
  );
}

function Segmented({ mode, onChange }: { mode: 'in' | 'up'; onChange: (m: 'in' | 'up') => void }) {
  return (
    <div className="mt-5 flex rounded-xl border border-arena-border bg-arena-surface p-1">
      {/* Registration first: it's the default for anyone seeing this screen, and the highlight
          sitting on the right half of the control looked like it had slipped. */}
      {(['up', 'in'] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold"
        >
          {mode === id && (
            <motion.span
              layoutId="auth-mode-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="absolute inset-0 rounded-lg bg-arena-surface-2 ring-1 ring-arena-amber/40"
            />
          )}
          <span className={clsx('relative', mode === id ? 'text-arena-amber' : 'text-arena-text-dim')}>
            {id === 'in' ? 'Вход' : 'Регистрация'}
          </span>
        </button>
      ))}
    </div>
  );
}

function RememberSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-arena-border bg-arena-surface px-3 py-2.5 text-left active:scale-[0.99]"
    >
      <span
        className={clsx(
          'flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
          on ? 'bg-arena-amber' : 'bg-arena-surface-2 ring-1 ring-arena-border',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={clsx(
            'flex h-5 w-5 items-center justify-center rounded-full bg-arena-bg',
            on && 'ml-auto',
          )}
        >
          {on && <Check size={12} className="text-arena-amber" />}
        </motion.span>
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-arena-text">Запомнить это устройство</span>
        <span className="block text-[11px] leading-snug text-arena-text-dim">
          {on ? 'Вход сохранится — пароль больше не спросят.' : 'Выход при закрытии вкладки.'}
        </span>
      </span>
      <ShieldCheck size={16} className={clsx('ml-auto shrink-0', on ? 'text-arena-amber' : 'text-arena-text-dim/50')} />
    </button>
  );
}

function PasswordField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-arena-text-dim">Пароль</span>
      <span className="relative block">
        <input
          type={shown ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          placeholder="от 6 символов"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="current-password"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-arena-border bg-arena-bg px-3 py-2.5 pr-10 text-sm text-arena-text placeholder:text-arena-text-dim/60 focus:border-arena-amber/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-arena-text-dim"
        >
          {shown ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
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
        className="w-full rounded-lg border border-arena-border bg-arena-bg px-3 py-2.5 text-sm text-arena-text placeholder:text-arena-text-dim/60 focus:border-arena-amber/60 focus:outline-none"
      />
    </label>
  );
}

/** A wrong password is worth a flinch — it reads faster than any wording. */
function ErrorLine({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -7, 7, -4, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.34 }}
          className="mt-2.5 rounded-lg border border-arena-red/40 bg-arena-red/10 px-3 py-2 text-xs leading-snug text-arena-red"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="arena-glow mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-arena-amber py-3 text-sm font-bold text-black transition-opacity active:scale-[0.98] disabled:opacity-40"
    >
      {busy ? (
        // Bobs down and up while it waits — a push-up in place of a spinner.
        <motion.span
          className="inline-block"
          animate={{ opacity: [1, 0.55, 1], y: [0, 3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          Отжимаемся…
        </motion.span>
      ) : (
        children
      )}
    </button>
  );
}

/** Shared frame: the amber bloom that makes these screens feel like part of the arena. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-md overflow-hidden px-4 pb-10 pt-8">
      <motion.div
        aria-hidden
        animate={{ opacity: [0.2, 0.38, 0.2], scale: [1, 1.12, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-arena-amber blur-[80px]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
