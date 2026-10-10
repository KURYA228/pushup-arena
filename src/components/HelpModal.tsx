import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  Camera,
  Flame,
  ShoppingBag,
  Smartphone,
  Swords,
  Trophy,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { BOSSES } from '../data/bosses';
import { MAX_FREEZES, FREEZE_EVERY } from '../lib/streak';
import { PushupGuy } from './PushupGuy';

/**
 * "Как играть" — the whole game on one scrolling page, in the order a newcomer meets it.
 * Rules are pulled from the data where they live, so the text can't drift from the game.
 */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="safe-top safe-x fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Как играть"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-arena-border bg-arena-surface p-5 md:max-w-4xl md:p-7"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-3 top-3 rounded-full bg-arena-surface-2 p-2 text-arena-text-dim active:scale-95"
        >
          <X size={16} />
        </button>

        <PushupGuy className="mx-auto mb-2 h-36 w-44 md:h-44 md:w-56" />
        <h2 className="text-center text-xl font-bold text-arena-text">Как играть</h2>
        <p className="mt-1 text-center text-xs text-arena-text-dim">Отжимания — это удары. Всё остальное ниже.</p>

        {/* Sections deal in one after another; see Section for the per-item motion. */}
        {/* One column on a phone; two on a wide screen, where a single strip of cards left
            most of the monitor empty and the sheet scrolled for no reason. Columns rather than
            a grid so cards of different heights pack without holes. */}
        <motion.div
          className="mt-4 columns-1 gap-3 md:columns-2"
          initial="hidden"
          animate="shown"
          variants={{ shown: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
        >
          <Section icon={<Camera size={16} />} title="Камера считает отжимания">
            <p>
              Нажми <b>«Камера (AI)»</b> на экране боя и разреши доступ. Поставь телефон на пол{' '}
              <b>сбоку от себя</b>, в паре метров, чтобы в кадр попадал ты целиком — руки и корпус.
              Первые 2–3 отжимания камера подстраивается под тебя.
            </p>
            <p>
              Кнопка <b>«+»</b> — это <b>кликер</b>: она просто считает нажатия и в игру не идёт. Урон,
              XP, стрик и таблица лидеров — только от отжиманий с камеры.
            </p>
          </Section>

          <Section icon={<Volume2 size={16} />} title="Включи звук">
            <p>
              Пока отжимаешься, экрана не видно — каждый засчитанный повтор игра отмечает{' '}
              <b>звуком</b>. Без него непонятно, считает камера или нет.
            </p>
            <p>
              <b>iPhone:</b> выключи бесшумный режим — переключатель или кнопка действия сбоку
              телефона, а в Пункте управления — значок колокольчика. В бесшумном режиме игра молчит,
              даже если громкость на максимуме. Вибрации на iPhone нет — браузер её не поддерживает.
            </p>
            <p>
              <b>Android:</b> прибавь громкость мультимедиа. Звук и вибрацию можно включить или
              выключить в «Настройках» на экране боя.
            </p>
          </Section>

          <Section icon={<Swords size={16} />} title="Боссы">
            <p>
              Арена — {BOSSES.length} этапов. На каждом сначала три подчинённых, потом сам босс.
              Каждое отжимание бьёт того, кто перед тобой; иногда выпадает крит — удар сильнее.
            </p>
            <p>
              У боссов есть способности: броня, лечение во время пауз, урон только от чётных
              повторов и так далее. Тапни по боссу на главной — там написано, что он умеет.
            </p>
          </Section>

          <Section icon={<Trophy size={16} />} title="XP, уровни и ранги">
            <p>
              За каждое отжимание — XP, за убитых врагов — бонус. XP поднимает уровень, уровни
              открывают ранги: от Новичка до Бессмертного.
            </p>
          </Section>

          <Section icon={<ShoppingBag size={16} />} title="Магазин">
            <p>
              XP можно потратить на улучшения: сила удара, шанс и сила крита, «второе дыхание»
              против боссов, которые не любят пауз. Но XP списывается <b>из уровня</b> — после
              покупки уровень и ранг могут опуститься. Выбирай: сила или звание.
            </p>
          </Section>

          <Section icon={<Flame size={16} />} title="Стрик и заморозки">
            <p>
              Стрик — сколько дней подряд ты отжимаешься. Он даёт до +50% XP. Пропустил день —
              стрик сгорает, но его спасёт <b>заморозка</b> ❄: одна есть с самого начала, ещё одна
              даётся за каждые {FREEZE_EVERY} дней подряд, в запасе до {MAX_FREEZES}. Тратится сама.
            </p>
          </Section>

          <Section icon={<Zap size={16} />} title="Speed Rush">
            <p>
              60 секунд — сколько успеешь. Отжимания чаще раза в 2 секунды растят комбо. Хороший
              способ проверить себя и добрать XP.
            </p>
          </Section>

          <Section icon={<BarChart3 size={16} />} title="Статистика и карточки побед">
            <p>
              Во вкладке «Статы» — отжимания по дням, лучший подход и темп. Тапни по
              побеждённому боссу на главной — там карточка победы, ей можно поделиться.
            </p>
          </Section>

          <Section icon={<Smartphone size={16} />} title="Аккаунт и установка">
            <p>
              Аккаунт нужен для таблицы лидеров и чтобы прогресс не потерялся при смене телефона.
              Игру можно установить на экран «Домой» — так она работает без интернета.
            </p>
          </Section>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const calm = useReducedMotion();
  return (
    <motion.section
      variants={{
        hidden: calm ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 },
        shown: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
      }}
      className="mb-3 break-inside-avoid rounded-2xl border border-arena-border bg-arena-surface-2 p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-arena-text">
        {/* The icon pops in a beat after its card lands. */}
        <motion.span
          className="text-arena-amber"
          variants={{
            hidden: calm ? {} : { scale: 0, rotate: -40 },
            shown: { scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 500, damping: 12, delay: 0.12 } },
          }}
        >
          {icon}
        </motion.span>
        {title}
      </h3>
      <div className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-arena-text-dim">{children}</div>
    </motion.section>
  );
}
