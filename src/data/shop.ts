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

export type UpgradeId = 'power' | 'precision' | 'heavy' | 'breath';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What one level gives, for the shop card. */
  perLevel: string;
  /** Cost of each level in XP; the length is the maximum level. */
  costs: number[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'Сила удара', perLevel: '+10% урона по всем врагам', costs: [300, 700, 1300, 2100, 3200] },
  { id: 'precision', name: 'Меткость', perLevel: '+2% к шансу крита', costs: [250, 600, 1100, 1800, 2700] },
  { id: 'heavy', name: 'Тяжёлая рука', perLevel: '+0.25 к множителю крита', costs: [400, 900, 1600, 2600] },
  {
    id: 'breath',
    name: 'Второе дыхание',
    perLevel: '+1 с к допустимой паузе: подход длится дольше, Регенерация и «Без остановки» срабатывают позже',
    costs: [500, 1200, 2400],
  },
];

/** A streak freeze, bought one at a time. The stock cap from src/lib/streak.ts still applies. */
export const FREEZE_COST = 600;

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
}

export const NO_PERKS: PlayerPerks = { damageMult: 1, critBonus: 0, critMultBonus: 0, breathMs: 0 };

export function perksFrom(u: Upgrades | undefined): PlayerPerks {
  return {
    damageMult: 1 + 0.1 * upgradeLevel(u, 'power'),
    critBonus: 0.02 * upgradeLevel(u, 'precision'),
    critMultBonus: 0.25 * upgradeLevel(u, 'heavy'),
    breathMs: 1000 * upgradeLevel(u, 'breath'),
  };
}
