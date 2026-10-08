import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_HEARTS,
  MINION_HEARTS,
  PHRASE_BEATS,
  PLAIN,
  VISIBLE_CYCLES,
  beatPath,
  beatPeriod,
  beatRate,
  beatTrace,
  heartKeyframes,
  heartsLeft,
  phrase,
  phraseWidth,
  pulseColor,
  ringKeyframes,
  sampleTrack,
} from './vitals.ts';

/**
 * The heart thresholds are a stated rule rather than a taste call — three above two thirds,
 * two above one third, one while anything is left — so the boundaries where rounding decides
 * the answer are pinned here.
 */

test('full health shows every heart', () => {
  assert.equal(heartsLeft(100), 3);
});

test('three hearts hold down to two thirds', () => {
  assert.equal(heartsLeft(67), 3);
  assert.equal(heartsLeft(66.7), 3);
});

test('the third heart goes just below two thirds', () => {
  assert.equal(heartsLeft(66), 2);
  assert.equal(heartsLeft(50), 2);
  assert.equal(heartsLeft(34), 2);
});

test('the second goes just below one third', () => {
  assert.equal(heartsLeft(33), 1);
  assert.equal(heartsLeft(10), 1);
});

test('a sliver of health still keeps one heart', () => {
  // The last heart must not go out before he does, or the screen announces a death that
  // hasn't happened.
  assert.equal(heartsLeft(0.4), 1);
  assert.equal(heartsLeft(1), 1);
});

test('nothing left, nothing lit', () => {
  assert.equal(heartsLeft(0), 0);
  assert.equal(heartsLeft(-5), 0);
});

test('never more than three, whatever the arithmetic says', () => {
  assert.equal(heartsLeft(140), 3);
});

test('a minion keeps his one heart for the whole fight', () => {
  // The single heart is not a health read — it only says he is still standing, so it must
  // not flicker out part way through the way a third of three would.
  for (const pct of [100, 67, 50, 33, 10, 1, 0.2]) {
    assert.equal(heartsLeft(pct, MINION_HEARTS), 1, `погасло на ${pct}%`);
  }
  assert.equal(heartsLeft(0, MINION_HEARTS), 0);
});

test('the boss count is the default', () => {
  assert.equal(heartsLeft(50), heartsLeft(50, BOSS_HEARTS));
});

test('the pulse runs green, then amber, then red', () => {
  // Зелёный → жёлтый → красный. A traffic light only works if the boundaries are where the
  // player already expects them, so they are the hearts' own thirds — the line changes colour
  // on the beat a heart goes out, not somewhere near it.
  const green = pulseColor(100);
  const amber = pulseColor(50);
  const red = pulseColor(10);
  assert.equal(new Set([green, amber, red]).size, 3, 'два состояния окрашены одинаково');

  assert.equal(pulseColor(67), green);
  assert.equal(pulseColor(66.7), green);
  assert.equal(pulseColor(66), amber, 'жёлтый обязан начинаться там же, где гаснет третье сердце');
  assert.equal(pulseColor(34), amber);
  assert.equal(pulseColor(33), red, 'красный — там же, где гаснет второе');
  assert.equal(pulseColor(0.4), red);
});

test('a stopped heart is not red, it is grey', () => {
  // Red is "about to die". Dead is a different statement and must not look like the loudest
  // version of the previous one.
  assert.notEqual(pulseColor(0), pulseColor(10));
});

test('the pulse quickens as health falls', () => {
  const rested = beatPeriod(1);
  const dying = beatPeriod(0);
  assert.ok(dying < rested, 'a cornered enemy must beat faster than a fresh one');
  assert.ok(beatPeriod(0.5) < rested && beatPeriod(0.5) > dying);
});

test('the period stays sane outside 0..1', () => {
  assert.equal(beatPeriod(4), beatPeriod(1));
  assert.equal(beatPeriod(-4), beatPeriod(0));
});

test('the rested and the dying are plainly different speeds', () => {
  // The whole point of the pulse is that it reports health. When both ends sat near each
  // other it read as one fixed speed, and the gauge said nothing.
  assert.ok(beatRate(1) >= 45 && beatRate(1) <= 75, `в покое ${beatRate(1)} уд/мин — не спокойно`);
  assert.ok(
    beatRate(0) >= beatRate(1) * 2.5,
    `разгон всего в ${(beatRate(0) / beatRate(1)).toFixed(1)} раза — на глаз это одна скорость`,
  );
  // Density on screen comes from how many beats the window holds, not from the tempo —
  // otherwise a calm heart is one lonely spike crossing an empty field again.
  assert.ok(VISIBLE_CYCLES >= 3);
});

test('every bit of damage makes the heart faster', () => {
  let prev = beatRate(1);
  for (let h = 0.95; h >= -0.001; h -= 0.05) {
    const rate = beatRate(h);
    assert.ok(rate > prev, `на ${Math.round(h * 100)}% здоровья пульс не вырос: ${rate}`);
    prev = rate;
  }
});

test('the rate climbs harder the closer he is to death', () => {
  // Not a straight line: the first hits barely move it, the last ones send it racing.
  const early = beatRate(0.5) - beatRate(1);
  const late = beatRate(0) - beatRate(0.5);
  assert.ok(late > early * 1.3, `разгон почти равномерный: ${early} против ${late}`);
});

test('the period is just the rate turned into seconds', () => {
  assert.equal(beatPeriod(0.3), 60 / beatRate(0.3));
  assert.ok(beatPeriod(0) < beatPeriod(1));
});

/** Every y coordinate in a path, minus sign included — the peak can go above the baseline. */
function ys(path: string): number[] {
  return [...path.matchAll(/[MLQ][\s\d.-]+/g)]
    .flatMap((m) => m[0].slice(1).trim().split(/\s+/).map(Number))
    .filter((_, i) => i % 2 === 1);
}

/** Height of the R spike, which is what "more active" actually means on screen. */
const spike = (path: string) => 20 - Math.min(...ys(path));

/** The same rounding the paths are written with. */
const n = (v: number) => Math.round(v * 100) / 100;

/** The reference beat at a given strain — no wander, so the strain is the only variable. */
const plain = (strain: number) => beatPath(PLAIN, strain);

test('the trace grows more agitated as strain rises', () => {
  assert.ok(spike(plain(1)) > spike(plain(0.5)));
  assert.ok(spike(plain(0.5)) > spike(plain(0)));
});

test('a calm heart has no stumbling extra beat, a failing one does', () => {
  // The extra beat is the visible sign of a rhythm coming apart, and it lives at x=82. Tested
  // by its presence rather than by path length: the string grows and shrinks with the number
  // of digits in unrelated coordinates, which made an earlier version of this test lie.
  const hasExtra = (path: string) => path.includes('L82 20');
  assert.equal(hasExtra(plain(0.2)), false);
  assert.equal(hasExtra(plain(0.5)), false, 'ровно на половине ещё спокоен');
  assert.equal(hasExtra(plain(0.51)), true);
  assert.equal(hasExtra(plain(0.9)), true);
});

test('every cycle starts and ends on the baseline so they tile seamlessly', () => {
  // Including the odd-shaped ones: a beat that ended anywhere else would put a step in the
  // line at its own joint, not just at the loop point.
  for (const strain of [0, 0.4, 0.75, 1]) {
    for (const beat of [PLAIN, ...phrase(strain)]) {
      const path = beatPath({ ...beat, at: 0 }, strain);
      const end = n(100 * beat.scale);
      assert.ok(path.startsWith('M0 20'), `начало не на линии при ${strain}`);
      assert.ok(path.endsWith(`L${end} 20`), `конец не на линии при ${strain}: ...${path.slice(-14)}`);
    }
  }
});

test('the trace never leaves the box it is drawn in', () => {
  // A spike taller than the viewBox is silently clipped, so the line would stop growing
  // exactly where it is meant to look worst. This caught precisely that. Whole phrases are
  // checked, not just the reference beat: the tall ones are built by piling a beat's own
  // height on top of the strain, and that product is what overflows.
  for (const strain of [0, 0.3, 0.6, 0.85, 1]) {
    const all = ys(beatTrace(strain).d);
    assert.ok(Math.min(...all) >= 1, `пик вылез за верх при ${strain}: ${Math.min(...all)}`);
    assert.ok(Math.max(...all) <= 39, `провал вылез за низ при ${strain}: ${Math.max(...all)}`);
  }
});

test('a dying heart throws the line at both edges of the box', () => {
  // Красный пульс должен быть агрессивным. The box was barely half used before, which at this
  // strip height came out as a few pixels of twitch however tall the numbers looked.
  const spread = (strain: number) => {
    const all = ys(beatTrace(strain).d);
    return [Math.min(...all), Math.max(...all)] as const;
  };
  // 0.66 is where the line turns red, so that is where it has to already look violent.
  const [redTop, redFloor] = spread(0.66);
  assert.ok(redTop <= 8, `красный пик не достаёт до верха: ${redTop}`);
  assert.ok(redFloor >= 31, `красный провал не достаёт до низа: ${redFloor}`);
  const [top, floor] = spread(1);
  assert.ok(top <= 4, `предсмертный пик не достаёт до верха: ${top}`);
  assert.ok(floor >= 35, `предсмертный провал не достаёт до низа: ${floor}`);
});

test('a healthy heart keeps to the middle of it', () => {
  // The other half of the same rule: if calm filled the box too, the box would say nothing.
  const all = ys(beatTrace(0).d);
  assert.ok(Math.min(...all) >= 11, `спокойный пик слишком высокий: ${Math.min(...all)}`);
  assert.ok(Math.max(...all) <= 29, `спокойный провал слишком глубокий: ${Math.max(...all)}`);
});

test('the offset shifts a whole cycle without reshaping it', () => {
  const here = beatPath(PLAIN, 0.3);
  const there = beatPath({ ...PLAIN, at: 100 }, 0.3);
  assert.ok(there.startsWith('M100 20'));
  assert.ok(there.endsWith('L200 20'));
  // Same shape, every y untouched.
  assert.deepEqual(ys(there), ys(here));
});

/* ------------------------------- rhythm -------------------------------- */

test('no two beats in a phrase are alike', () => {
  // Пульс не должен повторяться. Identical cycles is what this replaced: the line looked like
  // one drawing on a conveyor belt, because it was.
  const beats = phrase(0.3);
  const gaps = new Set(beats.map((b) => b.scale.toFixed(4)));
  const heights = new Set(beats.map((b) => b.amp.toFixed(4)));
  assert.equal(gaps.size, beats.length, 'нашлись два одинаковых промежутка');
  assert.equal(heights.size, beats.length, 'нашлись два одинаковых по высоте удара');
  // And the variation has to be big enough to see, not a rounding difference.
  const scales = beats.map((b) => b.scale);
  assert.ok(Math.max(...scales) - Math.min(...scales) > 0.15, 'разброс промежутков незаметен');
});

test('spacing and height wander independently of each other', () => {
  // Heights rising and falling in step with the gaps would just be a slower pattern.
  const beats = phrase(0.5);
  const order = (get: (b: (typeof beats)[number]) => number) =>
    beats.map(get).map((v, _, all) => all.filter((o) => o < v).length);
  assert.notDeepEqual(order((b) => b.scale), order((b) => b.amp));
});

test('beats differ in shape, not only in size and spacing', () => {
  // Scaling one drawing up and down is still one drawing. These are the traits that make
  // neighbouring beats look like different beats.
  const beats = phrase(0.45);
  for (const trait of ['p', 't', 'tremor'] as const) {
    // Not strict uniqueness: two beats landing on the same value now and again is the noise
    // doing its job, not a pattern.
    const values = new Set(beats.map((b) => b[trait].toFixed(2)));
    assert.ok(values.size >= beats.length - 1, `${trait} повторяется: ${values.size} из ${beats.length}`);
  }
  assert.ok(
    new Set(beats.map((b) => beatPath({ ...b, at: 0 }, 0.45))).size === beats.length,
    'два удара рисуются одинаково',
  );
});

test('a heart misfires now and then, and more often when it is failing', () => {
  const misfires = (s: number) => phrase(s, 60).filter((b) => b.ectopic).length;
  assert.ok(misfires(0) > 0, 'здоровое сердце ни разу не сбилось');
  assert.ok(misfires(1) > misfires(0) * 1.5, 'умирающее сбивается не чаще здорового');
});

test('a misfire comes early and is paid for by a longer wait', () => {
  // The pair is what reads as a stumble; an early beat on its own just looks like noise.
  const beats = phrase(0.6);
  const i = beats.findIndex((b, k) => b.ectopic && k > 0 && k < beats.length - 1);
  assert.ok(i > 0, 'в этой фразе не нашлось сбоя');
  assert.ok(beats[i].scale < beats[i + 1].scale, 'после сбоя пауза не длиннее');
});

test('an inverted wave belongs to a heart in trouble', () => {
  assert.ok(
    phrase(0, 40).every((b) => b.t > 0),
    'у здорового перевёрнутая волна',
  );
  assert.ok(phrase(1, 40).some((b) => b.t < 0), 'у умирающего ни одной перевёрнутой');
});

test('the baseline shivers harder as the strain rises', () => {
  const shake = (s: number) => phrase(s).reduce((a, b) => a + b.tremor, 0);
  assert.ok(shake(1) > shake(0) * 2);
  assert.ok(shake(0) > 0, 'ровно спокойная линия — это снова ровная линия');
});

test('the phrase is the same every time it is built', () => {
  // It is rebuilt on every render; a fresh random each time would redraw the line mid-scroll.
  assert.deepEqual(phrase(0.42), phrase(0.42));
});

test('a failing heart keeps worse time than a fresh one', () => {
  const spread = (s: number) => {
    const scales = phrase(s).map((b) => b.scale);
    return Math.max(...scales) - Math.min(...scales);
  };
  assert.ok(spread(1) > spread(0));
});

test('beats never collide or leave a dead gap', () => {
  for (const strain of [0, 0.5, 1]) {
    for (const b of phrase(strain)) {
      // The floor is the hard one: the waveform is 91 units wide, so a cycle narrower than
      // about 0.7 would have two beats drawn on top of each other. The ceiling is only there
      // to keep a pause from swallowing the screen.
      assert.ok(b.scale >= 0.7, `удар сжался до ${b.scale} при ${strain}`);
      assert.ok(b.scale <= 1.75, `удар растянулся до ${b.scale} при ${strain}`);
    }
  }
});

test('the strip is the phrase twice, so the loop lands on itself', () => {
  const beats = phrase(0.3);
  const { d, width } = beatTrace(0.3, beats);
  assert.equal(width, phraseWidth(beats));
  // Scrolling shifts by exactly one phrase, so the half it scrolls onto must be the same
  // drawing — offset by the width and nothing else.
  const starts = [...d.matchAll(/M([\d.]+) 20/g)].map((m) => Number(m[1]));
  assert.equal(starts.length, beats.length * 2);
  for (const [i, b] of beats.entries()) {
    assert.equal(starts[i], Math.round(b.at * 100) / 100);
    assert.equal(starts[i + beats.length], Math.round((b.at + width) * 100) / 100);
  }
});

test('the window still shows several beats at once', () => {
  // A window narrower than a few cycles is back to one lonely spike crossing the screen.
  assert.ok(VISIBLE_CYCLES >= 3);
  assert.ok(PHRASE_BEATS > VISIBLE_CYCLES, 'фраза короче окна — повтор будет видно целиком');
});

/* ----------------------------- keyframes ------------------------------- */

test('the hearts thump once per beat of the same phrase', () => {
  const beats = phrase(0.4);
  const { times, scale, scaleX, glow } = heartKeyframes(beats);
  assert.equal(times.length, scale.length);
  assert.equal(times.length, scaleX.length);
  assert.equal(times.length, glow.length);
  // framer needs strictly increasing fractions of the whole animation.
  assert.equal(times[0], 0);
  assert.equal(times[times.length - 1], 1);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] > times[i - 1], `кадры ${i - 1} и ${i} на одном моменте`);
  }
  // One peak per beat, each a different size — the hearts wander the way the line does.
  const peaks = scale.filter((v, i) => i > 0 && i < scale.length - 1 && v > scale[i - 1] && v > scale[i + 1]);
  assert.equal(peaks.filter((v) => v > 1.2).length, beats.length);
  assert.ok(new Set(peaks.map((v) => v.toFixed(4))).size > 1);
});

test('a track reads back exactly what was put in it', () => {
  const times = [0, 0.25, 0.75, 1];
  const values = [0, 10, 2, 0];
  for (const [i, t] of times.entries()) {
    assert.equal(sampleTrack(times, values, t), values[i], `не совпало на ${t}`);
  }
});

test('a track is continuous between its keyframes', () => {
  const times = [0, 0.5, 1];
  const values = [0, 4, 0];
  const mid = sampleTrack(times, values, 0.25);
  assert.ok(mid > 0 && mid < 4, `середина вне отрезка: ${mid}`);
  // Easing, not a straight line: the move is front-loaded, like the thump it draws.
  assert.ok(mid > 2, `нет ускорения в начале отрезка: ${mid}`);
});

test('a phase outside 0..1 is pinned to the ends', () => {
  const times = [0, 1];
  const values = [3, 9];
  assert.equal(sampleTrack(times, values, -2), 3);
  assert.equal(sampleTrack(times, values, 5), 9);
});

test('the hearts can be read at any point of their phrase', () => {
  // This is what replaced handing framer a looping animation, so the whole track has to be
  // readable — a gap would show up as the pulse freezing at some point in the beat.
  const beats = phrase(0.4);
  const { times, scale } = heartKeyframes(beats);
  for (let p = 0; p <= 1; p += 0.01) {
    const v = sampleTrack(times, scale, p);
    assert.ok(Number.isFinite(v) && v >= 1 && v < 2, `на фазе ${p.toFixed(2)} вышло ${v}`);
  }
});

test('the ring resets while it is invisible', () => {
  // A keyframe track cannot jump, so the ring has to shrink back after it has faded out —
  // otherwise you see it collapse.
  const { times, scale, opacity } = ringKeyframes(phrase(0.4));
  assert.equal(times.length, scale.length);
  assert.equal(times.length, opacity.length);
  for (let i = 1; i < scale.length; i++) {
    if (scale[i] < scale[i - 1]) {
      assert.equal(opacity[i], 0, `кольцо сжимается на виду, кадр ${i}`);
      assert.equal(opacity[i - 1], 0);
    }
  }
});
