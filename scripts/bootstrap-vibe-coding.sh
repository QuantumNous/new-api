#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_URL="https://github.com/QuantumNous/new-api.git"

printf '[bootstrap] 根目录：%s\n' "$ROOT_DIR"

if git -C "$ROOT_DIR" remote get-url upstream >/dev/null 2>&1; then
  current_upstream="$(git -C "$ROOT_DIR" remote get-url upstream)"
  printf '[bootstrap] upstream 已存在：%s\n' "$current_upstream"
else
  git -C "$ROOT_DIR" remote add upstream "$UPSTREAM_URL"
  printf '[bootstrap] 已添加 upstream：%s\n' "$UPSTREAM_URL"
fi

"$ROOT_DIR/scripts/setup-hooks.sh"

git -C "$ROOT_DIR" fetch upstream

printf '\n[bootstrap] 当前远端：\n'
git -C "$ROOT_DIR" remote -v

printf '\n[bootstrap] 当前 hooksPath：%s\n' "$(git -C "$ROOT_DIR" config --get core.hooksPath)"
printf '[bootstrap] 官方主线最新提交：\n'
git -C "$ROOT_DIR" log --oneline upstream/main -n 3

printf '\n[bootstrap] 下一步建议：\n'
printf '  1. 阅读 docs/ai/GIT_WORKFLOW.md\n'
printf '  2. 新需求从 feature/<task-name> 开始\n'
printf '  3. 官方同步从 sync/upstream-YYYY-MM-DD 开始\n'

