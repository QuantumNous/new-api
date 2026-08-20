#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$DIR/ORIGINAL_FILE" "$DIR/ROLLBACK_TEST_COPY"
sha256sum "$DIR/ROLLBACK_TEST_COPY" | awk '{print toupper($1)}'