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
  | 'endCrystals'
  | 'tribute'
  | 'treasury'
  | 'turtleSoup'
  | 'elixir';

/**
 * The one pause the whole game measures by: five seconds or more ends a set. Every rule that
 * cares about a pause uses it — the end of a set, the strength rank's "in a row", the abilities
 * below — so there's a single number to learn. It's also the tick of "Регенерация": every
 * interval of idling hands the boss another slice of HP back.
 */
export const SET_BREAK_MS = 5000;
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
/** "Казна": how much of a blow gets through while the bogatyrs are covering the tsar. */
export const TREASURY_GUARD = 0.5;
/**
 * "Карта-джокер": the chance a rep crits against the Joker himself, in place of his stage's own.
 * Every crit heals him, and at the stage's usual 19% that came round often enough to make him
 * the hardest wall in the first half of the arena. His minions keep the usual chance.
 */
export const JOKER_CRIT_CHANCE = 0.07;
/** "Суп из черепашек": the pause on which the pot boils, counting from cold. */
export const SOUP_BOILS_AFTER = 3;
/** "Суп из черепашек": reps in one set without a pause that take the pot off the heat. */
export const SOUP_COOL_REPS = 10;
/** "Краденое яйцо": every this-many reps the pig steals an egg instead of taking the blow. */
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
    name: 'Краденое яйцо',
    describe: (v) => `каждый ${PIGGY_EVERY}-й повтор он крадёт яйцо — урона нет, а сам лечится на ${Math.round(v * 100)}% HP`,
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
    describe: (v) =>
      `криты по нему выпадают реже (${Math.round(JOKER_CRIT_CHANCE * 100)}%), но не бьют, а лечат его на ${Math.round(v * 100)}% от урона крита`,
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
  tribute: {
    name: 'Дань',
    describe: (v) => `каждый ${v}-й повтор подхода Антипка уносит в казну — без урона`,
  },
  turtleSoup: {
    name: 'Суп из черепашек',
    describe: (v) =>
      `каждая пауза дольше ${SET_BREAK_MS / 1000} секунд подогревает котёл; на ${SOUP_BOILS_AFTER}-й суп готов — он ужинает и лечится на ${Math.round(v * 100)}% HP. ${SOUP_COOL_REPS} повторов без паузы остужают котёл`,
  },
  elixir: {
    name: 'Эликсир',
    describe: (v) => `${v} секунд без удара — он выпивает эликсир и снова на полном HP`,
  },
  treasury: {
    name: 'Казна',
    describe: (v) =>
      `на половине HP открывает казну и нанимает богатырей: следующие ${v} повторов бьют вполсилы`,
  },
};

export const describeAbility = (a: BossAbility) => ABILITY_INFO[a.kind].describe(a.value);

/**
 * An icon — a drawn badge under `public/abilities/` (cut from the sheets by
 * scripts/slice-ability-sheet.mjs), or an emoji until one's drawn — and one line of "how to beat it" per ability, for the scouting report shown before
 * a stage — knowing the rule is half of it; knowing what to do about it is the other half.
 */
export const ABILITY_TIPS: Record<AbilityKind, { icon: string; tip: string }> = {
  armor: { icon: 'abilities/armor.png', tip: 'Просто больше повторов — обойти нельзя, только перебить.' },
  critImmune: { icon: 'abilities/critImmune.png', tip: 'Улучшения на крит здесь не помогут — качай силу удара.' },
  enrage: { icon: 'abilities/enrage.png', tip: 'Под конец он крепче — оставь силы на последние 40%.' },
  bulwark: { icon: 'abilities/bulwark.png', tip: 'Начало тяжёлое, дальше легче — не сдавайся в первых подходах.' },
  xpDrain: { icon: 'abilities/xpDrain.png', tip: 'Урон не меняется, просто меньше XP — бей как обычно.' },
  regen: { icon: 'abilities/regen.png', tip: `Не отдыхай — каждые ${SET_BREAK_MS / 1000} секунд паузы он лечится.` },
  skipEvery: { icon: 'abilities/skipEvery.png', tip: 'Каждый N-й повтор мимо — закладывай лишние повторы.' },
  noStop: { icon: 'abilities/noStop.png', tip: `Не отдыхай дольше ${NO_STOP_MS / 1000} секунд — иначе весь подход сотрётся.` },
  evenOnly: { icon: 'abilities/evenOnly.png', tip: 'Бьёт только каждый второй — нужно вдвое больше повторов.' },
  infection: { icon: 'abilities/infection.png', tip: 'Добивай подчинённых быстро, иначе следующий станет толще.' },
  bloodDebt: { icon: 'abilities/bloodDebt.png', tip: 'Длинные подходы — пауза возвращает ему часть урона.' },
  falseDeath: { icon: 'abilities/falseDeath.png', tip: 'На последнем HP не останавливайся — добивай без паузы.' },
  mirror: { icon: 'abilities/mirror.png', tip: 'Второй подчинённый встанет ещё раз — будь готов.' },
  entryFee: { icon: 'abilities/entryFee.png', tip: 'Делай длинные подходы: касса берёт только первые повторы каждого.' },
  piggyBank: { icon: 'abilities/piggyBank.png', tip: 'Каждый третий повтор он крадёт яйцо и лечится. Бей много и быстро.' },
  freezeRay: { icon: 'abilities/freezeRay.png', tip: `Не останавливайся дольше ${FREEZE_PAUSE_MS / 1000} секунд — иначе заморозит.` },
  retreat: { icon: 'abilities/retreat.png', tip: 'На половине он подлечится один раз — это нормально, дожимай.' },
  strictMom: { icon: 'abilities/strictMom.png', tip: `Держи темп быстрее ${SET_BREAK_MS / 1000} секунд — после любой паузы первый повтор пропадёт.` },
  scream: { icon: 'abilities/scream.png', tip: 'Когда испугает — сделай 10 подряд без паузы, иначе урон сгорит.' },
  jokerCard: { icon: 'abilities/jokerCard.png', tip: 'Криты его лечат — улучшения на крит здесь вредят.' },
  teamwork: { icon: 'abilities/teamwork.png', tip: 'Подходы минимум по 5 — короче не засчитаются.' },
  endCrystals: { icon: 'abilities/endCrystals.png', tip: 'Подходы по 15 без паузы ломают кристаллы — потом урон полный.' },
  tribute: { icon: 'abilities/tribute.png', tip: 'Каждый седьмой повтор подхода уходит в казну — закладывай лишние.' },
  elixir: { icon: 'abilities/elixir.png', tip: 'Бей без долгих пауз: дашь ему отдышаться — начнёшь сначала.' },
  turtleSoup: { icon: 'abilities/turtleSoup.png', tip: `Не давай котлу закипеть: подход в ${SOUP_COOL_REPS} повторов без паузы остужает его.` },
  treasury: { icon: 'abilities/treasury.png', tip: 'После половины HP богатыри прикроют его на 10 повторов — просто дожимай.' },
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

/* ------------------------------ new rounds (Круг) ------------------------------ */

/**
 * «Пройти снова» once the arena is beaten starts a new round (Круг 2, 3…): the same stages, the
 * same HP and the same blows — only every boss's abilities are sharper and more dangerous. `tier`
 * is how many rounds past the first; 0 is the arena as it was first fought.
 */
/** And the XP a rep earns grows by this much a round, so the harder fight pays. */
export const TIER_XP = 0.25;
/**
 * The last round there is (Круг 5). Past it the abilities have nowhere sensible left to go —
 * a boss you can't beat isn't a fight; the tests check every boss on it.
 */
export const MAX_TIER = 4;

/** The round «Пройти снова» starts after `cycle` rounds past the first are done: the next, up to the last. */
export const nextTier = (cycle: number | undefined) => Math.min(MAX_TIER, (cycle ?? 0) + 1);

/** Each ability, one round harder. Kept per kind: "stronger" means a bigger share for some, a
 * shorter wait for others, and nothing at all for the on/off ones. */
function harderBy(kind: AbilityKind, value: number, t: number): number {
  switch (kind) {
    case 'armor':
      return Math.min(0.5, value + 0.05 * t);
    case 'enrage':
    case 'bulwark':
      return Math.min(0.7, value + 0.1 * t);
    case 'bloodDebt':
      return Math.min(0.6, value + 0.1 * t);
    case 'retreat':
      return Math.min(0.5, value + 0.1 * t);
    case 'jokerCard':
      return Math.min(1.5, value + 0.25 * t);
    // The heals worked as a share of HP: a quarter more a round.
    case 'regen':
    case 'piggyBank':
    case 'turtleSoup':
      return value * (1 + 0.25 * t);
    case 'skipEvery':
      return Math.max(3, value - t);
    case 'tribute':
      return Math.max(4, value - t);
    case 'infection':
      return Math.max(8, value - 3 * t);
    case 'strictMom':
      return Math.max(3000, value - 1000 * t);
    case 'elixir':
      return Math.max(6, value - 2 * t);
    case 'falseDeath':
      return value + 5 * t;
    case 'entryFee':
    case 'freezeRay':
      return value + t;
    case 'scream':
      return value + 3 * t;
    case 'teamwork':
      return value + 2 * t;
    case 'treasury':
      return value + 5 * t;
    default:
      // Flags (critImmune, evenOnly, mirror, endCrystals, noStop), and xpDrain, which costs the
      // player XP rather than making the boss any harder to beat.
      return value;
  }
}

/** A boss's abilities as round `tier` has them. */
export function hardenAbilities(abilities: BossAbility[], tier: number): BossAbility[] {
  if (!(tier > 0)) return abilities;
  // Rounded so 0.1 + 0.05 reads as 0.15 in the descriptions, not 0.15000000000000002.
  return abilities.map((a) => ({ ...a, value: Math.round(harderBy(a.kind, a.value, Math.min(tier, MAX_TIER)) * 1000) / 1000 }));
}
