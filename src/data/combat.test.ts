import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, BOSS_STEP, encounterAt } from './bosses.ts';
import { CRYSTAL_REPS, END_CRYSTALS, FREEZE_PAUSE_MS, NO_STOP_MS, SET_BREAK_MS } from './abilities.ts';
import { applyIdleRegen, freshFight, resolveArenaRep, type ArenaState } from './combat.ts';

const indexOf = (id: string) => BOSSES.findIndex((b) => b.id === id);

/** A state parked on a given stage, either on a minion (step 0..2) or on the boss (step 3). */
function at(bossId: string, step: number): ArenaState {
  const bossIndex = indexOf(bossId);
  const hp = encounterAt(BOSSES[bossIndex], step).hp;
  return {
    bossIndex,
    stageStep: step,
    enemyHp: hp,
    bossesDefeated: BOSSES.slice(0, bossIndex).map((b) => b.id),
    fight: freshFight(hp),
  };
}

/** Reps `count` times with `gapMs` between them. `roll: 1` never crits, keeping numbers exact. */
function reps(state: ArenaState, count: number, gapMs = 1000, startAt = 1_000_000, roll = 1) {
  let s = state;
  let t = startAt;
  const outcomes = [];
  for (let i = 0; i < count; i += 1) {
    const o = resolveArenaRep(s, t, roll);
    outcomes.push(o);
    s = o.next;
    t += gapMs;
  }
  return { state: s, outcomes, endedAt: t };
}

test('Слепая зона: каждый пятый повтор проходит мимо', () => {
  const { outcomes } = reps(at('stormborn', BOSS_STEP), 10);
  assert.deepEqual(
    outcomes.map((o) => o.blocked),
    [null, null, null, null, 'blind-spot', null, null, null, null, 'blind-spot'],
  );
});

test('Слепая зона считает повторы по противнику, а не по подходу', () => {
  // Пауза посреди боя не должна сбрасывать счёт до пятого.
  const first = reps(at('stormborn', BOSS_STEP), 3);
  const second = reps(first.state, 3, 1000, first.endedAt + SET_BREAK_MS);
  assert.deepEqual(second.outcomes.map((o) => o.blocked), [null, 'blind-spot', null]);
});

test('Регенерация идёт по часам, а не ждёт следующего повтора', () => {
  // Достаточно урона, чтобы трём тикам лечения было куда ложиться и они не упёрлись в потолок.
  const worked = reps(at('bloodking', BOSS_STEP), 60);

  // Отсчёт идёт от последнего повтора, а не от конца прогона — привязываемся к нему явно.
  const since = worked.state.fight.regenAt;
  assert.ok(since != null);

  // Ничего не делаем — только смотрим на часы.
  const idle1 = applyIdleRegen(worked.state, since + SET_BREAK_MS);
  const idle3 = applyIdleRegen(worked.state, since + 3 * SET_BREAK_MS);
  assert.ok(idle1.healed > 0, 'один интервал отдыха уже лечит');
  assert.equal(idle3.healed, idle1.healed * 3, 'три интервала лечат втрое');

  const tooSoon = applyIdleRegen(worked.state, since + SET_BREAK_MS - 1);
  assert.equal(tooSoon.healed, 0, 'до конца интервала лечения нет');
});

test('Регенерация не начисляется дважды за один и тот же интервал', () => {
  const worked = reps(at('bloodking', BOSS_STEP), 10);
  const first = applyIdleRegen(worked.state, worked.endedAt + 2 * SET_BREAK_MS);
  const again = applyIdleRegen(first.state, worked.endedAt + 2 * SET_BREAK_MS);
  assert.equal(again.healed, 0, 'повторный вызов в тот же момент ничего не добавляет');
});

test('Регенерация: короткий отдых боссу не помогает', () => {
  const worked = reps(at('bloodking', BOSS_STEP), 10);
  const quick = resolveArenaRep(worked.state, worked.endedAt + 500, 1);
  assert.equal(quick.healed, 0);
});

test('Регенерация не поднимает HP выше полного даже за сутки простоя', () => {
  const start = at('bloodking', BOSS_STEP);
  const one = resolveArenaRep(start, 1_000_000, 1);
  const after = applyIdleRegen(one.next, 1_000_000 + 24 * 60 * 60 * 1000);
  assert.equal(after.state.enemyHp, start.enemyHp);
});

test('Регенерация никогда не уменьшает HP, даже при испорченном состоянии боя', () => {
  // Ровно то, что оставляла дев-панель: HP от одного противника, максимум — от другого.
  const boss = at('bloodking', BOSS_STEP);
  const corrupted: ArenaState = {
    ...boss,
    fight: { ...boss.fight, enemyMaxHp: 7, regenAt: 1_000_000 },
  };
  const after = applyIdleRegen(corrupted, 1_000_000 + 5 * SET_BREAK_MS);
  assert.ok(
    after.state.enemyHp >= corrupted.enemyHp,
    `лечение обрушило HP: ${corrupted.enemyHp} → ${after.state.enemyHp}`,
  );
});

test('Без остановки: длинная пауза стирает весь урон подхода', () => {
  const start = at('worldbreaker', BOSS_STEP);
  const worked = reps(start, 12);
  assert.ok(worked.state.enemyHp < start.enemyHp, 'урон должен был пройти');

  const after = resolveArenaRep(worked.state, worked.endedAt + NO_STOP_MS, 1);
  // HP вернулось к началу подхода, минус только текущий повтор.
  assert.equal(after.next.enemyHp, start.enemyHp - after.damage);
});

test('Без остановки: пауза короче порога урон не стирает', () => {
  const worked = reps(at('worldbreaker', BOSS_STEP), 12);
  const hp = worked.state.enemyHp;
  // `endedAt` уже на секунду после последнего повтора; ещё секунда — пауза 2 с, короче порога.
  const after = resolveArenaRep(worked.state, worked.endedAt + 1000, 1);
  assert.ok(after.next.enemyHp < hp, 'HP не должно откатываться');
});

test('Чётный урон: половина повторов уходит впустую', () => {
  const { outcomes } = reps(at('apex', BOSS_STEP), 6);
  assert.deepEqual(
    outcomes.map((o) => o.blocked),
    ['odd-rep', null, 'odd-rep', null, 'odd-rep', null],
  );
});

test('Кровавый долг: не добил за подход — часть урона вернулась', () => {
  const worked = reps(at('threshold', BOSS_STEP), 20);
  const hp = worked.state.enemyHp;
  const after = resolveArenaRep(worked.state, worked.endedAt + SET_BREAK_MS, 1);
  assert.ok(after.healed > 0, 'за брошенный подход положен возврат');
  assert.ok(after.next.enemyHp > hp - after.damage, 'вернулось больше, чем снял новый повтор');
});

test('Ложная смерть: на 1 HP босс держится, пока не добьёшь без паузы', () => {
  let s = at('absolute', BOSS_STEP);
  // Опускаем почти до нуля, минуя долгий бой.
  s = { ...s, enemyHp: 1, fight: { ...s.fight, lastRepAt: 1_000_000 } };
  const run = reps(s, 12, 1000, 1_001_000);
  const held = run.outcomes.filter((o) => o.blocked === 'last-stand').length;
  assert.ok(held >= 10, `босс должен продержаться минимум 10 повторов, продержался ${held}`);
  assert.ok(
    run.outcomes.some((o) => o.bossDefeated),
    'после серии без пауз он всё-таки должен умереть',
  );
});

test('Ложная смерть: пауза обнуляет накопленные добивания', () => {
  let s = at('absolute', BOSS_STEP);
  s = { ...s, enemyHp: 1, fight: { ...s.fight, lastRepAt: 1_000_000 } };
  const partial = reps(s, 5, 1000, 1_001_000);
  assert.ok(!partial.outcomes.some((o) => o.bossDefeated));

  const afterPause = reps(partial.state, 5, 1000, partial.endedAt + SET_BREAK_MS);
  assert.ok(!afterPause.outcomes.some((o) => o.bossDefeated), 'счётчик должен был сброситься');
});

test('Зеркало: второй подчинённый один раз воскресает с половиной HP', () => {
  const stage = indexOf('absolute');
  const second = encounterAt(BOSSES[stage], 1);
  const run = reps(at('absolute', 1), 400);
  const revivals = run.outcomes.filter((o) => o.revived);
  assert.equal(revivals.length, 1, 'воскрешение ровно одно');
  const idx = run.outcomes.findIndex((o) => o.revived);
  assert.equal(run.outcomes[idx].next.enemyHp, Math.ceil(second.hp / 2));
});

test('Заражение: недобитый подчинённый утяжеляет следующего', () => {
  const stage = indexOf('nameless');
  const third = encounterAt(BOSSES[stage], 2);
  // Второй подчинённый большой — за 15 повторов его не убить, поэтому остаток перетечёт дальше.
  const run = reps(at('nameless', 1), 400);
  const killed = run.outcomes.find((o) => o.minionDefeated);
  assert.ok(killed, 'подчинённый должен погибнуть');
  assert.ok(
    killed.next.enemyHp > third.hp,
    `следующий должен получить добавку: ${killed.next.enemyHp} против базовых ${third.hp}`,
  );
});

test('Обычные удары без срабатываний способностей идут как раньше', () => {
  // Николь: «Стальная воля» и «Строгая мама» — при ровном темпе ни то ни другое не мешает.
  const start = at('wraith', BOSS_STEP);
  const { outcomes } = reps(start, 3);
  assert.deepEqual(outcomes.map((o) => o.blocked), [null, null, null]);
  assert.deepEqual(outcomes.map((o) => o.healed), [0, 0, 0]);
  assert.deepEqual(outcomes.map((o) => o.events), [[], [], []]);
  assert.equal(outcomes[0].damage, 10);
});

/** Reps until `pred` holds for an outcome; returns everything up to and including it. */
function repsUntil(state: ArenaState, pred: (o: ReturnType<typeof resolveArenaRep>) => boolean, gapMs = 1000) {
  let s = state;
  let t = 1_000_000;
  const outcomes = [];
  for (let i = 0; i < 2000; i += 1) {
    const o = resolveArenaRep(s, t, 1);
    outcomes.push(o);
    s = o.next;
    t += gapMs;
    if (pred(o)) return { state: s, outcomes, endedAt: t, hit: o };
  }
  throw new Error('условие так и не выполнилось');
}

test('Плата за вход: первые 3 повтора каждого подхода — в кассу', () => {
  const first = reps(at('grunt', BOSS_STEP), 5);
  assert.deepEqual(first.outcomes.map((o) => o.blocked), ['fee', 'fee', 'fee', null, null]);
  assert.equal(first.outcomes[3].damage, 9);
  // Новый подход после паузы — снова платишь.
  const second = reps(first.state, 2, 1000, first.endedAt + SET_BREAK_MS);
  assert.deepEqual(second.outcomes.map((o) => o.blocked), ['fee', 'fee']);
});

test('Копилка: каждый 3-й повтор лечит Свина вместо урона', () => {
  const max = encounterAt(BOSSES[indexOf('brawler')], BOSS_STEP).hp;
  const run = reps(at('brawler', BOSS_STEP), 6);
  assert.deepEqual(run.outcomes.map((o) => o.blocked), [null, null, 'piggy', null, null, 'piggy']);
  assert.equal(run.outcomes[2].damage, 0);
  assert.equal(run.outcomes[2].healed, Math.round(max * 0.04));
});

test('Замораживающий луч: после долгой паузы 3 повтора не бьют', () => {
  const warm = reps(at('berserker', BOSS_STEP), 2);
  const after = reps(warm.state, 4, 1000, warm.endedAt + FREEZE_PAUSE_MS);
  assert.deepEqual(after.outcomes.map((o) => o.blocked), ['frozen', 'frozen', 'frozen', null]);
  assert.deepEqual(after.outcomes[0].events, ['frozen']);
  // Пауза короче порога (2 с) — не замораживает.
  const short = reps(warm.state, 1, 1000, warm.endedAt + 1000);
  assert.equal(short.outcomes[0].blocked, null);
});

test('Тактическое отступление: на половине HP Шкипер один раз лечится', () => {
  const max = encounterAt(BOSSES[indexOf('steelguard')], BOSS_STEP).hp;
  const run = repsUntil(at('steelguard', BOSS_STEP), (o) => o.events.includes('retreat'));
  assert.equal(run.hit.healed, Math.round(max * 0.15));
  assert.equal(run.state.fight.retreatUsed, true);
  // Второй раз — уже нет, даже снова ниже половины.
  const rest = repsUntil(run.state, (o) => o.bossDefeated);
  assert.ok(rest.outcomes.every((o) => !o.events.includes('retreat')));
});

test('Строгая мама: после паузы от 3 секунд повтор не бьёт — даже после отдыха', () => {
  const quick = reps(at('wraith', BOSS_STEP), 3, 2900);
  assert.deepEqual(quick.outcomes.map((o) => o.blocked), [null, null, null]);
  const slow = reps(at('wraith', BOSS_STEP), 3, 3000);
  assert.deepEqual(slow.outcomes.map((o) => o.blocked), [null, 'slacking', 'slacking']);
  // Долгий отдых не спасает: первый повтор после него пропадает, дальше в темпе — бьёт.
  const warm = reps(at('wraith', BOSS_STEP), 2);
  const back = reps(warm.state, 3, 1000, warm.endedAt + 60_000);
  assert.deepEqual(back.outcomes.map((o) => o.blocked), ['slacking', null, null]);
});

test('Скример: на половине HP пугает, пауза сжигает урон, 10 подряд — выдержал', () => {
  const scared = repsUntil(at('titanprime', BOSS_STEP), (o) => o.events.includes('scream'));
  const hpAtScream = scared.state.enemyHp;
  // Пять ударов, потом пауза — урон за них сгорает.
  const part = reps(scared.state, 5, 1000, scared.endedAt);
  assert.ok(part.state.enemyHp < hpAtScream);
  const burned = reps(part.state, 1, 1000, part.endedAt + SET_BREAK_MS);
  assert.ok(burned.outcomes[0].events.includes('scream-burned'));
  assert.ok(burned.outcomes[0].healed > 0);
  // Повтор после паузы — уже первый из новых десяти; ещё девять без паузы — и он отстаёт.
  const held = reps(burned.state, 9, 1000, burned.endedAt);
  assert.ok(held.outcomes[8].events.includes('scream-survived'));
  assert.ok(held.outcomes.slice(0, 8).every((o) => !o.events.includes('scream-survived')));
  assert.equal(held.state.fight.scream, null);
});

test('Карта-джокер: крит по Джокеру лечит его', () => {
  const hurt = reps(at('voidhammer', BOSS_STEP), 5);
  const joke = resolveArenaRep(hurt.state, hurt.endedAt, 0);
  assert.equal(joke.blocked, 'joke');
  assert.equal(joke.isCrit, false);
  assert.equal(joke.damage, 0);
  assert.ok(joke.healed > 0);
  assert.equal(joke.next.enemyHp, hurt.state.enemyHp + joke.healed);
});

test('Командная работа: короткий подход Робину не засчитывается', () => {
  const start = at('ironmaw', BOSS_STEP);
  const short = reps(start, 3);
  const next = reps(short.state, 1, 1000, short.endedAt + SET_BREAK_MS);
  assert.ok(next.outcomes[0].events.includes('covered'));
  assert.equal(next.outcomes[0].healed, start.enemyHp - short.state.enemyHp);
  // Подход из пяти — честный.
  const full = reps(start, 5);
  const after = reps(full.state, 1, 1000, full.endedAt + SET_BREAK_MS);
  assert.ok(!after.outcomes[0].events.includes('covered'));
});

test('Кристаллы Края: урон вдвое меньше, 15 подряд разбивают кристалл', () => {
  const run = reps(at('nameless', BOSS_STEP), CRYSTAL_REPS * END_CRYSTALS + 1);
  assert.equal(run.outcomes[0].damage, 5);
  const breaks = run.outcomes.map((o, i) => (o.events.includes('crystal') ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(breaks, [15, 30, 45]);
  assert.equal(run.state.fight.crystalsBroken, END_CRYSTALS);
  // Все разбиты — полный урон.
  assert.equal(run.outcomes.at(-1)?.damage, 10);
  // Пауза сбрасывает счёт до следующего кристалла.
  const a = reps(at('nameless', BOSS_STEP), 10);
  const b = reps(a.state, 10, 1000, a.endedAt + SET_BREAK_MS);
  assert.ok(b.outcomes.every((o) => !o.events.includes('crystal')));
});

test('Старое сохранение без новых полей боя не ломается', () => {
  const s = at('titanprime', BOSS_STEP);
  const legacy = { ...s, fight: { ...s.fight } } as ArenaState;
  for (const k of ['frozenLeft', 'retreatUsed', 'screamUsed', 'scream', 'crystalsBroken'] as const) delete legacy.fight[k];
  const o = resolveArenaRep(legacy, 1_000_000, 1);
  assert.equal(o.damage, 10);
});

test('Каждого из боссов можно победить ровным темпом', () => {
  for (const boss of BOSSES) {
    const run = repsUntil(at(boss.id, BOSS_STEP), (o) => o.bossDefeated, 1000);
    assert.ok(run.outcomes.length < 2000, boss.name);
  }
});

test('Победа над последним подчинённым помечается выходом на босса', () => {
  const run = reps(at('grunt', 2), 200);
  const cleared = run.outcomes.find((o) => o.minionDefeated);
  assert.ok(cleared);
  assert.equal(cleared.bossReached, true);
  assert.equal(cleared.next.stageStep, BOSS_STEP);

  // А смерть первого подчинённого — нет, впереди ещё двое.
  const early = reps(at('grunt', 0), 200).outcomes.find((o) => o.minionDefeated);
  assert.equal(early?.bossReached, false);
});

test('Смерть босса переносит на первого подчинённого следующего этапа с чистым боем', () => {
  const run = reps(at('grunt', BOSS_STEP), 20);
  const win = run.outcomes.find((o) => o.bossDefeated);
  assert.ok(win);
  assert.equal(win.next.bossIndex, indexOf('grunt') + 1);
  assert.equal(win.next.stageStep, 0);
  assert.equal(win.next.enemyHp, encounterAt(BOSSES[indexOf('grunt') + 1], 0).hp);
  assert.equal(win.next.fight.setReps, 0);
  assert.equal(win.next.fight.damageThisSet, 0);
});

test('Повторная победа над боссом ведёт на следующий этап и ничего не добавляет в победы', () => {
  // Крабс уже побеждён, мы снова на нём — так бывает только при перепрохождении.
  const start = { ...at('grunt', BOSS_STEP), bossesDefeated: ['grunt', 'brawler'] };
  const run = repsUntil(start, (o) => o.bossRebeaten || o.bossDefeated);
  assert.equal(run.hit.bossRebeaten, true);
  assert.equal(run.hit.bossDefeated, false);
  assert.equal(run.hit.next.bossIndex, indexOf('grunt') + 1);
  assert.equal(run.hit.next.stageStep, 0);
  assert.equal(run.hit.next.enemyHp, encounterAt(BOSSES[indexOf('grunt') + 1], 0).hp);
  assert.deepEqual(run.hit.next.bossesDefeated, ['grunt', 'brawler']);
});
