import { CRYSTAL_REPS, END_CRYSTALS, PIGGY_EVERY, SOUP_BOILS_AFTER, abilityValue, hasAbility, type BossAbility } from '../data/abilities.ts';
import type { FightState } from '../data/combat.ts';

/**
 * «Свиток разведки» (the shop): for the abilities that go off on a count — of reps on him, of reps
 * in the set, of pauses — how far off the next one is. The HP-threshold ones already have their
 * marks on the bar; these are the ones nothing on screen warned about.
 *
 * Counts are from the rep about to be made: `in: 1` means the very next rep is the one.
 */
export interface ScoutHint {
  icon: string;
  text: string;
}

const reps = (n: number) => (n === 1 ? 'следующий повтор' : `через ${n} повт.`);

export function scoutHints(abilities: BossAbility[], fight: FightState): ScoutHint[] {
  const out: ScoutHint[] = [];
  const onEnemy = fight.repsOnEnemy;
  const inSet = fight.setReps;
  if (hasAbility(abilities, 'piggyBank')) {
    out.push({ icon: '🥚', text: `Яйцо — ${reps(PIGGY_EVERY - (onEnemy % PIGGY_EVERY))}` });
  }
  if (hasAbility(abilities, 'skipEvery')) {
    const n = abilityValue(abilities, 'skipEvery');
    out.push({ icon: '👻', text: `Мимо — ${reps(n - (onEnemy % n))}` });
  }
  if (hasAbility(abilities, 'tribute')) {
    const n = abilityValue(abilities, 'tribute');
    out.push({ icon: '👑', text: `Дань — ${reps(n - (inSet % n))} подхода` });
  }
  if (hasAbility(abilities, 'entryFee')) {
    const fee = abilityValue(abilities, 'entryFee');
    if (inSet < fee) out.push({ icon: '🪙', text: `В кассу ещё ${fee - inSet} повт.` });
  }
  if (hasAbility(abilities, 'endCrystals') && (fight.crystalsBroken ?? 0) < END_CRYSTALS) {
    out.push({ icon: '💎', text: `Кристалл — ещё ${CRYSTAL_REPS - (inSet % CRYSTAL_REPS)} без паузы` });
  }
  if (hasAbility(abilities, 'turtleSoup')) {
    const left = SOUP_BOILS_AFTER - (fight.soupHeat ?? 0);
    out.push({ icon: '🍲', text: left === 1 ? 'Суп закипит на следующей паузе' : `Суп — через ${left} паузы` });
  }
  if (hasAbility(abilities, 'teamwork')) {
    const n = abilityValue(abilities, 'teamwork');
    if (inSet < n) out.push({ icon: '🤝', text: `Подход засчитается после ещё ${n - inSet} повт.` });
  }
  return out;
}
