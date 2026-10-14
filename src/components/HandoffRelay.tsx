import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { relayHandoff } from '../lib/cloud';

/**
 * What the Safari sheet shows when Google sends it back, for a sign-in started from the game on
 * the iPhone home screen. It passes the code on (see `relayHandoff`) and sends the player back to
 * the app, which finishes the sign-in itself — booting the whole game in here would only sign in
 * Safari's copy of it.
 */
export function HandoffRelay() {
  const [state, setState] = useState<'sending' | 'done' | string>('sending');

  useEffect(() => {
    void relayHandoff().then((err) => setState(err ? err.message : 'done'));
  }, []);

  return (
    <div className="safe-top safe-x safe-bottom flex min-h-screen flex-col items-center justify-center gap-4 bg-arena-bg px-8 text-center">
      {state === 'sending' ? (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-arena-amber" />
          <p className="text-sm text-arena-text-dim">Передаём вход в игру…</p>
        </>
      ) : state === 'done' ? (
        <>
          <Check className="h-12 w-12 text-arena-amber" />
          <h1 className="text-xl font-black uppercase tracking-[0.06em] text-arena-text">Вход выполнен</h1>
          <p className="text-sm leading-snug text-arena-text-dim">
            Нажми «Готово» вверху экрана, чтобы вернуться в игру, — она войдёт сама через пару секунд.
          </p>
        </>
      ) : (
        <>
          <X className="h-12 w-12 text-arena-red" />
          <h1 className="text-xl font-black uppercase tracking-[0.06em] text-arena-text">Не получилось</h1>
          <p className="text-sm leading-snug text-arena-text-dim">{state}</p>
          <p className="text-xs leading-snug text-arena-text-dim">Закрой это окно и попробуй ещё раз в игре.</p>
        </>
      )}
    </div>
  );
}
