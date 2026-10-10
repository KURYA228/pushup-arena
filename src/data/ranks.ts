/**
 * Three ranks, each measuring something different:
 *
 *  - **Звание** — by level, i.e. everything you've ever put in. Slow, permanent.
 *  - **Лига** — by push-ups this week. Starts again every Monday, so it's where you stand now,
 *    and the one you can climb by having a good week whatever your level.
 *  - **Сила** — by your best set without a pause. Not time in the game: what you can actually do.
 *
 * Rewards are status and looks only — an icon and a colour that show on the home screen and the
 * board, a frame around your avatar, the colour of your damage numbers. Nothing here changes
 * the fight.
 */

export interface RankDef {
  name: string;
  minLevel: number;
  icon: string;
  /** The rank's colour: avatar frame, name on the board, damage numbers in the fight. */
  color: string;
  /** What reaching it unlocks to look at, in words, for the ranks sheet. */
  perk: string;
}

export const RANKS: RankDef[] = [
  { name: 'Новичок', minLevel: 1, icon: '🔰', color: '#9ca3af', perk: 'серая рамка' },
  { name: 'Боец', minLevel: 5, icon: '🥊', color: '#60a5fa', perk: 'синяя рамка и цифры урона' },
  { name: 'Воин', minLevel: 10, icon: '⚔️', color: '#34d399', perk: 'зелёная рамка и цифры урона' },
  { name: 'Чемпион', minLevel: 20, icon: '🏆', color: '#f59e0b', perk: 'золотая рамка и цифры урона' },
  { name: 'Легенда', minLevel: 35, icon: '🌟', color: '#f472b6', perk: 'розовая рамка со свечением' },
  { name: 'Титан', minLevel: 50, icon: '🗿', color: '#a78bfa', perk: 'фиолетовая рамка со свечением' },
  // Пороги ниже намеренно оставлены как были, чтобы никто не потерял уже заработанный ранг.
  { name: 'Полубог', minLevel: 70, icon: '⚡', color: '#22d3ee', perk: 'бирюзовая сияющая рамка' },
  { name: 'Бессмертный', minLevel: 95, icon: '👑', color: '#fde047', perk: 'золотая корона и сияющая рамка' },
];

export function getRank(level: number): RankDef {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minLevel) current = rank;
  }
  return current;
}

export function nextRank(level: number): RankDef | null {
  return RANKS.find((rank) => rank.minLevel > level) ?? null;
}

/** Ranks from Легенда up glow; below that the frame is a plain ring. */
export const glows = (rank: RankDef) => rank.minLevel >= 35;

/* --------------------------------- leagues -------------------------------- */

export interface LeagueTier {
  name: string;
  /** Push-ups in a week to enter it. */
  min: number;
  icon: string;
  color: string;
}

/** Weekly push-ups. Mastery has no divisions; everything below it splits into III, II, I. */
export const LEAGUES: LeagueTier[] = [
  { name: 'Бронза', min: 0, icon: '🥉', color: '#c1783c' },
  { name: 'Серебро', min: 100, icon: '🥈', color: '#c3ccd8' },
  { name: 'Золото', min: 250, icon: '🥇', color: '#f5c542' },
  { name: 'Платина', min: 500, icon: '💠', color: '#5eead4' },
  { name: 'Алмаз', min: 800, icon: '💎', color: '#60a5fa' },
  { name: 'Мастер', min: 1200, icon: '🔥', color: '#ef4444' },
];

const DIVISIONS = ['III', 'II', 'I'] as const;

export interface LeagueStanding {
  tier: LeagueTier;
  /** 0, 1, 2 for III, II, I; null in Мастер. */
  division: number | null;
  /** "Золото II", or just "Мастер". */
  name: string;
  /** Push-ups at which this division starts, and at which the next one does (null at the top). */
  from: number;
  to: number | null;
  /** A single number to compare standings by: tier × 3 + division. */
  step: number;
}

export function leagueFor(weekReps: number): LeagueStanding {
  const reps = Math.max(0, Math.floor(weekReps));
  let t = 0;
  for (let i = 0; i < LEAGUES.length; i += 1) if (reps >= LEAGUES[i].min) t = i;
  const tier = LEAGUES[t];
  const next = LEAGUES[t + 1];
  if (!next) return { tier, division: null, name: tier.name, from: tier.min, to: null, step: t * 3 };

  // Thirds of the tier's span, rounded so the edges land on whole push-ups.
  const span = next.min - tier.min;
  const edges = [tier.min, tier.min + Math.round(span / 3), tier.min + Math.round((2 * span) / 3), next.min];
  let d = 0;
  for (let i = 0; i < 3; i += 1) if (reps >= edges[i]) d = i;
  return {
    tier,
    division: d,
    name: `${tier.name} ${DIVISIONS[d]}`,
    from: edges[d],
    to: edges[d + 1],
    step: t * 3 + d,
  };
}

/* -------------------------------- strength -------------------------------- */

export interface StrengthTier {
  name: string;
  /** Push-ups in one set without a pause. */
  min: number;
  icon: string;
  color: string;
}

export const STRENGTH: StrengthTier[] = [
  { name: 'Без разряда', min: 0, icon: '·', color: '#6b7280' },
  { name: 'Крепыш', min: 10, icon: '💪', color: '#a3e635' },
  { name: 'Силач', min: 20, icon: '🏋️', color: '#34d399' },
  { name: 'Атлет', min: 30, icon: '🤸', color: '#22d3ee' },
  { name: 'Богатырь', min: 50, icon: '🛡️', color: '#60a5fa' },
  { name: 'Геркулес', min: 75, icon: '🦁', color: '#f59e0b' },
  { name: 'Колосс', min: 100, icon: '🗽', color: '#ef4444' },
];

export function strengthFor(bestSet: number): StrengthTier {
  let current = STRENGTH[0];
  for (const tier of STRENGTH) if (bestSet >= tier.min) current = tier;
  return current;
}

export function nextStrength(bestSet: number): StrengthTier | null {
  return STRENGTH.find((t) => t.min > bestSet) ?? null;
}

/* --------------------------------- rank-ups ------------------------------- */

/** A promotion, for the announcement: which ladder, and what was reached. */
export interface RankUp {
  kind: 'level' | 'league' | 'strength';
  name: string;
  icon: string;
  color: string;
}

/** The promotions between two moments, given level, weekly push-ups and best set at each. */
export function rankUpsBetween(
  before: { level: number; weekReps: number; bestSet: number },
  after: { level: number; weekReps: number; bestSet: number },
): RankUp[] {
  const ups: RankUp[] = [];
  const r0 = getRank(before.level);
  const r1 = getRank(after.level);
  if (r1.minLevel > r0.minLevel) ups.push({ kind: 'level', name: r1.name, icon: r1.icon, color: r1.color });
  const l0 = leagueFor(before.weekReps);
  const l1 = leagueFor(after.weekReps);
  if (l1.step > l0.step) ups.push({ kind: 'league', name: l1.name, icon: l1.tier.icon, color: l1.tier.color });
  const s0 = strengthFor(before.bestSet);
  const s1 = strengthFor(after.bestSet);
  if (s1.min > s0.min) ups.push({ kind: 'strength', name: s1.name, icon: s1.icon, color: s1.color });
  return ups;
}
