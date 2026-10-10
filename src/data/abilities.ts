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
  | 'mirror'
  // Each boss's own, drawn from who he is. Stateful too.
  | 'entryFee'
  | 'piggyBank'
  | 'freezeRay'
  | 'retreat'
  | 'strictMom'
  | 'scream'
  | 'jokerCard'
  | 'teamwork'
  | 'endCrystals';

/**
 * The one pause the whole game measures by: three seconds or more ends a set. Every rule that
 * cares about a pause uses it — the end of a set, the strength rank's "in a row", the abilities
 * below — so there's a single number to learn. It's also the tick of "Регенерация": every
 * interval of idling hands the boss another slice of HP back.
 */
export const SET_BREAK_MS = 3000;
/** "Без остановки": the same pause as everything else — stop, and the set is gone. */
export const NO_STOP_MS = SET_BREAK_MS;
/** "Замораживающий луч": the same pause as everything else. */
export const FREEZE_PAUSE_MS = SET_BREAK_MS;
/** "Тактическое отступление" and "Скример" go off once, when the boss drops below this share of HP. */
export const HALF_HP = 0.5;
/** "Кристаллы Края": how many, and how many reps without a pause break one. */
export const END_CRYSTALS = 3;
export const CRYSTAL_REPS = 15;
/** "Кристаллы Края": damage taken while any crystal still stands. */
export const CRYSTAL_SHIELD = 0.5;
/** "Копилка": every this-many reps goes into the piggy bank instead of into the pig. */
export const PIGGY_EVERY = 3;

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
  entryFee: {
    name: 'Плата за вход',
    describe: (v) => `первые ${v} повтора каждого подхода уходят ему в кассу — без урона`,
  },
  piggyBank: {
    name: 'Копилка',
    describe: (v) => `каждый ${PIGGY_EVERY}-й повтор он не получает урон, а лечится на ${Math.round(v * 100)}% HP`,
  },
  freezeRay: {
    name: 'Замораживающий луч',
    describe: (v) => `пауза дольше ${FREEZE_PAUSE_MS / 1000} секунд — следующие ${v} повтора заморожены и не бьют`,
  },
  retreat: {
    name: 'Тактическое отступление',
    describe: (v) => `на половине HP один раз отступает и восстанавливает ${Math.round(v * 100)}% здоровья`,
  },
  strictMom: {
    name: 'Строгая мама',
    describe: (v) => `пауза ${v / 1000} секунд и дольше — повтор после неё не бьёт; отдых тоже не спасает`,
  },
  scream: {
    name: 'Скример',
    describe: (v) => `на половине HP пугает: ${v} повторов без паузы, иначе урон за них сгорает`,
  },
  jokerCard: {
    name: 'Карта-джокер',
    describe: (v) => `твой крит по нему не бьёт, а лечит его на ${Math.round(v * 100)}% от урона крита`,
  },
  teamwork: {
    name: 'Командная работа',
    describe: (v) => `подход короче ${v} повторов — Титаны прикрывают, урон за него пропадает`,
  },
  endCrystals: {
    name: 'Кристаллы Края',
    describe: () =>
      `пока цел хоть один из ${END_CRYSTALS} кристаллов, урон вдвое меньше; ${CRYSTAL_REPS} повторов без паузы разбивают кристалл`,
  },
};

export const describeAbility = (a: BossAbility) => ABILITY_INFO[a.kind].describe(a.value);

/**
 * An icon and one line of "how to beat it" per ability, for the scouting report shown before
 * a stage — knowing the rule is half of it; knowing what to do about it is the other half.
 */
export const ABILITY_TIPS: Record<AbilityKind, { icon: string; tip: string }> = {
  armor: { icon: '🛡️', tip: 'Просто больше повторов — обойти нельзя, только перебить.' },
  critImmune: { icon: '🚫', tip: 'Улучшения на крит здесь не помогут — качай силу удара.' },
  enrage: { icon: '😡', tip: 'Под конец он крепче — оставь силы на последние 40%.' },
  bulwark: { icon: '🐢', tip: 'Начало тяжёлое, дальше легче — не сдавайся в первых подходах.' },
  xpDrain: { icon: '📉', tip: 'Урон не меняется, просто меньше XP — бей как обычно.' },
  regen: { icon: '💚', tip: 'Не отдыхай — каждые 3 секунды паузы он лечится.' },
  skipEvery: { icon: '👻', tip: 'Каждый N-й повтор мимо — закладывай лишние повторы.' },
  noStop: { icon: '⏱️', tip: 'Не отдыхай дольше 3 секунд — иначе весь подход сотрётся.' },
  evenOnly: { icon: '⚖️', tip: 'Бьёт только каждый второй — нужно вдвое больше повторов.' },
  infection: { icon: '🦠', tip: 'Добивай подчинённых быстро, иначе следующий станет толще.' },
  bloodDebt: { icon: '🩸', tip: 'Длинные подходы — пауза возвращает ему часть урона.' },
  falseDeath: { icon: '💀', tip: 'На последнем HP не останавливайся — добивай без паузы.' },
  mirror: { icon: '🪞', tip: 'Второй подчинённый встанет ещё раз — будь готов.' },
  entryFee: { icon: '🪙', tip: 'Делай длинные подходы: касса берёт только первые повторы каждого.' },
  piggyBank: { icon: '🐷', tip: 'Каждый третий повтор — в копилку. Бей много и быстро.' },
  freezeRay: { icon: '❄️', tip: 'Не останавливайся дольше 3 секунд — иначе заморозит.' },
  retreat: { icon: '🏃', tip: 'На половине он подлечится один раз — это нормально, дожимай.' },
  strictMom: { icon: '😤', tip: 'Держи темп быстрее 3 секунд — после любой паузы первый повтор пропадёт.' },
  scream: { icon: '😱', tip: 'Когда испугает — сделай 10 подряд без паузы, иначе урон сгорит.' },
  jokerCard: { icon: '🃏', tip: 'Криты его лечат — улучшения на крит здесь вредят.' },
  teamwork: { icon: '🤝', tip: 'Подходы минимум по 5 — короче не засчитаются.' },
  endCrystals: { icon: '💎', tip: 'Подходы по 15 без паузы ломают кристаллы — потом урон полный.' },
};
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
