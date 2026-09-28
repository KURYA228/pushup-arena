import {
  NO_STOP_MS,
  SET_BREAK_MS,
  abilityValue,
  critLands,
  damageDealt,
  hasAbility,
  xpMultiplier,
} from './abilities.ts';
import { BOSSES, BOSS_STEP, encounterAt } from './bosses.ts';

/**
 * Arena combat, as one pure function.
 *
 * The stateful abilities — regeneration on a pause, blind spots at the start of a set, damage
 * refunded when you don't finish a boss in one go — mean a rep's outcome no longer follows from
 * HP alone. It follows from *how* you're training: the gaps between reps, where you are in the
 * set, how much you've already landed. All of that lives in {@link FightState}.
 *
 * Keeping it here, free of React and IndexedDB, buys two things. The rules are testable against
 * a synthetic clock, which matters when a bug means a boss quietly heals forever. And the whole
 * fight state is a small plain object, so the "−1" button undoes a rep by restoring a snapshot
 * of it rather than trying to run every rule backwards.
 *
 * Pause-driven effects can't fire on their own — nothing runs while you rest. They're settled
 * lazily at the start of the next rep, by measuring the gap that just ended.
 */
export interface FightState {
  /** Timestamp of the last counted rep; null before the first. */
  lastRepAt: number | null;
  /** Reps done so far in the current set. */
  setReps: number;
  /** Enemy HP when the current set began — what "Без остановки" rewinds to. */
  hpAtSetStart: number;
  /** Damage landed during the current set — what "Кровавый долг" refunds a share of. */
  damageThisSet: number;
  /** Reps aimed at the current enemy, across sets. Drives "Чётный урон" and "Заражение". */
  repsOnEnemy: number;
  /** Full HP of the current enemy, including anything inherited via "Заражение". */
  enemyMaxHp: number;
  /** HP an un-killed minion leaks into the next one. */
  carriedHp: number;
  /** Minions that have already spent their "Зеркало" revival. */
  revivedIds: string[];
  /** Reps landed while the boss is holding on at 1 HP under "Ложная смерть". */
  lastStandReps: number;
  /**
   * Point from which "Регенерация" counts its ticks. Advanced whole intervals at a time so the
   * heal is a function of wall-clock time, not of when the app happened to be looking.
   */
  regenAt: number | null;
}

export interface ArenaState {
  bossIndex: number;
  stageStep: number;
  enemyHp: number;
  bossesDefeated: string[];
  fight: FightState;
}

/** Why a rep did no damage, so the UI can say so instead of looking broken. */
export type BlockedReason = 'blind-spot' | 'odd-rep' | 'last-stand' | null;

export interface RepOutcome {
  next: ArenaState;
  damage: number;
  isCrit: boolean;
  bossDefeated: boolean;
  minionDefeated: boolean;
  /** A minion came back under "Зеркало". */
  revived: boolean;
  /** The rep cleared the last minion, so the boss himself is next. */
  bossReached: boolean;
  enemyName: string;
  blocked: BlockedReason;
  /** HP the enemy clawed back from the pause that preceded this rep. */
  healed: number;
  /** Multiplier applied to the rep's XP by "Изматывание". */
  xpFactor: number;
}

export function freshFight(enemyHp: number): FightState {
  return {
    lastRepAt: null,
    setReps: 0,
    hpAtSetStart: enemyHp,
    damageThisSet: 0,
    repsOnEnemy: 0,
    enemyMaxHp: enemyHp,
    carriedHp: 0,
    revivedIds: [],
    lastStandReps: 0,
    regenAt: null,
  };
}

/**
 * Hands a regenerating boss back HP for every full interval of idling.
 *
 * Called both from the rep resolver and from a ticker while you rest — a boss that only heals
 * the instant you resume looks frozen while you're catching your breath, which is precisely when
 * the pressure is supposed to be felt. Whole ticks are consumed from `regenAt` rather than
 * measuring against "now", so calling this once a second or once an hour gives the same result.
 */
export function applyIdleRegen(state: ArenaState, now: number): { state: ArenaState; healed: number } {
  const boss = BOSSES[Math.min(state.bossIndex, BOSSES.length - 1)];
  const enemy = encounterAt(boss, state.stageStep);
  const from = state.fight.regenAt;
  if (!enemy.isBoss || !hasAbility(boss.abilities, 'regen') || from == null) {
    return { state, healed: 0 };
  }

  const ticks = Math.floor((now - from) / SET_BREAK_MS);
  if (ticks <= 0) return { state, healed: 0 };

  // Ceiling taken from the encounter, not from fight state: a stale `enemyMaxHp` (a dev-panel
  // jump, a save written by an older build) would otherwise clamp a healthy boss *down*, and
  // "healing" that removes HP is never right. The Math.max is the belt to that braces.
  const max = Math.max(encounterAt(boss, state.stageStep).hp, state.fight.enemyMaxHp);
  const perTick = Math.max(1, Math.round(max * abilityValue(boss.abilities, 'regen')));
  const hp = Math.max(state.enemyHp, Math.min(max, state.enemyHp + ticks * perTick));

  return {
    state: { ...state, enemyHp: hp, fight: { ...state.fight, regenAt: from + ticks * SET_BREAK_MS } },
    healed: hp - state.enemyHp,
  };
}

/** Moves to a new enemy, folding in any HP inherited from a minion that survived too long. */
function startEncounter(state: ArenaState, bossIndex: number, step: number, carried: number): ArenaState {
  const hp = encounterAt(BOSSES[bossIndex], step).hp + carried;
  return {
    ...state,
    bossIndex,
    stageStep: step,
    enemyHp: hp,
    fight: {
      ...state.fight,
      hpAtSetStart: hp,
      damageThisSet: 0,
      repsOnEnemy: 0,
      enemyMaxHp: hp,
      carriedHp: 0,
      lastStandReps: 0,
    },
  };
}

/**
 * Resolves one rep.
 *
 * @param now  Milliseconds; only differences matter.
 * @param roll Crit roll in [0, 1) — injected rather than drawn inside so tests are deterministic.
 */
export function resolveArenaRep(state: ArenaState, now: number, roll: number): RepOutcome {
  const bossIndex = Math.min(state.bossIndex, BOSSES.length - 1);
  const boss = BOSSES[bossIndex];
  const step = state.stageStep;
  const enemy = encounterAt(boss, step);
  // Minion-facing abilities still belong to the stage's boss, so they're read from the boss.
  const abilities = enemy.isBoss ? boss.abilities : [];
  const stageAbilities = boss.abilities;

  // Regeneration is settled first and by the clock, so the reps that follow hit the HP the boss
  // actually has after your rest — not the HP you left him on.
  const regen = applyIdleRegen(state, now);
  let fight = { ...regen.state.fight };
  let enemyHp = regen.state.enemyHp;
  let healed = regen.healed;

  // --- settle the pause that just ended -------------------------------------------------
  const gap = fight.lastRepAt == null ? 0 : now - fight.lastRepAt;
  const setEnded = fight.lastRepAt == null || gap >= SET_BREAK_MS;

  if (setEnded && fight.lastRepAt != null) {
    if (enemy.isBoss && hasAbility(abilities, 'bloodDebt')) {
      const refund = Math.round(fight.damageThisSet * abilityValue(abilities, 'bloodDebt'));
      const after = Math.min(fight.enemyMaxHp, enemyHp + refund);
      healed += after - enemyHp;
      enemyHp = after;
    }
    if (enemy.isBoss && hasAbility(abilities, 'noStop') && gap >= NO_STOP_MS) {
      // Everything landed since the set began is undone, not merely reduced.
      const after = Math.min(fight.enemyMaxHp, Math.max(enemyHp, fight.hpAtSetStart));
      healed += after - enemyHp;
      enemyHp = after;
    }
    fight.lastStandReps = 0;
  }

  if (setEnded) {
    fight.setReps = 0;
    fight.damageThisSet = 0;
    fight.hpAtSetStart = enemyHp;
  }

  fight.lastRepAt = now;
  fight.regenAt = now;
  fight.setReps += 1;
  fight.repsOnEnemy += 1;

  // --- does this rep land at all? --------------------------------------------------------
  let blocked: BlockedReason = null;
  if (
    enemy.isBoss &&
    hasAbility(abilities, 'skipEvery') &&
    fight.repsOnEnemy % abilityValue(abilities, 'skipEvery') === 0
  ) {
    blocked = 'blind-spot';
  } else if (enemy.isBoss && hasAbility(abilities, 'evenOnly') && fight.repsOnEnemy % 2 !== 0) {
    blocked = 'odd-rep';
  }

  let isCrit = false;
  let damage = 0;
  if (!blocked) {
    isCrit = critLands(abilities, roll < boss.critChance);
    damage = damageDealt(
      boss.baseDamage,
      boss.critMultiplier,
      isCrit,
      abilities,
      fight.enemyMaxHp > 0 ? enemyHp / fight.enemyMaxHp : 1,
    );
    enemyHp -= damage;
    fight.damageThisSet += damage;
  }

  // --- "Заражение": a minion that outlives its welcome leaks HP into the next one ---------
  if (
    !enemy.isBoss &&
    hasAbility(stageAbilities, 'infection') &&
    enemyHp > 0 &&
    fight.repsOnEnemy === abilityValue(stageAbilities, 'infection')
  ) {
    fight.carriedHp = enemyHp;
  }

  // --- death, or the refusal to die ------------------------------------------------------
  let bossDefeated = false;
  let minionDefeated = false;
  let revived = false;
  let bossReached = false;
  let next: ArenaState = { ...state, bossIndex, enemyHp, fight };

  if (enemyHp <= 0) {
    if (enemy.isBoss && hasAbility(abilities, 'falseDeath')) {
      const needed = abilityValue(abilities, 'falseDeath');
      if (fight.lastStandReps < needed) {
        // Held at 1 HP; only an unbroken run of reps finishes the job.
        fight.lastStandReps += 1;
        enemyHp = 1;
        blocked = blocked ?? 'last-stand';
        return {
          next: { ...next, enemyHp, fight },
          damage,
          isCrit,
          bossDefeated: false,
          minionDefeated: false,
          revived: false,
          bossReached: false,
          enemyName: enemy.name,
          blocked,
          healed,
          xpFactor: xpMultiplier(abilities),
        };
      }
    }

    if (!enemy.isBoss) {
      const minion = boss.minions[step];
      const mirrors =
        hasAbility(stageAbilities, 'mirror') &&
        // "1 из 3" is pinned to the middle minion so the fight stays predictable.
        step === 1 &&
        !fight.revivedIds.includes(minion.id);
      if (mirrors) {
        revived = true;
        enemyHp = Math.max(1, Math.ceil(fight.enemyMaxHp / 2));
        fight.revivedIds = [...fight.revivedIds, minion.id];
        fight.hpAtSetStart = enemyHp;
        fight.damageThisSet = 0;
        next = { ...next, enemyHp, fight };
      } else {
        minionDefeated = true;
        bossReached = step + 1 >= BOSS_STEP;
        next = startEncounter({ ...next, fight }, bossIndex, step + 1, fight.carriedHp);
      }
    } else if (!state.bossesDefeated.includes(boss.id)) {
      bossDefeated = true;
      const isLast = bossIndex >= BOSSES.length - 1;
      const defeated = [...state.bossesDefeated, boss.id];
      next = isLast
        ? { ...next, enemyHp: 0, stageStep: BOSS_STEP, bossesDefeated: defeated, fight }
        : {
            ...startEncounter({ ...next, fight }, bossIndex + 1, 0, 0),
            bossesDefeated: defeated,
            fight: { ...freshFight(0), lastRepAt: now, revivedIds: [] },
          };
      if (!isLast) {
        // startEncounter set the HP; freshFight above wiped it, so re-derive both together.
        const hp = encounterAt(BOSSES[bossIndex + 1], 0).hp;
        next = {
          ...next,
          bossIndex: bossIndex + 1,
          stageStep: 0,
          enemyHp: hp,
          fight: { ...freshFight(hp), lastRepAt: now },
        };
      }
    } else {
      next = { ...next, enemyHp: 0, fight };
    }
  }

  return {
    next,
    damage,
    isCrit,
    bossDefeated,
    minionDefeated,
    revived,
    bossReached,
    enemyName: enemy.name,
    blocked,
    healed,
    xpFactor: xpMultiplier(abilities),
  };
}
