#!/usr/bin/env bash
#
# Builds the app and publishes dist/ to the gh-pages branch.
#
#   npm run deploy
#
# This exists because the local `gh` token has no `workflow` scope, so a GitHub Actions workflow
# can't be pushed. The workflow is kept ready at scripts/github-pages-workflow.yml — see README
# for how to switch over once the scope is granted, after which this script is redundant.
#
# gh-pages holds only build output and is force-pushed every time; its history is disposable.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE=$(git remote get-url origin)
SHA=$(git rev-parse --short HEAD)

echo "→ Проверки"
npm run lint
npm test
echo "→ Сборка"
npm run build

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R dist/. "$STAGE/"
# Without this, Pages runs the output through Jekyll, which silently drops files and folders
# whose names begin with an underscore.
touch "$STAGE/.nojekyll"

cd "$STAGE"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@local" commit -q -m "build $SHA"
git push -qf "$REMOTE" gh-pages

echo "→ Опубликовано из $SHA"

# The same game, built for the domain root, to Yandex Object Storage: mobile operators in Russia
# cut github.io. Skipped without the upload key — see README, «Игра на Yandex Cloud».
cd "$ROOT"
YC_BUCKET="${YC_BUCKET:-pushuplegends}"
if grep -q '^YC_SECRET_ACCESS_KEY=.' .env.deploy.local 2>/dev/null; then
  echo "→ Сборка для Yandex"
  BASE_PATH=/ npx vite build >/dev/null
  node scripts/upload-yandex.mjs "$YC_BUCKET"
  echo "→ https://$YC_BUCKET.website.yandexcloud.net/"
  # Leave dist/ as the GitHub build, like before.
  npx vite build >/dev/null
else
  echo "→ Yandex пропущен: нет ключа в .env.deploy.local"
fi
