#!/usr/bin/env node
/**
 * Uploads dist/ to the Yandex Object Storage bucket that serves the game in Russia.
 *
 *   node scripts/upload-yandex.mjs <bucket>
 *
 * Mobile operators in Russia cut github.io, so the game is also hosted at
 * https://<bucket>.website.yandexcloud.net — see README, «Игра на Yandex Cloud». The build has to
 * be made with BASE_PATH=/ first (deploy-pages.sh does that).
 *
 * Credentials come from .env.deploy.local (YC_ACCESS_KEY_ID, YC_SECRET_ACCESS_KEY): a static key
 * of a service account with storage.editor. Old hashed assets are left in place on purpose — an
 * open page still running the previous build may yet ask for them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const bucket = process.argv[2];
if (!bucket) {
  console.error('Usage: node scripts/upload-yandex.mjs <bucket>');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.deploy.local'), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
if (!env.YC_ACCESS_KEY_ID || !env.YC_SECRET_ACCESS_KEY) {
  console.error('В .env.deploy.local нет YC_ACCESS_KEY_ID / YC_SECRET_ACCESS_KEY.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: { accessKeyId: env.YC_ACCESS_KEY_ID, secretAccessKey: env.YC_SECRET_ACCESS_KEY },
});

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Hashed bundles never change under the same name, so they're cached for good. Everything else —
 * index.html, the service worker and what it imports, the manifest — must be checked every time,
 * or a phone keeps running the old version after a deploy.
 */
function cacheControl(key) {
  return key.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === '.DS_Store') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// index.html and the service worker last, so they never point at files that aren't there yet.
const LAST = new Set(['index.html', 'sw.js', 'registerSW.js', 'manifest.webmanifest']);
const files = walk(DIST)
  .map((path) => ({ path, key: relative(DIST, path).split('\\').join('/') }))
  .sort((a, b) => Number(LAST.has(a.key)) - Number(LAST.has(b.key)));

let done = 0;
const queue = files.filter((f) => !LAST.has(f.key));
const upload = async ({ path, key }) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: readFileSync(path),
      ContentType: TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream',
      CacheControl: cacheControl(key),
    }),
  );
  done++;
};

const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) await upload(queue.shift());
});
await Promise.all(workers);
for (const f of files.filter((f) => LAST.has(f.key))) await upload(f);

console.log(`→ Yandex: загружено ${done} файлов в ${bucket}`);
