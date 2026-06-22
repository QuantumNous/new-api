#!/bin/sh
set -eu

cd /app

if [ ! -f node_modules/.modules.yaml ] && [ ! -d node_modules/.pnpm ]; then
  echo "[web-dev] Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
fi

exec pnpm dev --host 0.0.0.0 --port 3001
