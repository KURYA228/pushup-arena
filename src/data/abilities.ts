/**
 * Boss abilities.
 *
 * Every effect here is a pure function of the enemy's *current* HP and whether the rep crit —
 * nothing accumulates in hidden counters. That's deliberate: the "−1" button rewinds a rep by
 * restoring the HP that preceded it, so an ability that depended on "how many reps you've done
 * this fight" would silently desync the moment you undid one.
 */

export type AbilityKind =
  // Стateless: pure functions of current HP and the crit roll.
  | 'armor'
  | 'critImmune'
  | 'enrage'
  | 'bulwark'
  | 'xpDrain'
  // Stateful: these read the flow of the workout — pauses, rep counts, damage per set — and so
  // depend on FightState. See src/data/combat.ts.
  | 'regen'
  | 'skipEvery'
  | 'noStop'
  | 'evenOnly'
  | 'infection'
  | 'bloodDebt'
  | 'falseDeath'
  | 'mirror';

/**
 * A pause at least this long ends the current set — and is also the tick of "Регенерация":
 * every interval of idling hands the boss another slice of HP back.
 */
export const SET_BREAK_MS = 6000;
/** "Без остановки" punishes pauses longer than this — deliberately above SET_BREAK_MS. */
export const NO_STOP_MS = 8000;

export interface BossAbility {
  kind: AbilityKind;
  /** Strength as a fraction 0..1; what it scales depends on the kind. */
  value: number;
}

export const ABILITY_INFO: Record<
  AbilityKind,
  { name: string; describe: (value: number) => string }
> = {
  armor: {
    name: 'Толстокожесть',
    describe: (v) => `весь урон по нему слабее на ${Math.round(v * 100)}%`,
  },
  critImmune: {
    name: 'Стальная воля',
    describe: () => 'криты по нему не проходят',
  },
  enrage: {
    name: 'Ярость',
    describe: (v) => `ниже 40% HP урон по нему слабее на ${Math.round(v * 100)}%`,
  },
  bulwark: {
    name: 'Панцирь',
    describe: (v) => `выше 60% HP урон по нему слабее на ${Math.round(v * 100)}%`,
  },
  xpDrain: {
    name: 'Изматывание',
    describe: (v) => `за повторы в этом бою на ${Math.round(v * 100)}% меньше XP`,
  },
  regen: {
    name: 'Регенерация',
    describe: (v) => `пауза дольше ${SET_BREAK_MS / 1000} секунд возвращает ему ${Math.round(v * 100)}% HP`,
  },
  skipEvery: {
    name: 'Слепая зона',
    describe: (v) => `каждый ${v}-й повтор проходит мимо`,
  },
  noStop: {
    name: 'Без остановки',
    describe: () => `пауза дольше ${NO_STOP_MS / 1000} секунд обнуляет весь урон подхода`,
  },
  evenOnly: {
    name: 'Чётный урон',
    describe: () => 'урон наносит только каждый второй повтор',
  },
  infection: {
    name: 'Заражение',
    describe: (v) => `не добил подчинённого за ${v} повторов — остаток его HP перейдёт следующему`,
  },
  bloodDebt: {
    name: 'Кровавый долг',
    describe: (v) => `не добьёшь за подход — ему вернётся ${Math.round(v * 100)}% нанесённого урона`,
  },
  falseDeath: {
    name: 'Ложная смерть',
    describe: (v) => `на 1 HP не умирает — нужно ещё ${v} повторов без паузы`,
  },
  mirror: {
    name: 'Зеркало',
    describe: () => 'второй подчинённый один раз воскресает с половиной HP',
  },
};

export const describeAbility = (a: BossAbility) => ABILITY_INFO[a.kind].describe(a.value);
export const abilityName = (a: BossAbility) => ABILITY_INFO[a.kind].name;

export const hasAbility = (abilities: BossAbility[], kind: AbilityKind) =>
  abilities.some((a) => a.kind === kind);
export const abilityValue = (abilities: BossAbility[], kind: AbilityKind) =>
  abilities.find((a) => a.kind === kind)?.value ?? 0;

const has = hasAbility;
const strength = abilityValue;

/** Crits are rolled before abilities so "Стальная воля" can veto them. */
export function critLands(abilities: BossAbility[], rolled: boolean): boolean {
  return rolled && !has(abilities, 'critImmune');
}

/**
 * Damage a single rep deals, after the enemy's abilities take their cut.
 * `hpFraction` is the enemy's health *before* the hit, 0..1.
 */
export function damageDealt(
  baseDamage: number,
  critMultiplier: number,
  isCrit: boolean,
  abilities: BossAbility[],
  hpFraction: number,
): number {
  let dmg = baseDamage * (isCrit ? critMultiplier : 1);
  dmg *= 1 - strength(abilities, 'armor');
  if (hpFraction < 0.4) dmg *= 1 - strength(abilities, 'enrage');
  if (hpFraction > 0.6) dmg *= 1 - strength(abilities, 'bulwark');
  // Never let armour stack down to zero — a fight you cannot win isn't a fight.
  return Math.max(1, Math.round(dmg));
}

export function xpMultiplier(abilities: BossAbility[]): number {
  return 1 - strength(abilities, 'xpDrain');
}
