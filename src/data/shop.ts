/**
 * The shop: XP spent on upgrades.
 *
 * XP is the stored value and level is derived from it, so spending XP really does cost levels —
 * and rank, and the level on the leaderboard. That's the trade: strength now against standing.
 * A purchase can't take you below zero, but it can take you down several levels at once.
 *
 * Upgrades are permanent and stack by level; each next level costs more. Prices are spelled out
 * rather than computed so they can be tuned one by one.
 */

export type UpgradeId = 'power' | 'precision' | 'heavy' | 'breath' | 'pierce' | 'hunter' | 'scout';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What one level gives, for the shop card. */
  perLevel: string;
  /** Cost of each level in XP; the length is the maximum level. */
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'Сила удара', perLevel: '+10% урона по всем врагам', costs: [340, 800, 1490, 2420, 3680] },
  { id: 'precision', name: 'Меткость', perLevel: '+2% к шансу крита', costs: [290, 690, 1260, 2070, 3100] },
  { id: 'heavy', name: 'Тяжёлая рука', perLevel: '+0.25 к множителю крита', costs: [460, 1040, 1840, 2990] },
  {
    id: 'breath',
    name: 'Второе дыхание',
    perLevel: '+1 с к допустимой паузе: подход длится дольше, Регенерация и «Без остановки» срабатывают позже',
    costs: [580, 1380, 2760],
  },
  { id: 'pierce', name: 'Бронебой', perLevel: '−5% к «Толстокожести» босса', costs: [460, 1150, 2070] },
  { id: 'hunter', name: 'Метка охотника', perLevel: '+15% опыта за победу над боссом и подчинённым', costs: [580, 1260, 2300] },
  {
    id: 'scout',
    name: 'Свиток разведки',
    perLevel: 'В бою с боссом видно, через сколько повторов сработает его способность: яйцо, дань, касса, кристаллы, суп',
    costs: [800],
  },
];

/** What «Метка охотника» adds to a kill's bonus XP, a level. */
export const HUNTER_BONUS = 0.15;

/** A streak freeze, bought one at a time. The stock cap from src/lib/streak.ts still applies. */
export const FREEZE_COST = 690;

/**
 * Consumables: bought one at a time, held in stock up to a cap, used up in the arena.
 *
 *  - «Зелье ярости» is drunk by hand before a hard stretch: the next RAGE_REPS arena reps hit
 *    RAGE_MULT times as hard.
 *  - «Оберег» works on its own: the next time a boss's ability would go off on you — a heal, a
 *    freeze, a scream, the treasury, refusing to die — it doesn't, and one charm is spent.
 */
export type ConsumableId = 'rage' | 'ward' | 'hourglass' | 'double';
export const CONSUMABLES: Record<ConsumableId, { name: string; detail: string; cost: number; max: number }> = {
  rage: { name: 'Зелье ярости', detail: 'Выпей в бою — следующие 20 повторов бьют вдвое сильнее', cost: 400, max: 3 },
  ward: { name: 'Оберег', detail: 'Сам гасит одно срабатывание способности босса: лечение, заморозку, крик, отказ умирать', cost: 580, max: 2 },
  hourglass: { name: 'Песочные часы', detail: 'Сами тратятся на отдых между подчинёнными: вместо 3 секунд — одна', cost: 110, max: 5 },
  double: { name: 'Двойной удар', detail: 'Включи в бою — следующие 10 повторов по подчинённым бьют дважды', cost: 340, max: 3 },
};
/** The profile field each consumable's stock is kept in. */
export const STOCK_FIELD = { rage: 'rage', ward: 'wards', hourglass: 'hourglasses', double: 'doubles' } as const;
export const DOUBLE_REPS = 10;
export const RAGE_REPS = 20;
export const RAGE_MULT = 2;

export type Upgrades = Partial<Record<UpgradeId, number>>;

export const upgradeLevel = (u: Upgrades | undefined, id: UpgradeId) => u?.[id] ?? 0;

/** Price of the next level, or null when the upgrade is maxed out. */
export function nextCost(u: Upgrades | undefined, def: UpgradeDef): number | null {
  return def.costs[upgradeLevel(u, def.id)] ?? null;
}

/** What the upgrades add up to in a fight. */
export interface PlayerPerks {
  damageMult: number;
  critBonus: number;
  critMultBonus: number;
  /** Added to every pause limit — the set break, "Без остановки" and the regeneration tick. */
  breathMs: number;
  /** Taken off a boss's "Толстокожесть" (a share of damage, like the ability's own value). */
  armorPierce: number;
  /** «Зелье ярости» is working: every blow is RAGE_MULT times as hard. */
  rage?: boolean;
  /** An «Оберег» is in stock, ready to cancel the next boss ability that goes off. */
  ward?: boolean;
  /** «Двойной удар» is on: a blow at a minion lands twice. */
  double?: boolean;
  /**
   * Which round of the arena this is (Круг, src/data/abilities.ts): 0 or absent for the first.
   * Not bought — carried here because it changes the fight the same way perks do.
   */
  tier?: number;
}

export const NO_PERKS: PlayerPerks = { damageMult: 1, critBonus: 0, critMultBonus: 0, breathMs: 0, armorPierce: 0 };

export function perksFrom(u: Upgrades | undefined): PlayerPerks {
  return {
    damageMult: 1 + 0.1 * upgradeLevel(u, 'power'),
    critBonus: 0.02 * upgradeLevel(u, 'precision'),
    critMultBonus: 0.25 * upgradeLevel(u, 'heavy'),
    breathMs: 1000 * upgradeLevel(u, 'breath'),
    armorPierce: 0.05 * upgradeLevel(u, 'pierce'),
  };
}
