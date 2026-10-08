import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, BOSS_STEP, encounterAt } from './bosses.ts';
import { SET_BREAK_MS } from './abilities.ts';
import { applyIdleRegen, freshFight, resolveArenaRep, type ArenaState } from './combat.ts';
import { NO_PERKS, UPGRADES, nextCost, perksFrom } from './shop.ts';

function at(bossId: string, step: number): ArenaState {
  const bossIndex = BOSSES.findIndex((b) => b.id === bossId);
  const hp = encounterAt(BOSSES[bossIndex], step).hp;
  return {
    bossIndex,
    stageStep: step,
    enemyHp: hp,
    bossesDefeated: BOSSES.slice(0, bossIndex).map((b) => b.id),
    fight: freshFight(hp),
  };
}

test('perksFrom adds the levels up', () => {
  assert.deepEqual(perksFrom(undefined), NO_PERKS);
  const p = perksFrom({ power: 2, precision: 3, heavy: 1, breath: 2 });
  assert.ok(Math.abs(p.damageMult - 1.2) < 1e-9);
  assert.ok(Math.abs(p.critBonus - 0.06) < 1e-9);
  assert.equal(p.critMultBonus, 0.25);
  assert.equal(p.breathMs, 2000);
});

test('nextCost climbs and stops at the max level', () => {
  const power = UPGRADES.find((u) => u.id === 'power')!;
  assert.equal(nextCost({}, power), power.costs[0]);
  assert.equal(nextCost({ power: 1 }, power), power.costs[1]);
  assert.equal(nextCost({ power: power.costs.length }, power), null);
  for (const u of UPGRADES) {
    for (let i = 1; i < u.costs.length; i++) assert.ok(u.costs[i] > u.costs[i - 1], `${u.id} gets dearer`);
  }
});

test('Сила удара raises the damage of a plain hit', () => {
  const s = at('brawler', 0);
  const plain = resolveArenaRep(s, 1_000_000, 1).damage;
  const strong = resolveArenaRep(s, 1_000_000, 1, perksFrom({ power: 5 })).damage;
  assert.equal(strong, Math.round(plain * 1.5));
});

test('Меткость turns a near-miss roll into a crit', () => {
  const s = at('brawler', 0);
  const roll = BOSSES[s.bossIndex].critChance + 0.01;
  assert.equal(resolveArenaRep(s, 1_000_000, roll).isCrit, false);
  assert.equal(resolveArenaRep(s, 1_000_000, roll, perksFrom({ precision: 1 })).isCrit, true);
});

test('Тяжёлая рука makes crits hit harder', () => {
  const s = at('brawler', 0);
  const crit = resolveArenaRep(s, 1_000_000, 0).damage;
  const heavy = resolveArenaRep(s, 1_000_000, 0, perksFrom({ heavy: 4 })).damage;
  assert.ok(heavy > crit);
});

test('Второе дыхание delays regeneration', () => {
  const s = at('bloodking', BOSS_STEP);
  const hit = resolveArenaRep(s, 1_000_000, 1).next;
  const rest = 1_000_000 + SET_BREAK_MS + 500;
  assert.ok(applyIdleRegen(hit, rest).healed > 0, 'without the perk he heals');
  assert.equal(applyIdleRegen(hit, rest, perksFrom({ breath: 1 })).healed, 0, 'with it he waits');
});

test('Второе дыхание keeps a slow set going', () => {
  const s = at('brawler', 0);
  const first = resolveArenaRep(s, 1_000_000, 1).next;
  const gap = 1_000_000 + SET_BREAK_MS + 500;
  assert.equal(resolveArenaRep(first, gap, 1).next.fight.setReps, 1, 'pause ended the set');
  assert.equal(resolveArenaRep(first, gap, 1, perksFrom({ breath: 1 })).next.fight.setReps, 2, 'set continues');
});
