import type { BossAbility } from './abilities.ts';

/**
 * Each stage is three minions and then the boss.
 *
 * The minions are carved out of the stage's existing HP budget rather than piled on top of it:
 * the arena stays at roughly 3500 reps end to end, but you now get four kills per stage instead
 * of one. Same work, four times as many moments where something dies.
 */
export interface MinionDef {
  id: string;
  name: string;
  hp: number;
  /** Filename under `public/bosses/`, same scheme as the boss's own icon. */
  icon: string;
}

/** Named rep cues a stage can ask for instead of the default. */
export type HitSound = 'coins' | 'oink';

export interface BossDef {
  /**
   * Stable key. Deliberately unrelated to `name` by now: the profile stores defeated bosses by
   * id, so ids can never be renamed — display names can change freely, these can't.
   */
  id: string;
  name: string;
  /**
   * Genitive form, for phrases like «подчинённый Мясника». Spelled out rather than derived:
   * Russian declension is irregular here — «Громовержец» loses its fleeting е, «Утроба» and
   * «Погибель» take different endings entirely — and guessing would mangle half the roster.
   */
  nameGenitive: string;
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
  /**
   * Overrides the sound a counted rep makes against **this boss himself**. Left out — and for
   * every minion on his stage, always — the ordinary beep plays.
   *
   * A boss standing on a chest of gold should not be punched to the same blip as everyone
   * else; his three underlings, who are not that joke, should be. It is also what keeps the
   * cue worth hearing: a sound that plays for all four fights on a stage is the stage's
   * background noise, while one that starts when the boss appears marks his arrival.
   */
  hitSound?: HitSound;
  /** What makes this fight different. Minions never have any. */
  abilities: BossAbility[];
  minions: MinionDef[];
}

/** Share of the stage budget taken by each minion, then by the boss. Sums to 1. */
const MINION_SHARE = [0.12, 0.14, 0.16] as const;
const BOSS_SHARE = 0.58;

interface RawBoss {
  id: string;
  name: string;
  nameGenitive: string;
  title: string;
  phrase: string;
  /** Total HP of the whole stage — three minions plus the boss. */
  budget: number;
  baseDamage: number;
  critChance: number;
  critMultiplier: number;
  color: string;
  icon: string;
  hitSound?: HitSound;
  abilities: BossAbility[];
  minions: [string, string, string];
}

const RAW: RawBoss[] = [
  {
    // The id is the one thing here that must never change: finished bosses are remembered by
    // it, so renaming would quietly erase somebody's victories. Only the labels are swapped.
    id: 'grunt',
    name: 'Мистер Крабс',
    nameGenitive: 'Мистера Крабса',
    title: 'Берёт плату вперёд',
    phrase: 'Каждый повтор — мне в кассу. Не жадничай.',
    budget: 60,
    baseDamage: 10,
    critChance: 0.12,
    critMultiplier: 2,
    color: '#e0a423',
    icon: '01-grunt.jpg',
    hitSound: 'coins',
    abilities: [{ kind: 'armor', value: 0.1 }],
    minions: ['Сквидвард', 'Губка Боб', 'Планктон'],
  },
  {
    // Same rule as above: the id stays, only what's on screen changes.
    id: 'brawler',
    name: 'Король Свин',
    nameGenitive: 'Короля Свина',
    title: 'Корона тяжелее него',
    phrase: 'Яйца я уже украл. Теперь давай повторы.',
    budget: 150,
    baseDamage: 10,
    critChance: 0.13,
    critMultiplier: 2,
    color: '#7ab23c',
    icon: '02-brawler.jpg',
    hitSound: 'oink',
    abilities: [{ kind: 'armor', value: 0.15 }],
    minions: ['Капрал', 'Сержант', 'Повар'],
  },
  {
    // Again: the id is load-bearing, the labels are not.
    id: 'berserker',
    name: 'Грю',
    // Indeclinable, so the genitive is the same word — «подчинённый Грю».
    nameGenitive: 'Грю',
    title: 'Украл Луну, украдёт и подход',
    phrase: 'У меня целая армия помощников. У тебя — только руки.',
    budget: 280,
    baseDamage: 10,
    critChance: 0.14,
    critMultiplier: 2.2,
    color: '#9b6bd6',
    icon: '03-berserker.jpg',
    abilities: [{ kind: 'xpDrain', value: 0.15 }],
    minions: ['Боб', 'Стюарт', 'Кевин'],
  },
  {
    id: 'steelguard',
    name: 'Хребтолом',
    nameGenitive: 'Хребтолома',
    title: 'Считает твои позвонки',
    phrase: 'Ещё один. Ну давай, соври себе снова.',
    budget: 450,
    baseDamage: 10,
    critChance: 0.15,
    critMultiplier: 2.2,
    color: '#5c6773',
    icon: '04-steelguard.jpg',
    abilities: [{ kind: 'bulwark', value: 0.3 }],
    minions: ['Костыль', 'Тиски', 'Вправила'],
  },
  {
    id: 'wraith',
    name: 'Палач',
    nameGenitive: 'Палача',
    title: 'Приговор подписан до боя',
    phrase: '«Завтра начну» — так говорили все, кто здесь лежит.',
    budget: 700,
    baseDamage: 10,
    critChance: 0.16,
    critMultiplier: 2.5,
    color: '#5b3a8f',
    icon: '05-wraith.jpg',
    abilities: [{ kind: 'critImmune', value: 1 }],
    minions: ['Подручный', 'Верёвочник', 'Чтец приговора'],
  },
  {
    id: 'titanprime',
    name: 'Изувер',
    nameGenitive: 'Изувера',
    title: 'Ему нравится, когда долго',
    phrase: 'Мне не нужно тебя ломать. Ты бросишь сам.',
    budget: 1000,
    baseDamage: 10,
    critChance: 0.18,
    critMultiplier: 2.5,
    color: '#b8860b',
    icon: '06-titanprime.jpg',
    abilities: [{ kind: 'enrage', value: 0.3 }],
    minions: ['Клещи', 'Дознаватель', 'Молчаливый'],
  },
  {
    id: 'voidhammer',
    name: 'Мор',
    nameGenitive: 'Мора',
    title: 'Приходит за целыми залами',
    phrase: 'Я видел тысячи таких. Ни одного не запомнил.',
    budget: 1350,
    baseDamage: 10,
    critChance: 0.19,
    critMultiplier: 2.6,
    color: '#4c3f7a',
    icon: '07-voidhammer.jpg',
    abilities: [{ kind: 'xpDrain', value: 0.25 }],
    minions: ['Разносчик', 'Чумной', 'Пустой мешок'],
  },
  {
    id: 'ironmaw',
    name: 'Утроба',
    nameGenitive: 'Утробы',
    title: 'Проглатывает не жуя',
    phrase: 'Давай, старайся. Мне нравится смотреть.',
    budget: 1750,
    baseDamage: 10,
    critChance: 0.2,
    critMultiplier: 2.6,
    color: '#64748b',
    icon: '08-ironmaw.jpg',
    abilities: [{ kind: 'armor', value: 0.25 }],
    minions: ['Глотка', 'Пищевод', 'Желчь'],
  },
  {
    id: 'bloodking',
    name: 'Багровый Царь',
    nameGenitive: 'Багрового Царя',
    title: 'Тот, кому платят кровью',
    phrase: 'Ты качаешь мышцы. Я собираю с них дань.',
    budget: 2200,
    baseDamage: 10,
    critChance: 0.21,
    critMultiplier: 2.8,
    color: '#8b1e2d',
    icon: '09-bloodking.jpg',
    abilities: [{ kind: 'enrage', value: 0.4 }, { kind: 'regen', value: 0.03 }],
    minions: ['Кровопуск', 'Десятник', 'Сборщик дани'],
  },
  {
    id: 'stormborn',
    name: 'Громовержец',
    nameGenitive: 'Громовержца',
    title: 'Голос неба',
    phrase: 'Гром гремит, когда падаешь ты. Не наоборот.',
    budget: 2700,
    baseDamage: 10,
    critChance: 0.22,
    critMultiplier: 2.8,
    color: '#2563eb',
    icon: '10-stormborn.jpg',
    abilities: [{ kind: 'critImmune', value: 1 }, { kind: 'skipEvery', value: 5 }],
    minions: ['Искра', 'Раскат', 'Шквал'],
  },
  {
    id: 'worldbreaker',
    name: 'Жнец',
    nameGenitive: 'Жнеца',
    title: 'Ведёт учёт',
    phrase: 'Я не тороплюсь. Ты придёшь сам.',
    budget: 3300,
    baseDamage: 10,
    critChance: 0.23,
    critMultiplier: 3,
    color: '#c2410c',
    icon: '11-worldbreaker.jpg',
    abilities: [{ kind: 'bulwark', value: 0.45 }, { kind: 'noStop', value: 1 }],
    minions: ['Учётчик', 'Косарь', 'Молчун'],
  },
  {
    id: 'apex',
    name: 'Погибель',
    nameGenitive: 'Погибели',
    title: 'После неё не встают',
    phrase: 'Досюда добираются многие. Обратно — своим ходом никто.',
    budget: 4000,
    baseDamage: 10,
    critChance: 0.25,
    critMultiplier: 3,
    color: '#d4af37',
    icon: '12-apex.jpg',
    abilities: [{ kind: 'armor', value: 0.3 }, { kind: 'evenOnly', value: 1 }],
    minions: ['Предвестник', 'Плакальщик', 'Могильщик'],
  },
  {
    id: 'nameless',
    name: 'Забвение',
    nameGenitive: 'Забвения',
    title: 'Тебя не вспомнят',
    phrase: 'Через неделю ты забудешь, зачем начал. Я подожду.',
    budget: 4800,
    baseDamage: 10,
    critChance: 0.26,
    critMultiplier: 3,
    color: '#cbd5e1',
    icon: '13-nameless.jpg',
    abilities: [{ kind: 'xpDrain', value: 0.35 }, { kind: 'infection', value: 15 }],
    minions: ['Стёртый', 'Никто', 'Тень имени'],
  },
  {
    id: 'threshold',
    name: 'Отказ',
    nameGenitive: 'Отказа',
    title: 'То, чем кончается каждый подход',
    phrase: 'Я не соперник. Я то, что случится с тобой на середине.',
    budget: 5700,
    baseDamage: 10,
    critChance: 0.27,
    critMultiplier: 3.2,
    color: '#6d28d9',
    icon: '14-threshold.jpg',
    abilities: [{ kind: 'enrage', value: 0.5 }, { kind: 'bloodDebt', value: 0.2 }],
    minions: ['Дрожь', 'Судорога', 'Жжение'],
  },
  {
    id: 'absolute',
    name: 'Апекс',
    nameGenitive: 'Апекса',
    title: 'Выше нет ничего',
    phrase: 'Я — твой потолок. И ты его уже видишь.',
    budget: 6800,
    baseDamage: 10,
    critChance: 0.28,
    critMultiplier: 3.5,
    color: '#f5f5f4',
    icon: '15-absolute.jpg',
    abilities: [
      { kind: 'armor', value: 0.3 },
      { kind: 'critImmune', value: 1 },
      { kind: 'falseDeath', value: 10 },
      { kind: 'mirror', value: 1 },
    ],
    minions: ['Претендент', 'Наследник', 'Тень Апекса'],
  },
];

export const BOSSES: BossDef[] = RAW.map((r, index) => ({
  id: r.id,
  name: r.name,
  nameGenitive: r.nameGenitive,
  title: r.title,
  phrase: r.phrase,
  hp: Math.round(r.budget * BOSS_SHARE),
  baseDamage: r.baseDamage,
  critChance: r.critChance,
  critMultiplier: r.critMultiplier,
  color: r.color,
  icon: r.icon,
  hitSound: r.hitSound,
  abilities: r.abilities,
  minions: r.minions.map((name, i) => ({
    id: `${r.id}-m${i + 1}`,
    name,
    hp: Math.round(r.budget * MINION_SHARE[i]),
    icon: `${String(index + 1).padStart(2, '0')}-${r.id}-m${i + 1}.jpg`,
  })),
}));

/** Minions occupy steps 0..2 of a stage; the boss is step 3. */
export const BOSS_STEP = 3;
export const STEPS_PER_STAGE = BOSS_STEP + 1;

export interface Encounter {
  name: string;
  hp: number;
  icon: string;
  isBoss: boolean;
  abilities: BossAbility[];
}

/** Who you are fighting at a given point in a stage. */
export function encounterAt(boss: BossDef, step: number): Encounter {
  if (step >= BOSS_STEP) {
    return { name: boss.name, hp: boss.hp, icon: boss.icon, isBoss: true, abilities: boss.abilities };
  }
  const minion = boss.minions[Math.max(0, Math.min(step, boss.minions.length - 1))];
  return { name: minion.name, hp: minion.hp, icon: minion.icon, isBoss: false, abilities: [] };
}

/** Human-readable "where am I in this stage". */
export function stageProgressLabel(step: number): string {
  return step >= BOSS_STEP ? 'бой с боссом' : `подчинённый ${step + 1} из ${BOSS_STEP}`;
}

export function getBossBonusXp(boss: BossDef): number {
  return Math.round(boss.hp * 0.6);
}

/** Smaller pat on the back for clearing a minion. */
export function getMinionBonusXp(minion: MinionDef): number {
  return Math.round(minion.hp * 0.4);
}

export type BossStatus = 'defeated' | 'current' | 'upcoming';

export function bossStatusAt(index: number, currentIndex: number, defeatedIds: string[]): BossStatus {
  if (defeatedIds.includes(BOSSES[index].id)) return 'defeated';
  return index === currentIndex ? 'current' : 'upcoming';
}

/** 0 for the first boss, 1 for the last. Drives how much muscle the fallback silhouette carries. */
export function bossTier(index: number): number {
  if (BOSSES.length < 2) return 1;
  return Math.min(1, Math.max(0, index / (BOSSES.length - 1)));
}
