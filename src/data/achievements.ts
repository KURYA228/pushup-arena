import type { ProfileRecord } from '../types';
import { BOSSES } from './bosses';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
  check: (p: ProfileRecord) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', title: 'Первая кровь', description: 'Сделай первое отжимание', emoji: '🩸', check: (p) => p.totalPushups >= 1 },
  { id: 'century', title: 'Сотня', description: '100 отжиманий всего', emoji: '💯', check: (p) => p.totalPushups >= 100 },
  { id: 'grinder', title: 'Работяга', description: '500 отжиманий всего', emoji: '🔥', check: (p) => p.totalPushups >= 500 },
  { id: 'machine', title: 'Машина', description: '1000 отжиманий всего', emoji: '⚙️', check: (p) => p.totalPushups >= 1000 },
  { id: 'legion', title: 'Легион', description: '5000 отжиманий всего', emoji: '🏆', check: (p) => p.totalPushups >= 5000 },
  { id: 'monolith', title: 'Монолит', description: '10000 отжиманий всего', emoji: '🗿', check: (p) => p.totalPushups >= 10000 },
  { id: 'streak_3', title: 'Разогрев', description: 'Стрик 3 дня подряд', emoji: '📅', check: (p) => p.streak >= 3 },
  { id: 'streak_7', title: 'Неделя огня', description: 'Стрик 7 дней подряд', emoji: '🔥', check: (p) => p.streak >= 7 },
  { id: 'streak_30', title: 'Железная воля', description: 'Стрик 30 дней подряд', emoji: '🗓️', check: (p) => p.streak >= 30 },
  { id: 'first_boss', title: 'Первая победа', description: 'Побеждён первый босс', emoji: '⚔️', check: (p) => p.bossesDefeated.length >= 1 },
  { id: 'halfway', title: 'На полпути', description: 'Побеждена половина боссов арены', emoji: '🛡️', check: (p) => p.bossesDefeated.length >= Math.floor(BOSSES.length / 2) },
  { id: 'bonecrusher', title: 'Костолом', description: 'Побеждено 9 боссов', emoji: '☠️', check: (p) => p.bossesDefeated.length >= 9 },
  { id: 'arena_champion', title: 'Чемпион арены', description: 'Все боссы повержены', emoji: '👑', check: (p) => p.bossesDefeated.length >= BOSSES.length },
  { id: 'rush_20', title: 'Спринтер', description: '20 повторов за один Speed Rush', emoji: '⚡', check: (p) => p.rushBestReps >= 20 },
  { id: 'rush_40', title: 'Скорость света', description: '40 повторов за один Speed Rush', emoji: '💫', check: (p) => p.rushBestReps >= 40 },
  { id: 'combo_10', title: 'Комбо-мастер', description: 'Комбо x10 в Speed Rush', emoji: '✨', check: (p) => p.rushBestCombo >= 10 },
];

export function checkNewAchievements(p: ProfileRecord): string[] {
  return ACHIEVEMENTS.filter((a) => !p.achievementsUnlocked.includes(a.id) && a.check(p)).map((a) => a.id);
}
