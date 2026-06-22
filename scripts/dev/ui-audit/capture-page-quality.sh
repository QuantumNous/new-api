#!/usr/bin/env bash
# Full-page UI quality capture (Playwright). Credentials via env only — do not commit passwords.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export BASE_URL="${BASE_URL:-http://192.168.18.94:3001}"
node scripts/dev/ui-audit/capture-page-quality.mjs
