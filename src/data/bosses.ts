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
export type HitSound = 'coins' | 'oink' | 'hurt' | 'freeze' | 'slap' | 'claws' | 'staff' | 'honk' | 'buzzer';
/** Recorded lines a boss can say as he walks out (files under `public/sfx/lines/`). */
export type BossLine = 'lineKrabs' | 'linePig' | 'lineGru' | 'lineSkipper' | 'lineNicole' | 'lineRobin' | 'lineFreddy' | 'lineJoker' | 'lineEnder';

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
  /**
   * What he says as he walks out, once, after the "Boss" call. A rep cue plays a hundred times
   * a session, so the voices live here and the rep cues stay plain sound effects.
   */
  line?: BossLine;
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
  line?: BossLine;
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
    // Not a line so much as a sigh: the "disappointed" sting from the show.
    line: 'lineKrabs',
    abilities: [{ kind: 'armor', value: 0.1 }, { kind: 'entryFee', value: 3 }],
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
    // The opening bars of the Angry Birds theme, faded out at the end of the phrase.
    line: 'linePig',
    abilities: [{ kind: 'armor', value: 0.15 }, { kind: 'piggyBank', value: 0.04 }],
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
    // His freeze ray, synthesised — see `freezeRay` in src/lib/feedback.ts.
    hitSound: 'freeze',
    // "Minions! Tonight, we steal the moon!" — and the cheering after it, faded out.
    line: 'lineGru',
    abilities: [{ kind: 'xpDrain', value: 0.15 }, { kind: 'freezeRay', value: 3 }],
    minions: ['Боб', 'Стюарт', 'Кевин'],
  },
  {
    // And once more: the id stays, the penguins move in.
    id: 'steelguard',
    name: 'Шкипер',
    nameGenitive: 'Шкипера',
    title: 'Командир элитного отряда',
    phrase: 'Улыбаемся и машем, бойцы!',
    budget: 450,
    baseDamage: 10,
    critChance: 0.15,
    critMultiplier: 2.2,
    color: '#f08a24',
    icon: '04-steelguard.jpg',
    // A flipper chop on every rep; the meme roll call once, as he walks out.
    hitSound: 'slap',
    line: 'lineSkipper',
    abilities: [{ kind: 'bulwark', value: 0.3 }, { kind: 'retreat', value: 0.15 }],
    minions: ['Рядовой', 'Рико', 'Ковальски'],
  },
  {
    // The id stays here too; the Wattersons move in.
    id: 'wraith',
    name: 'Николь',
    // A woman's name ending in a soft sign doesn't decline: «подчинённый Николь».
    nameGenitive: 'Николь',
    title: 'Мама с чёрным поясом',
    phrase: 'Дарвин — ты приёмный!',
    budget: 700,
    baseDamage: 10,
    critChance: 0.16,
    critMultiplier: 2.5,
    color: '#3fa9e0',
    icon: '05-wraith.jpg',
    // Claws through the air on every rep (synthesised, `clawSwipe` in src/lib/feedback.ts);
    // the show's theme as she walks out.
    hitSound: 'claws',
    line: 'lineNicole',
    abilities: [{ kind: 'critImmune', value: 1 }, { kind: 'strictMom', value: 3000 }],
    minions: ['Анаис', 'Дарвин', 'Гамбол'],
  },
  {
    // Id kept, as with every stage before it; the pizzeria opens.
    id: 'titanprime',
    name: 'Фредди',
    // Indeclinable: «подчинённый Фредди».
    nameGenitive: 'Фредди',
    title: 'Твоя смена — до шести утра',
    phrase: 'Лучше не смотри в камеру.',
    budget: 1000,
    baseDamage: 10,
    critChance: 0.18,
    critMultiplier: 2.5,
    color: '#a0632e',
    icon: '06-titanprime.jpg',
    // His nose honk on every rep (synthesised, `noseHonk` in src/lib/feedback.ts); the meme and
    // the start of his song as he walks out.
    hitSound: 'honk',
    line: 'lineFreddy',
    abilities: [{ kind: 'enrage', value: 0.3 }, { kind: 'scream', value: 10 }],
    minions: ['Чика', 'Бонни', 'Фокси'],
  },
  {
    // Id kept; Gotham's worst move in.
    id: 'voidhammer',
    name: 'Джокер',
    nameGenitive: 'Джокера',
    title: 'Смеётся последним',
    phrase: 'Рассказать анекдот?',
    budget: 1350,
    baseDamage: 10,
    critChance: 0.19,
    critMultiplier: 2.6,
    color: '#7b3fb5',
    icon: '07-voidhammer.jpg',
    // His joy buzzer on every rep (synthesised, `joyBuzzer` in src/lib/feedback.ts); the last,
    // biggest run of his laugh as he walks out.
    hitSound: 'buzzer',
    line: 'lineJoker',
    abilities: [{ kind: 'xpDrain', value: 0.25 }, { kind: 'jokerCard', value: 0.5 }],
    minions: ['Пингвин', 'Загадочник', 'Харли Квинн'],
  },
  {
    // Id kept; the Titans take the tower.
    id: 'ironmaw',
    name: 'Робин',
    nameGenitive: 'Робина',
    title: 'Лидер Юных Титанов',
    phrase: 'Титаны, вперёд!',
    budget: 1750,
    baseDamage: 10,
    critChance: 0.2,
    critMultiplier: 2.6,
    color: '#d93a3a',
    icon: '08-ironmaw.jpg',
    // His bo staff on every rep (synthesised, `staffStrike` in src/lib/feedback.ts); his song
    // from the show as he walks out.
    hitSound: 'staff',
    line: 'lineRobin',
    abilities: [{ kind: 'armor', value: 0.25 }, { kind: 'teamwork', value: 5 }],
    minions: ['Бист Бой', 'Киборг', 'Старфайр'],
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
    abilities: [{ kind: 'enrage', value: 0.4 }, { kind: 'regen', value: 0.015 }],
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
    // Id kept; the End opens.
    id: 'nameless',
    name: 'Эндер-дракон',
    nameGenitive: 'Эндер-дракона',
    title: 'Хозяин Края',
    phrase: 'Ты быстро повзрослел, хотя ещё недавно был маленьким!',
    budget: 4800,
    baseDamage: 10,
    critChance: 0.26,
    critMultiplier: 3,
    color: '#a855f7',
    icon: '13-nameless.jpg',
    // Minecraft's own sounds: the damage "oof" on every rep, the level-up jingle as he arrives.
    hitSound: 'hurt',
    line: 'lineEnder',
    abilities: [{ kind: 'xpDrain', value: 0.35 }, { kind: 'infection', value: 15 }, { kind: 'endCrystals', value: 1 }],
    minions: ['Зомби', 'Скелет', 'Крипер'],
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
  line: r.line,
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
