export interface RankDef {
  name: string;
  minLevel: number;
}

export const RANKS: RankDef[] = [
  { name: 'Новичок', minLevel: 1 },
  { name: 'Боец', minLevel: 5 },
  { name: 'Воин', minLevel: 10 },
  { name: 'Чемпион', minLevel: 20 },
  { name: 'Легенда', minLevel: 35 },
  { name: 'Титан', minLevel: 50 },
  // Пороги ниже намеренно оставлены как были, чтобы никто не потерял уже заработанный ранг.
  { name: 'Полубог', minLevel: 70 },
  { name: 'Бессмертный', minLevel: 95 },
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
