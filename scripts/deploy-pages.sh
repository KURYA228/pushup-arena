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
