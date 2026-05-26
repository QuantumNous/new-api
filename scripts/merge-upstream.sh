#!/usr/bin/env bash
# Merge upstream new-api and re-apply fork patches (requestaudit, etc.).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"

echo "==> Fetch ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

echo "==> Merge ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH} into current branch"
if ! git merge "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"; then
  echo "Merge conflict. Resolve conflicts, then run:"
  echo "  git apply --3way patches/*.patch"
  echo "  go build ./..."
  exit 1
fi

echo "==> Apply fork patches"
if ! git apply --3way patches/*.patch; then
  echo "Patch apply failed. Typical conflict files:"
  echo "  - main.go (FORK:BEGIN requestaudit block)"
  echo "  - router/relay-router.go (RegisterRelayForkMiddleware after StatsMiddleware)"
  exit 1
fi

echo "==> Build"
if command -v go >/dev/null 2>&1; then
  go build ./pkg/... ./router/... ./middleware/... ./model/... ./controller/... 2>/dev/null || go build ./...
fi

echo "Done. Commit with: chore: merge upstream + apply fork patches"
