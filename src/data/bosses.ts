export interface BossDef {
  id: string;
  name: string;
  title: string;
  /** Shown on the boss card opened from the home screen. */
  phrase: string;
  hp: number;
  baseDamage: number;
  critChance: number;
  critMultiplier: number;
  color: string;
  /**
   * Filename under `public/bosses/`, not a URL — resolved against the deploy base by
   * `BossIcon`. An absolute `/bosses/...` would break wherever the app isn't served from the
   * domain root, which is exactly how GitHub Pages serves it.
   */
  icon: string;
}

export const BOSSES: BossDef[] = [
  {
    id: 'grunt',
    name: 'Хват',
    title: 'Уличный задира',
    phrase: 'Ты чё, самый сильный тут?',
    hp: 60,
    baseDamage: 10,
    critChance: 0.12,
    critMultiplier: 2,
    color: '#9ca3af',
    icon: '01-grunt.jpg',
  },
  {
    id: 'brawler',
    name: 'Кувалда',
    title: 'Портовый громила',
    phrase: 'Я таскаю ящики. Ты таскаешь оправдания.',
    hp: 150,
    baseDamage: 10,
    critChance: 0.13,
    critMultiplier: 2,
    color: '#c17a3f',
    icon: '02-brawler.jpg',
  },
  {
    id: 'berserker',
    name: 'Ярость',
    title: 'Берсерк арены',
    phrase: 'Больно? Значит, работает.',
    hp: 280,
    baseDamage: 10,
    critChance: 0.14,
    critMultiplier: 2.2,
    color: '#b5432b',
    icon: '03-berserker.jpg',
  },
  {
    id: 'steelguard',
    name: 'Страж Стали',
    title: 'Несокрушимый',
    phrase: 'Об меня ломались и покрепче.',
    hp: 450,
    baseDamage: 10,
    critChance: 0.15,
    critMultiplier: 2.2,
    color: '#5c6773',
    icon: '04-steelguard.jpg',
  },
  {
    id: 'wraith',
    name: 'Тень Ярости',
    title: 'Ночной кошмар',
    phrase: 'Ты сдашься раньше, чем поймёшь, что я рядом.',
    hp: 700,
    baseDamage: 10,
    critChance: 0.16,
    critMultiplier: 2.5,
    color: '#5b3a8f',
    icon: '05-wraith.jpg',
  },
  {
    id: 'titanprime',
    name: 'Титан',
    title: 'Владыка нижней арены',
    phrase: 'Досюда доходят многие. Дальше — никто.',
    hp: 1000,
    baseDamage: 10,
    critChance: 0.18,
    critMultiplier: 2.5,
    color: '#b8860b',
    icon: '06-titanprime.jpg',
  },
  // Верхняя арена. Раньше игра кончалась на Титане — примерно 264 повтора, то есть неделя.
  // Эти шестеро добавляют ещё ~1530 повторов, чтобы прогрессия жила месяцами.
  {
    id: 'voidhammer',
    name: 'Молот Бездны',
    title: 'Кузнец боли',
    phrase: 'Каждый повтор — удар по наковальне. Наковальня здесь ты.',
    hp: 1350,
    baseDamage: 10,
    critChance: 0.19,
    critMultiplier: 2.6,
    color: '#4c3f7a',
    icon: '07-voidhammer.jpg',
  },
  {
    id: 'ironmaw',
    name: 'Железная Пасть',
    title: 'Пожиратель подходов',
    phrase: 'Твой подход я проглочу и не замечу.',
    hp: 1750,
    baseDamage: 10,
    critChance: 0.2,
    critMultiplier: 2.6,
    color: '#64748b',
    icon: '08-ironmaw.jpg',
  },
  {
    id: 'bloodking',
    name: 'Багровый Царь',
    title: 'Владыка крови',
    phrase: 'Кровь идёт к мышцам. Мышцы идут ко мне.',
    hp: 2200,
    baseDamage: 10,
    critChance: 0.21,
    critMultiplier: 2.8,
    color: '#8b1e2d',
    icon: '09-bloodking.jpg',
  },
  {
    id: 'stormborn',
    name: 'Грозорождённый',
    title: 'Гнев небес',
    phrase: 'Гром гремит каждый раз, когда ты опускаешься.',
    hp: 2700,
    baseDamage: 10,
    critChance: 0.22,
    critMultiplier: 2.8,
    color: '#2563eb',
    icon: '10-stormborn.jpg',
  },
  {
    id: 'worldbreaker',
    name: 'Крушитель Мира',
    title: 'Тот, кто ломает камень',
    phrase: 'Камень подо мной крошится. Посмотрим на тебя.',
    hp: 3300,
    baseDamage: 10,
    critChance: 0.23,
    critMultiplier: 3,
    color: '#c2410c',
    icon: '11-worldbreaker.jpg',
  },
  {
    id: 'apex',
    name: 'Апекс',
    title: 'Финальный страж арены',
    phrase: 'Я — твой потолок. Пробей меня.',
    hp: 4000,
    baseDamage: 10,
    critChance: 0.25,
    critMultiplier: 3,
    color: '#d4af37',
    icon: '12-apex.jpg',
  },
];

export function getBossBonusXp(boss: BossDef): number {
  return Math.round(boss.hp * 0.6);
}

export type BossStatus = 'defeated' | 'current' | 'upcoming';

export function bossStatusAt(index: number, currentIndex: number, defeatedIds: string[]): BossStatus {
  if (defeatedIds.includes(BOSSES[index].id)) return 'defeated';
  return index === currentIndex ? 'current' : 'upcoming';
}

/** 0 for the first boss, 1 for the last. Drives how much muscle the avatar carries. */
export function bossTier(index: number): number {
  if (BOSSES.length < 2) return 1;
  return Math.min(1, Math.max(0, index / (BOSSES.length - 1)));
}
