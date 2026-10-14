import { ArrowRight } from 'lucide-react';
import { NEW_HOME, isOldHome, newHomeUrl } from '../lib/moved';

/**
 * On the old GitHub address, for someone who already plays here: the game has moved, and how to
 * take the progress along. Not a forced redirect — what isn't in the cloud yet lives only in this
 * copy, so going is their call, after signing in.
 */
export function MovedBanner({ signedIn }: { signedIn: boolean }) {
  if (!isOldHome()) return null;
  return (
    <div className="mx-3 mt-2 rounded-xl border border-arena-amber/40 bg-arena-surface px-3.5 py-3 text-xs leading-snug text-arena-text-dim">
      <p className="text-sm font-semibold text-arena-text">Игра переехала</p>
      <p className="mt-1">
        Новый адрес работает и на мобильной связи. {signedIn
          ? 'Ты в аккаунте — прогресс подтянется там после входа.'
          : 'Чтобы прогресс переехал, сначала войди здесь в аккаунт — иначе он останется в этой копии.'}{' '}
        Открой адрес в Safari и добавь на экран «Домой», а эту иконку удали.
      </p>
      <a
        href={newHomeUrl()}
        className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-arena-amber py-2 text-sm font-bold text-arena-bg active:scale-95"
      >
        {NEW_HOME.replace(/^https:\/\/|\/$/g, '')} <ArrowRight size={14} />
      </a>
    </div>
  );
}
