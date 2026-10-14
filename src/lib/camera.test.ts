import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openCamera, startVideo } from './camera.ts';

const fail = (name: string) => Object.assign(new Error(name), { name });
const noWait = async () => {};
const STREAM = { id: 'stream' } as unknown as MediaStream;

/** A getUserMedia that throws the given errors in turn, then hands out the stream. */
function media(...errors: string[]) {
  const asked: MediaStreamConstraints[] = [];
  return {
    asked,
    getUserMedia: async (c?: MediaStreamConstraints) => {
      asked.push(c ?? {});
      const next = errors.shift();
      if (next) throw fail(next);
      return STREAM;
    },
  };
}

test('Камера: «занята» сразу после перезапуска — ждём и пробуем снова', async () => {
  const m = media('NotReadableError', 'NotReadableError');
  assert.equal(await openCamera('user', m, noWait), STREAM);
  assert.equal(m.asked.length, 3);
});

test('Камера: не умеет нужное разрешение — просим без требований к размеру', async () => {
  const m = media('OverconstrainedError');
  assert.equal(await openCamera('environment', m, noWait), STREAM);
  assert.deepEqual(m.asked[1], { video: { facingMode: 'environment' }, audio: false });
});

test('Камера: нет камеры с этой стороны — берём любую', async () => {
  const m = media('NotFoundError', 'NotFoundError');
  assert.equal(await openCamera('environment', m, noWait), STREAM);
  assert.deepEqual(m.asked[2], { video: true, audio: false });
});

test('Камера: запрет доступа не повторяем — сразу отдаём ошибку', async () => {
  const m = media('NotAllowedError');
  await assert.rejects(openCamera('user', m, noWait), { name: 'NotAllowedError' });
  assert.equal(m.asked.length, 1);
});

test('Камера: совсем нет камер — после всех попыток ошибка «не найдена»', async () => {
  const m = media('NotFoundError', 'NotFoundError', 'NotFoundError');
  await assert.rejects(openCamera('user', m, noWait), { name: 'NotFoundError' });
});

test('Видео: прерванный запуск повторяем, третья неудача — ошибка PlayFailed', async () => {
  let calls = 0;
  const video = {
    muted: false,
    playsInline: false,
    play: async () => {
      calls += 1;
      if (calls < 2) throw fail('AbortError');
    },
  } as unknown as HTMLVideoElement;
  await startVideo(video, noWait);
  assert.equal(calls, 2);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);

  const broken = { play: async () => { throw fail('NotAllowedError'); } } as unknown as HTMLVideoElement;
  await assert.rejects(startVideo(broken, noWait), { name: 'PlayFailed' });
});
