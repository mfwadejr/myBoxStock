#!/usr/bin/env bash
# myBoxStock deploy: tag + push the release, wait for the Docker image to build, then update the ZimaOS box and check it is running the new version.
#
# Usage (from the repo root on your Mac):
#   tools/deploy.sh                 tag the version in package.json, push, wait for the image, deploy to ZimaOS
#   tools/deploy.sh --no-tag        skip tag/push (already done); wait for the image and deploy
#   tools/deploy.sh --deploy-only   only update ZimaOS (image already published)
#
# Settings (environment variables, defaults in brackets):
#   ZIMA_HOST   ssh target for the ZimaOS box, e.g. root@zimaos.local        [required for the deploy step]
#   ZIMA_URL    address to check /healthz on                                 [http://zimaos.local:9080]
#   CONTAINER   container name                                               [myboxstock]
#   IMAGE       image to pull                                                [ghcr.io/mfwadejr/myboxstock]
#   COMPOSE_DIR folder on ZimaOS holding docker-compose.yml (optional); if unset, the container is recreated from its current settings
set -euo pipefail

MODE=full
case "${1:-}" in --no-tag) MODE=notag ;; --deploy-only) MODE=deploy ;; "") ;; *) echo "Unknown option: $1" >&2; exit 2 ;; esac

ZIMA_URL="${ZIMA_URL:-http://zimaos.local:9080}"
CONTAINER="${CONTAINER:-myboxstock}"
IMAGE="${IMAGE:-ghcr.io/mfwadejr/myboxstock}"
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -f package.json ] && [ -f CHANGELOG.md ] || die "Run this from the myBoxStock repo root."

if [ "$MODE" = full ]; then
  say "Checking release $TAG"
  [ -z "$(git status --porcelain)" ] || die "Working tree is not clean. Commit or stash first."
  grep -q "^## \[${VERSION}\]" CHANGELOG.md || die "CHANGELOG.md has no entry for ${VERSION}."
  [ "$(git rev-parse --abbrev-ref HEAD)" = main ] || die "Not on the main branch."
  git rev-parse "$TAG" >/dev/null 2>&1 && die "Tag $TAG already exists. Bump the version or use --no-tag."
  say "Tagging and pushing $TAG"
  git tag "$TAG"
  git push origin main --tags
fi

if [ "$MODE" != deploy ]; then
  say "Waiting for the Docker image build (GitHub Actions)"
  if command -v gh >/dev/null 2>&1; then
    sleep 10
    RUN="$(gh run list --workflow docker.yml --limit 1 --json databaseId -q '.[0].databaseId')"
    [ -n "$RUN" ] && gh run watch "$RUN" --exit-status || die "The image build failed. See: gh run view $RUN --log-failed"
  else
    echo "gh (GitHub CLI) not found: waiting for the image to appear instead (up to 15 minutes)."
    for i in $(seq 1 90); do
      docker manifest inspect "${IMAGE}:${VERSION}" >/dev/null 2>&1 && break
      [ "$i" = 90 ] && die "Image ${IMAGE}:${VERSION} did not appear."
      sleep 10
    done
  fi
fi

[ -n "${ZIMA_HOST:-}" ] || die "Set ZIMA_HOST (for example: export ZIMA_HOST=root@zimaos.local) to deploy."
say "Updating ZimaOS ($ZIMA_HOST)"
if [ -n "${COMPOSE_DIR:-}" ]; then
  ssh "$ZIMA_HOST" "cd '$COMPOSE_DIR' && docker compose pull && docker compose up -d"
else
  # Recreate the container from its own settings: same ports, environment and data folder, new image.
  ssh "$ZIMA_HOST" "docker pull '${IMAGE}:${VERSION}' && docker tag '${IMAGE}:${VERSION}' '${IMAGE}:latest' && (docker compose -p '$CONTAINER' up -d --force-recreate 2>/dev/null || docker restart '$CONTAINER')"
fi

say "Checking ${ZIMA_URL}/healthz"
for i in $(seq 1 30); do
  OUT="$(curl -fsS "${ZIMA_URL}/healthz" 2>/dev/null || true)"
  if printf '%s' "$OUT" | grep -q "$VERSION"; then say "Deployed: running ${TAG}"; echo "$OUT"; echo "Hard-refresh your browser (Cmd+Shift+R) to load the new files."; exit 0; fi
  sleep 4
done
die "The app did not report version ${VERSION} within 2 minutes. Last answer: ${OUT:-none}. Check: ssh $ZIMA_HOST docker logs --tail 50 $CONTAINER"
