import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSS_INTRO_SEC,
  CALM_OPACITY,
  ENTER_OPACITY,
  ENTER_AT,
  HOLD_TO,
  calmTimes,
  OFFSCREEN_VW,
  VEIL_AT,
  VEIL_RUSH,
  VEIL_RUSH_TO,
  VEIL_TRACK,
  restingAt,
  BLINK,
  LAND,
  JOLT_X,
  SLIDE,
  TEAR_COUNT,
  TOPLIGHT,
  blinkTimes,
  SLOW_OPACITY,
  impactTimes,
  joltTimes,
  slowLineTimes,
  wordTearTimes,
  SHARD_COUNT,
  WORD_TEAR,
  SHARD_OPACITY,
  SHINE_DELAY_SEC,
  SHINE_FROM,
  SHINE_SEC,
  SHINE_TO,
  WAVE_OPACITY,
  WAVE_SCALE,
  shardAngle,
  shardReach,
  shardSpot,
  shardTimes,
  tearAt,
  topLightTimes,
  waveTimes,
  slideFrom,
  slideTimes,
  veilTimes,
} from './bossCut.ts';

const vw = (v: string) => Number(v.replace('vw', ''));

test('each one starts off the screen, not half on it', () => {
  // Вылезают из-за предела экрана. Measured in viewport widths on purpose: a share of the
  // element's own size leaves a narrow thing still in frame when the slide begins, which is
  // a nudge, not an entrance.
  assert.ok(OFFSCREEN_VW > 100, `старт всего в ${OFFSCREEN_VW}vw — виден на экране`);
  for (const step of [slideFrom('left')[0], slideFrom('right')[0]]) {
    assert.ok(step.endsWith('vw'), `старт задан не в ширинах экрана: ${step}`);
    assert.ok(Math.abs(vw(step)) > 100, `старт не за краем: ${step}`);
  }
  assert.ok(vw(slideFrom('left')[0]) < 0, 'слово стартует не слева');
  assert.ok(vw(slideFrom('right')[0]) > 0, 'фигура стартует не справа');
});

test('the whole track is in one unit', () => {
  // Framer cannot interpolate between vw and %, and silently does something odd if asked.
  for (const side of ['left', 'right'] as const) {
    for (const step of slideFrom(side)) {
      assert.ok(step.endsWith('vw'), `шаг в чужих единицах: ${step}`);
    }
  }
});

test('each lands in the middle and stays there', () => {
  for (const side of ['left', 'right'] as const) {
    const track = slideFrom(side);
    assert.equal(track[3], '0vw', `${side} не доезжает до места`);
    assert.equal(track[track.length - 1], '0vw', `${side} уезжает во время показа`);
  }
});

test('each overshoots in the direction it was thrown', () => {
  // A slide that decelerates onto its mark looks placed. Going a little past and coming back
  // is what makes it look thrown.
  const left = slideFrom('left');
  const right = slideFrom('right');
  assert.ok(vw(left[2]) > 0, 'слово слева не перелетает вправо');
  assert.ok(vw(right[2]) < 0, 'фигура справа не перелетает влево');
  assert.ok(Math.abs(vw(left[2])) < 8, 'перелёт слишком большой');
});

test('the throw is fast', () => {
  const sec = SLIDE * BOSS_INTRO_SEC;
  assert.ok(sec < 0.35, `вылет занимает ${sec}s — это уже выплывание`);
  assert.ok(sec > 0.08, `вылет за ${sec}s не успеет прочитаться`);
});

test('the dark is underway the moment the minion falls', () => {
  // Затемнение начинается сразу. The screen behind has already swapped to the boss by this
  // point, so a leisurely fade shows him lit before it covers him.
  const rush = VEIL_RUSH * BOSS_INTRO_SEC;
  assert.ok(rush < 0.22, `экран темнеет только через ${rush}s`);
  assert.ok(VEIL_RUSH_TO > 0.75, `за это время темнеет лишь на ${VEIL_RUSH_TO}`);
});

test('the dark has finished arriving before anything comes in', () => {
  // Плавнее. The calm is what the entrance is measured against; if the word turns up while
  // the room is still darkening, the two readings blur into one soft gesture.
  assert.ok(VEIL_AT < ENTER_AT, 'они трогаются раньше, чем экран затих');
  assert.ok((ENTER_AT - VEIL_AT) * BOSS_INTRO_SEC > 0.1, 'между затемнением и влётом нет паузы');
  assert.ok(VEIL_RUSH < VEIL_AT, 'рывок темноты не может быть позже её конца');
});

test('the dark goes all the way and stays there', () => {
  // A few percent short and the fight screen glows through the quiet moment — the boss's own
  // artwork is sitting right in the middle of it.
  assert.equal(VEIL_TRACK[0], 0);
  assert.equal(VEIL_TRACK[2], 1, 'темнота не доходит до чёрного');
  assert.equal(VEIL_TRACK[VEIL_TRACK.length - 1], 1, 'темнота отпускает до конца показа');
  const t = veilTimes();
  assert.equal(t.length, VEIL_TRACK.length);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `кадры темноты не по порядку: ${i}`);
});

test('one hit, not two', () => {
  // Одновременно. Landing a third of a second apart read as two events: a word, and then,
  // once you had finished looking at it, a picture.
  assert.equal(LAND, ENTER_AT + SLIDE);
  assert.ok(LAND > ENTER_AT, 'влёт и приземление в один момент');
});

test('they are fully in long before anything starts leaving', () => {
  assert.ok(LAND < HOLD_TO, 'показ начинается раньше, чем они доехали');
  const shown = (HOLD_TO - LAND) * BOSS_INTRO_SEC;
  assert.ok(shown > 0.8, `держатся всего ${shown}s`);
});

test('the keyframe tracks line up', () => {
  // Framer silently misbehaves when `times` and the value array differ in length, and
  // requires the times to increase.
  for (const at of [ENTER_AT]) {
    const times = slideTimes(at);
    assert.equal(times.length, ENTER_OPACITY.length);
    assert.equal(times.length, slideFrom('left').length);
    assert.equal(times[0], 0);
    assert.equal(times[times.length - 1], 1);
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] > times[i - 1], `кадры ${i - 1} и ${i} не по порядку при ${at}`);
    }
  }
});

test('the resting position is the one the track starts from', () => {
  // The component pins this in `initial`; if the two ever disagreed, the first painted frame
  // would put the thing somewhere the animation then jumps away from.
  for (const side of ['left', 'right'] as const) {
    assert.equal(restingAt(side), slideFrom(side)[0]);
  }
});




/* ------------------------------ the blows ------------------------------ */

/** A gated track must sit at zero right up to its moment. */
function litFrom(times: number[], track: readonly number[]): number {
  const i = track.findIndex((v) => v > 0);
  return times[i];
}

test('nothing is lit before the moment it belongs to', () => {
  // Молнии уже есть до анимации. Without a zero immediately before the moment, framer
  // interpolates from the first keyframe at t=0 and the thing fades up across the whole
  // approach — on screen, fully lit, before anything has happened.
  for (const at of [LAND, tearAt(0), tearAt(4)]) {
    const t = blinkTimes(at);
    assert.equal(BLINK[0], 0);
    assert.equal(BLINK[1], 0, 'нет нуля перед самым моментом');
    assert.ok(litFrom(t, BLINK) >= at - 0.001, `загорается на ${litFrom(t, BLINK)} вместо ${at}`);
    assert.ok(t[1] < at && at - t[1] < 0.02, 'ворота открываются слишком рано');
  }
});

test('a blink is a blink', () => {
  for (const at of [LAND, tearAt(2)]) {
    const t = blinkTimes(at);
    assert.equal(t.length, BLINK.length);
    assert.ok((t[3] - t[2]) * BOSS_INTRO_SEC < 0.1, 'вспышка висит слишком долго');
    assert.equal(BLINK[BLINK.length - 1], 0, 'вспышка остаётся гореть');
    for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], 'кадры вспышки не по порядку');
  }
});

test('the white-out is shorter than anything else', () => {
  const impact = impactTimes(LAND);
  const tear = blinkTimes(tearAt(0));
  assert.ok(impact[3] - impact[2] <= tear[3] - tear[2], 'вспышка удара длиннее разрыва');
});

test('the tears land with the blows, not between them', () => {
  for (let i = 0; i < WORD_TEAR; i++) {
    const moment = tearAt(i);
    const anchor = LAND;
    assert.ok(moment >= anchor - 0.001, `разрыв ${i} раньше своего удара`);
    assert.ok(moment - anchor < 0.05, `разрыв ${i} отстал от удара`);
  }
});

test('every tear has its own moment', () => {
  // Two on the same frame is one thicker tear, not two.
  const moments = Array.from({ length: TEAR_COUNT }, (_, i) => tearAt(i));
  const volley = moments.filter((_, i) => i !== WORD_TEAR);
  assert.equal(new Set(volley.map((m) => m.toFixed(4))).size, volley.length, 'разрывы совпали');
});

test('the line under the word arrives with the word', () => {
  // Вместе с надписью. The two are one blow; a line on its own schedule reads as something
  // separate happening nearby. But not on the very same frame — see below.
  const lag = (tearAt(WORD_TEAR) - LAND) * BOSS_INTRO_SEC;
  assert.ok(lag >= 0, 'линия опережает надпись');
  assert.ok(lag < 0.15, `линия отстаёт на ${lag}s — это уже отдельное событие`);
});

test('the line under the word is not drowned by the flash it lands in', () => {
  // The white-out fills the screen with red on that exact frame, and a red line on a red
  // screen is nothing at all. So the line waits for the flash to pass and then stays put
  // several times longer than the tears that come in the volley.
  const flash = impactTimes(LAND);
  const line = wordTearTimes();
  assert.ok(line[2] > flash[2], 'линия бьёт одновременно со вспышкой');
  const lineLit = (line[4] - line[2]) * BOSS_INTRO_SEC;
  const tearLit = (() => {
    const t = blinkTimes(tearAt(0));
    return (t[4] - t[2]) * BOSS_INTRO_SEC;
  })();
  assert.ok(lineLit > tearLit * 2, `линия держится ${lineLit}s против ${tearLit}s у обычной`);
  assert.ok(line[4] < HOLD_TO, 'линия ещё горит, когда всё уходит');
});

test('the flash is short enough to leave the frame visible', () => {
  const flash = impactTimes(LAND);
  const lit = (flash[4] - flash[1]) * BOSS_INTRO_SEC;
  assert.ok(lit < 0.2, `экран залит красным ${lit}s`);
});

test('the shine is one slow pass that finishes while the word is up', () => {
  // Одно медленное переливание. Looping turns the word into a shop sign; and a pass still
  // running when the word leaves is a pass nobody saw the end of.
  const shown = HOLD_TO * BOSS_INTRO_SEC - SHINE_DELAY_SEC;
  assert.ok(SHINE_SEC < shown, `блик идёт ${SHINE_SEC}s, а надпись стоит ${shown.toFixed(2)}s`);
  assert.ok(SHINE_SEC > 0.9, `${SHINE_SEC}s — это не медленно`);
  assert.ok(SHINE_SEC > shown * 0.6, 'блик слишком быстрый для одного прохода');
});

test('the shine starts once the word has arrived', () => {
  assert.ok(
    SHINE_DELAY_SEC >= LAND * BOSS_INTRO_SEC - 0.001,
    'блик бежит по надписи, пока она ещё летит',
  );
});

test('the shine never slides the fill off the letters', () => {
  // The letters are painted by this gradient. Past either end of the box it stops covering
  // them and the word vanishes — which is exactly what happened, for most of the animation,
  // until it was looked at on screen.
  const from = Number(SHINE_FROM.split('%')[0]);
  const to = Number(SHINE_TO.split('%')[0]);
  for (const v of [from, to]) {
    assert.ok(v >= 0 && v <= 100, `позиция ${v}% уводит заливку с букв`);
  }
  assert.notEqual(from, to, 'блик никуда не едет');
});

test('the light from above arrives with the landing and stays to the end', () => {
  const t = topLightTimes();
  assert.equal(t.length, TOPLIGHT.length);
  assert.equal(TOPLIGHT[0], 0);
  assert.ok(litFrom(t, TOPLIGHT) >= LAND - 0.001, 'свет сверху зажигается раньше приземления');
  assert.equal(TOPLIGHT[TOPLIGHT.length - 1], 0, 'свет остаётся гореть после показа');
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `кадры света не по порядку: ${i}`);
});

test('the jolt is one knock that settles', () => {
  const t = joltTimes();
  assert.equal(t.length, JOLT_X.length);
  assert.equal(JOLT_X[0], 0);
  assert.equal(JOLT_X[JOLT_X.length - 1], 0, 'картинка остаётся сдвинутой');
  assert.ok(Math.max(...JOLT_X.map(Math.abs)) >= 6, 'тряска слишком слабая, чтобы её заметить');
  assert.ok(Math.max(...JOLT_X.map(Math.abs)) <= 24, 'тряска уже не удар, а падение');
  assert.equal(t[1], LAND, 'толчок не на приземлении');
  assert.ok(JOLT_X.filter((v) => v !== 0).length >= 3, 'толчок без отката — это сдвиг, а не удар');
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `кадры тряски не по порядку: ${i}`);
});

test('the shockwave only exists for a moment, and only on the second blow', () => {
  const t = waveTimes();
  assert.equal(t.length, WAVE_SCALE.length);
  assert.equal(t.length, WAVE_OPACITY.length);
  assert.equal(WAVE_OPACITY[0], 0);
  assert.ok(litFrom(t, WAVE_OPACITY) >= LAND - 0.001, 'волна идёт раньше приземления');
  assert.ok((t[3] - t[2]) * BOSS_INTRO_SEC < 0.35, 'волна расходится слишком долго');
  assert.ok(WAVE_SCALE[3] > WAVE_SCALE[2] * 3, 'волна почти не расширяется');
  assert.equal(WAVE_OPACITY[WAVE_OPACITY.length - 1], 0, 'кольцо остаётся висеть');
});

test('the sparks are struck all over the frame, not out of one point', () => {
  // Звёздочка в центре. Lines radiating from a single origin make a star, and a star in the
  // middle of the composition is the one thing in here you cannot look away from.
  const spots = Array.from({ length: SHARD_COUNT }, (_, i) => shardSpot(i));
  assert.equal(new Set(spots.map((s) => `${s.left},${s.top}`)).size, SHARD_COUNT, 'искры в одной точке');
  const lefts = spots.map((s) => s.left);
  const tops = spots.map((s) => s.top);
  assert.ok(Math.min(...lefts) < 25 && Math.max(...lefts) > 75, 'искры жмутся к середине по ширине');
  assert.ok(Math.min(...tops) < 25 && Math.max(...tops) > 75, 'искры жмутся к середине по высоте');
  for (const s of spots) {
    assert.ok(s.left >= 0 && s.left <= 100 && s.top >= 0 && s.top <= 100, 'искра вне экрана');
  }
});

test('the sparks are small and differently aimed', () => {
  const angles = Array.from({ length: SHARD_COUNT }, (_, i) => shardAngle(i));
  assert.ok(new Set(angles).size > SHARD_COUNT * 0.7, 'искры смотрят в одну сторону');
  const reach = Array.from({ length: SHARD_COUNT }, (_, i) => shardReach(i));
  assert.ok(new Set(reach).size > SHARD_COUNT / 2, 'искры летят на одно расстояние');
  assert.ok(Math.max(...reach) < 120, 'это уже не искра, а полоса');
});

test('the sparks go out with the first blow and are gone fast', () => {
  for (let i = 0; i < SHARD_COUNT; i++) {
    const t = shardTimes(i);
    assert.equal(t.length, SHARD_OPACITY.length);
    assert.ok(litFrom(t, SHARD_OPACITY) >= LAND - 0.001, `искра ${i} вылетает до удара`);
    assert.ok((t[3] - t[2]) * BOSS_INTRO_SEC < 0.15, `искра ${i} висит ${(t[3] - t[2]) * BOSS_INTRO_SEC}s`);
    for (let k = 1; k < t.length; k++) assert.ok(t[k] > t[k - 1], `кадры осколка ${i} не по порядку`);
  }
  assert.equal(SHARD_OPACITY[SHARD_OPACITY.length - 1], 0, 'осколки остаются висеть');
});

test('the slow line only differs from the others in pace', () => {
  // Такая же, как другие, просто медленнее. It appears where it lies; it does not grow or
  // swing into place, which is a different gesture and read as the line toppling over.
  const t = slowLineTimes();
  assert.equal(t.length, SLOW_OPACITY.length);
  const rise = (t[2] - t[1]) * BOSS_INTRO_SEC;
  const tear = (() => {
    const q = blinkTimes(tearAt(0));
    return (q[2] - q[1]) * BOSS_INTRO_SEC;
  })();
  assert.ok(rise > 0.25, `проявляется за ${rise}s — это удар, а не медленное появление`);
  assert.ok(rise > tear * 10, 'появляется не медленнее обычного разрыва');
});

test('the slow line comes with the landing and stays for the shine', () => {
  const t = slowLineTimes();
  assert.ok(t[1] < LAND, 'ворота открываются позже приземления');
  assert.ok(t[1] > LAND - 0.02, 'линия начинается задолго до приземления');
  const stays = (t[3] - t[1]) * BOSS_INTRO_SEC;
  assert.ok(stays >= SHINE_SEC - 0.01, `линия уходит за ${stays}s, блик идёт ${SHINE_SEC}s`);
  assert.equal(t[3], HOLD_TO, 'линия держится не до самого конца показа');
});

test('the slow line leaves with everything else, not before it', () => {
  // Не должна исчезать в конце. Going out on its own clock left the composition standing
  // there with a hole in it where the line had been.
  const t = slowLineTimes();
  assert.equal(t[t.length - 2], HOLD_TO, 'линия начинает гаснуть не вместе со всеми');
  assert.equal(SLOW_OPACITY[SLOW_OPACITY.length - 2], SLOW_OPACITY[2], 'линия тускнеет заранее');
  assert.equal(SLOW_OPACITY[0], 0);
  assert.equal(SLOW_OPACITY[SLOW_OPACITY.length - 1], 0, 'линия остаётся висеть');
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `кадры линии не по порядку: ${i}`);
});

test('the quiet version is the same cut, not a shorter one', () => {
  // BossView dismisses the overlay on BOSS_INTRO_SEC regardless, so a version that finished
  // early would hand the player a black screen and a version that ran long would be cut off
  // mid-composition. Same landing, same hold, same exit.
  const t = calmTimes();
  assert.equal(t.length, CALM_OPACITY.length, 'кадров и значений разное количество');
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `кадры не по порядку: ${i}`);
  assert.equal(t[t.length - 1], 1, 'тихая версия заканчивается не вместе с показом');
  assert.equal(t[2], LAND, 'состав собирается не в тот момент, что и в громкой версии');
  assert.equal(t[3], HOLD_TO, 'держится не столько же, сколько громкая версия');
});

test('the quiet version still hides behind the dark before it arrives', () => {
  // The same gate as everywhere else here: a fade whose first keyframe is at t=0 starts
  // immediately, and the boss would bleed through the veil that exists to cover him.
  const t = calmTimes();
  assert.equal(CALM_OPACITY[0], 0);
  assert.equal(CALM_OPACITY[1], 0, 'состав начинает проявляться с нулевого кадра');
  assert.ok(t[1] >= VEIL_AT, 'проявляется раньше, чем экран успел потемнеть');
  assert.equal(CALM_OPACITY[CALM_OPACITY.length - 1], 0, 'тихая версия не уходит с экрана');
});

test('nothing in the quiet version is displaced', () => {
  // The whole point: same moments, no travel. Opacity is all that is left, and the loud
  // version's horizontal track must not be reachable from it.
  const loud = slideFrom('left');
  assert.ok(
    loud.some((x) => x !== '0vw'),
    'громкая версия перестала двигаться — тест сравнивает не с тем',
  );
  assert.ok(
    CALM_OPACITY.every((v) => v === 0 || v === 1),
    'тихая версия что-то делает кроме появления и исчезновения',
  );
});
