#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web/default"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required to rebuild the frontend. Please install bun first."
  exit 1
fi

echo "Rebuilding frontend..."
cd "$WEB_DIR"
bun run build

"$ROOT_DIR/stop.sh"
REBUILD=1 "$ROOT_DIR/start.sh"
