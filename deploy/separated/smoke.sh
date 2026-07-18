#!/usr/bin/env bash
# Same-origin separated stack smoke checks.
# Usage:
#   FRONTEND_BASE=http://127.0.0.1:8080 ./deploy/separated/smoke.sh
set -euo pipefail

FRONTEND_BASE="${FRONTEND_BASE:-http://127.0.0.1:8080}"
FRONTEND_BASE="${FRONTEND_BASE%/}"

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  ${name}"
    pass=$((pass + 1))
  else
    echo "FAIL  ${name}"
    fail=$((fail + 1))
  fi
}

body_has() {
  local url="$1"
  local needle="$2"
  local code
  local body
  body="$(curl -fsS --max-time 15 "${url}")" || return 1
  printf '%s' "${body}" | grep -q "${needle}"
}

http_code() {
  local method="$1"
  local url="$2"
  local expect="$3"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -X "${method}" "${url}")" || return 1
  test "${code}" = "${expect}"
}

echo "Smoke against ${FRONTEND_BASE}"
check "frontend-healthz" body_has "${FRONTEND_BASE}/frontend-healthz" '"status":"ok"'
check "spa index" http_code GET "${FRONTEND_BASE}/" 200
check "api status via proxy" body_has "${FRONTEND_BASE}/api/status" '{'
check "v1 without token is 401" http_code GET "${FRONTEND_BASE}/v1/models" 401
check "readyz via proxy" body_has "${FRONTEND_BASE}/readyz" '"status"'
check "metrics blocked on edge" http_code GET "${FRONTEND_BASE}/metrics" 404

echo
echo "passed=${pass} failed=${fail}"
test "${fail}" -eq 0
