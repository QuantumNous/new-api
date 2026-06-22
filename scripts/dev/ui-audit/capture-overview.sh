#!/usr/bin/env bash
# Capture /dashboard/overview screenshot for visual acceptance.
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
export BASE_URL="${BASE_URL:-http://192.168.18.94:3001}"
export UI_AUDIT_USERNAME="${UI_AUDIT_USERNAME:-${DEMO_USERNAME:-}}"
export UI_AUDIT_PASSWORD="${UI_AUDIT_PASSWORD:-${DEMO_PASSWORD:-}}"

exec node "$AUDIT_DIR/capture-overview.mjs"
