import {
  CRYSTAL_REPS,
  CRYSTAL_SHIELD,
  END_CRYSTALS,
  FREEZE_PAUSE_MS,
  HALF_HP,
  NO_STOP_MS,
  PIGGY_EVERY,
  SET_BREAK_MS,
  abilityValue,
  critLands,
  damageDealt,
  hasAbility,
  xpMultiplier,
} from './abilities.ts';
import { BOSSES, BOSS_STEP, encounterAt } from './bosses.ts';
import { NO_PERKS, type PlayerPerks } from './shop.ts';

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
  // The bosses' own abilities. Optional: saves written before them have none of these, and a
  // missing field reads as "nothing happened yet".
  /** Reps still frozen by "Замораживающий луч". */
  frozenLeft?: number;
  /** "Тактическое отступление" is spent. */
  retreatUsed?: boolean;
  /** "Скример" is spent. */
  screamUsed?: boolean;
  /** A scream in progress: HP when it went off, and reps done since without a pause. */
  scream?: { hp: number; reps: number } | null;
  /** "Кристаллы Края" broken so far. */
  crystalsBroken?: number;
}

export interface ArenaState {
  bossIndex: number;
  stageStep: number;
  enemyHp: number;
  bossesDefeated: string[];
  fight: FightState;
}

/** Why a rep did no damage, so the UI can say so instead of looking broken. */
export type BlockedReason =
  | 'blind-spot'
  | 'odd-rep'
  | 'last-stand'
  | 'fee'
  | 'piggy'
  | 'frozen'
  | 'slacking'
  | 'joke'
  | null;

/**
 * One-off moments a boss ability makes, for the fight screen to play out. A rep can carry more
 * than one: the pause that ended a short set under "Командная работа" can also be the one that
 * fires "Замораживающий луч".
 */
export type AbilityEvent =
  | 'frozen' // Gru's ray just hit: the next reps are frozen.
  | 'retreat' // Skipper fell back and patched himself up.
  | 'scream' // Freddy jumped out.
  | 'scream-burned' // A pause during the scream burned the damage done since.
  | 'scream-survived' // Enough reps without a pause: the scream is over.
  | 'crystal' // An End crystal broke.
  | 'covered'; // A short set: the Titans covered Robin, damage undone.

export interface RepOutcome {
  next: ArenaState;
  damage: number;
  isCrit: boolean;
  bossDefeated: boolean;
  /** A boss already beaten went down again (a replay); the run moves on, nothing new is won. */
  bossRebeaten: boolean;
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
  /** Ability moments this rep set off, in the order they happened. */
  events: AbilityEvent[];
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
    frozenLeft: 0,
    retreatUsed: false,
    screamUsed: false,
    scream: null,
    crystalsBroken: 0,
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
export function applyIdleRegen(
  state: ArenaState,
  now: number,
  perks: PlayerPerks = NO_PERKS,
): { state: ArenaState; healed: number } {
  const boss = BOSSES[Math.min(state.bossIndex, BOSSES.length - 1)];
  const enemy = encounterAt(boss, state.stageStep);
  const from = state.fight.regenAt;
  if (!enemy.isBoss || !hasAbility(boss.abilities, 'regen') || from == null) {
    return { state, healed: 0 };
  }

  // "Второе дыхание" stretches the tick: the boss waits longer before he starts to heal.
  const interval = SET_BREAK_MS + perks.breathMs;
  const ticks = Math.floor((now - from) / interval);
  if (ticks <= 0) return { state, healed: 0 };

  // Ceiling taken from the encounter, not from fight state: a stale `enemyMaxHp` (a dev-panel
  // jump, a save written by an older build) would otherwise clamp a healthy boss *down*, and
  // "healing" that removes HP is never right. The Math.max is the belt to that braces.
  const max = Math.max(encounterAt(boss, state.stageStep).hp, state.fight.enemyMaxHp);
  const perTick = Math.max(1, Math.round(max * abilityValue(boss.abilities, 'regen')));
  const hp = Math.max(state.enemyHp, Math.min(max, state.enemyHp + ticks * perTick));

  return {
    state: { ...state, enemyHp: hp, fight: { ...state.fight, regenAt: from + ticks * interval } },
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
      frozenLeft: 0,
      retreatUsed: false,
      screamUsed: false,
      scream: null,
      crystalsBroken: 0,
    },
  };
}

/**
 * Resolves one rep.
 *
 * @param now  Milliseconds; only differences matter.
 * @param roll Crit roll in [0, 1) — injected rather than drawn inside so tests are deterministic.
 * @param perks What the player has bought in the shop; none by default.
 */
export function resolveArenaRep(
  state: ArenaState,
  now: number,
  roll: number,
  perks: PlayerPerks = NO_PERKS,
): RepOutcome {
  const bossIndex = Math.min(state.bossIndex, BOSSES.length - 1);
  const boss = BOSSES[bossIndex];
  const step = state.stageStep;
  const enemy = encounterAt(boss, step);
  // Minion-facing abilities still belong to the stage's boss, so they're read from the boss.
  const abilities = enemy.isBoss ? boss.abilities : [];
  const stageAbilities = boss.abilities;

  // Regeneration is settled first and by the clock, so the reps that follow hit the HP the boss
  // actually has after your rest — not the HP you left him on.
  const regen = applyIdleRegen(state, now, perks);
  let fight = { ...regen.state.fight };
  let enemyHp = regen.state.enemyHp;
  let healed = regen.healed;

  const events: AbilityEvent[] = [];

  // --- settle the pause that just ended -------------------------------------------------
  const gap = fight.lastRepAt == null ? 0 : now - fight.lastRepAt;
  const setEnded = fight.lastRepAt == null || gap >= SET_BREAK_MS + perks.breathMs;

  if (setEnded && fight.lastRepAt != null) {
    if (enemy.isBoss && hasAbility(abilities, 'bloodDebt')) {
      const refund = Math.round(fight.damageThisSet * abilityValue(abilities, 'bloodDebt'));
      const after = Math.min(fight.enemyMaxHp, enemyHp + refund);
      healed += after - enemyHp;
      enemyHp = after;
    }
    if (enemy.isBoss && hasAbility(abilities, 'noStop') && gap >= NO_STOP_MS + perks.breathMs) {
      // Everything landed since the set began is undone, not merely reduced.
      const after = Math.min(fight.enemyMaxHp, Math.max(enemyHp, fight.hpAtSetStart));
      healed += after - enemyHp;
      enemyHp = after;
    }
    // "Командная работа": a set that ended too short is covered by the Titans — undone.
    if (
      enemy.isBoss &&
      hasAbility(abilities, 'teamwork') &&
      fight.setReps < abilityValue(abilities, 'teamwork') &&
      fight.damageThisSet > 0
    ) {
      const after = Math.min(fight.enemyMaxHp, Math.max(enemyHp, fight.hpAtSetStart));
      if (after > enemyHp) {
        healed += after - enemyHp;
        enemyHp = after;
        events.push('covered');
      }
    }
    // "Скример": a pause before enough reps burns what was done since he jumped out, and the
    // count starts again — he doesn't go away until you've done it.
    if (fight.scream && fight.scream.reps < abilityValue(abilities, 'scream')) {
      const after = Math.min(fight.enemyMaxHp, Math.max(enemyHp, fight.scream.hp));
      if (after > enemyHp) {
        healed += after - enemyHp;
        enemyHp = after;
        events.push('scream-burned');
      }
      fight.scream = { hp: enemyHp, reps: 0 };
    }
    fight.lastStandReps = 0;
  }

  // "Замораживающий луч": a long enough pause and the reps after it are frozen.
  if (
    enemy.isBoss &&
    hasAbility(abilities, 'freezeRay') &&
    fight.lastRepAt != null &&
    gap >= FREEZE_PAUSE_MS + perks.breathMs
  ) {
    fight.frozenLeft = abilityValue(abilities, 'freezeRay');
    events.push('frozen');
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
  } else if (enemy.isBoss && (fight.frozenLeft ?? 0) > 0) {
    fight.frozenLeft = (fight.frozenLeft ?? 0) - 1;
    blocked = 'frozen';
  } else if (enemy.isBoss && hasAbility(abilities, 'entryFee') && fight.setReps <= abilityValue(abilities, 'entryFee')) {
    blocked = 'fee';
  } else if (
    enemy.isBoss &&
    hasAbility(abilities, 'strictMom') &&
    fight.lastRepAt != null &&
    gap >= abilityValue(abilities, 'strictMom')
  ) {
    // Any pause that long, rest or not — she doesn't do breaks. Only the first fight rep is
    // exempt, since there's nothing before it to have paused after.
    blocked = 'slacking';
  } else if (enemy.isBoss && hasAbility(abilities, 'piggyBank') && fight.repsOnEnemy % PIGGY_EVERY === 0) {
    const max = fight.enemyMaxHp;
    const after = Math.min(max, enemyHp + Math.max(1, Math.round(max * abilityValue(abilities, 'piggyBank'))));
    healed += after - enemyHp;
    enemyHp = after;
    blocked = 'piggy';
  }

  let isCrit = false;
  let damage = 0;
  if (!blocked) {
    isCrit = critLands(abilities, roll < boss.critChance + perks.critBonus);
    const hit = damageDealt(
      boss.baseDamage * perks.damageMult,
      boss.critMultiplier + perks.critMultBonus,
      isCrit,
      abilities,
      fight.enemyMaxHp > 0 ? enemyHp / fight.enemyMaxHp : 1,
    );
    if (isCrit && enemy.isBoss && hasAbility(abilities, 'jokerCard')) {
      // "Карта-джокер": the crit is the joke — on you. It heals him instead.
      const after = Math.min(fight.enemyMaxHp, enemyHp + Math.max(1, Math.round(hit * abilityValue(abilities, 'jokerCard'))));
      healed += after - enemyHp;
      enemyHp = after;
      isCrit = false;
      blocked = 'joke';
    } else {
      damage = hit;
      // "Кристаллы Края": while any stands, the dragon takes half.
      if (enemy.isBoss && hasAbility(abilities, 'endCrystals') && (fight.crystalsBroken ?? 0) < END_CRYSTALS) {
        damage = Math.max(1, Math.round(damage * CRYSTAL_SHIELD));
      }
      enemyHp -= damage;
      fight.damageThisSet += damage;
    }
  }

  // --- reps without a pause: what crystals and the scream are counting -------------------
  if (
    enemy.isBoss &&
    hasAbility(abilities, 'endCrystals') &&
    (fight.crystalsBroken ?? 0) < END_CRYSTALS &&
    fight.setReps % CRYSTAL_REPS === 0
  ) {
    fight.crystalsBroken = (fight.crystalsBroken ?? 0) + 1;
    events.push('crystal');
  }
  if (fight.scream) {
    const reps = fight.scream.reps + 1;
    if (reps >= abilityValue(abilities, 'scream')) {
      fight.scream = null;
      events.push('scream-survived');
    } else fight.scream = { ...fight.scream, reps };
  }

  // --- below half: Skipper falls back, Freddy jumps out -----------------------------------
  const belowHalf = enemyHp > 0 && fight.enemyMaxHp > 0 && enemyHp < fight.enemyMaxHp * HALF_HP;
  if (belowHalf && enemy.isBoss && hasAbility(abilities, 'retreat') && !fight.retreatUsed) {
    const after = Math.min(fight.enemyMaxHp, enemyHp + Math.round(fight.enemyMaxHp * abilityValue(abilities, 'retreat')));
    healed += after - enemyHp;
    enemyHp = after;
    fight.retreatUsed = true;
    events.push('retreat');
  }
  if (belowHalf && enemy.isBoss && hasAbility(abilities, 'scream') && !fight.screamUsed) {
    fight.screamUsed = true;
    fight.scream = { hp: enemyHp, reps: 0 };
    events.push('scream');
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
  let bossRebeaten = false;
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
          bossRebeaten: false,
          minionDefeated: false,
          revived: false,
          bossReached: false,
          enemyName: enemy.name,
          blocked,
          healed,
          xpFactor: xpMultiplier(abilities),
          events,
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
    } else if (bossIndex < BOSSES.length - 1) {
      // Beaten before — a replay walking the stages again. He goes down, the list of victories
      // doesn't change, and the run carries on to the next stage's first minion.
      bossRebeaten = true;
      const hp = encounterAt(BOSSES[bossIndex + 1], 0).hp;
      next = { ...next, bossIndex: bossIndex + 1, stageStep: 0, enemyHp: hp, fight: { ...freshFight(hp), lastRepAt: now } };
    } else {
      // The last boss, beaten before: the arena has nowhere further to go.
      bossRebeaten = true;
      next = { ...next, enemyHp: 0, fight };
    }
  }

  return {
    next,
    damage,
    isCrit,
    bossDefeated,
    bossRebeaten,
    minionDefeated,
    revived,
    bossReached,
    enemyName: enemy.name,
    blocked,
    healed,
    xpFactor: xpMultiplier(abilities),
    events,
  };
}
