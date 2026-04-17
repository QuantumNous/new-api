#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git -C "$ROOT_DIR" config core.hooksPath .githooks
chmod +x \
  "$ROOT_DIR/.githooks/pre-commit" \
  "$ROOT_DIR/.githooks/commit-msg" \
  "$ROOT_DIR/scripts/setup-hooks.sh" \
  "$ROOT_DIR/scripts/ai/verify_constraints.sh"

printf 'Git hooks 已启用：%s/.githooks\n' "$ROOT_DIR"
printf '这样做符合 DRY，收益是本地与 CI 共用同一套约束入口。\n'
