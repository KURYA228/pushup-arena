import { useEffect, useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { HintCard } from './HintCard';
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  onInstallPromptChange,
  platform,
  promptInstall,
  useHint,
} from '../lib/hints';

/**
 * "Put the game on your home screen" — shown on phones that are running it in a browser tab.
 *
 * Worth more than convenience: an installed app keeps its storage, while iOS may wipe a site's
 * data after a stretch of not being opened, and Safari and the home-screen icon keep separate
 * storage — progress made in one isn't in the other.
 */
export function InstallHint() {
  const [visible, dismiss] = useHint('install');
  const [canPrompt, setCanPrompt] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange(() => setCanPrompt(canPromptInstall())), []);

  const os = platform();
  if (!visible || isStandalone() || os === 'other') return null;

  return (
    <HintCard icon={<Smartphone size={16} />} title="Установи игру на телефон" onClose={dismiss}>
      <p>
        Появится иконка на экране, игра откроется на весь экран и будет работать без интернета. И
        прогресс надёжнее: из браузера телефон может сам стереть данные сайта.
      </p>

      {os === 'ios' &&
        (isIosSafari() ? (
          <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-arena-text">
            <li>
              Нажми «Поделиться» <Share size={12} className="inline -mt-0.5 text-arena-amber" /> внизу
              Safari
            </li>
            <li>Выбери «На экран «Домой»»</li>
            <li>Нажми «Добавить»</li>
          </ol>
        ) : (
          <p className="mt-2 text-arena-text">
            На iPhone установить можно только из <b>Safari</b>: открой там эту же страницу и нажми
            «Поделиться» → «На экран «Домой»».
          </p>
        ))}

      {os === 'android' &&
        (canPrompt ? (
          <button
            onClick={() => void promptInstall().then((ok) => ok && dismiss())}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-arena-amber py-2.5 text-sm font-semibold text-arena-bg active:scale-[0.98]"
          >
            <Download size={16} /> Установить
          </button>
        ) : (
          <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-arena-text">
            <li>Открой меню браузера «⋮» в углу</li>
            <li>Выбери «Установить приложение» или «Добавить на главный экран»</li>
          </ol>
        ))}

      {/* Only iOS splits them: Safari and the home-screen app don't share storage. */}
      {os === 'ios' && (
        <p className="mt-2">
          Важно: у установленной игры отдельный прогресс от Safari. Если уже играл в браузере —
          войди в аккаунт, и он подтянется.
        </p>
      )}
    </HintCard>
  );
}
