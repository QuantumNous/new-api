#!/usr/bin/env bash
# =============================================================================
# bin/test-dr13.sh — DR-13 TenantQuotaCheck Complete Verification Suite
#
# DR-13 claim: per-token rate limits (RPM / TPM / Monthly) are enforced at the
# relay entry point — BEFORE any upstream call — via TenantQuotaCheck middleware.
#
# SETUP REQUIRED — create these 4 tokens in admin UI before running:
#
#   RPM_KEY     rpm_limit=5  tpm_limit=0   monthly_limit=0
#   TPM_KEY     rpm_limit=0  tpm_limit=20  monthly_limit=0
#   MONTHLY_KEY rpm_limit=0  tpm_limit=0   monthly_limit=3
#               !! Use a FRESH token — monthly counter never resets mid-month !!
#   ROOT_KEY    rpm_limit=0  tpm_limit=0   monthly_limit=0  (unlimited)
#
# Why these values:
#   RPM limit=5      → fire 5 (pass) then 1 more (429)
#   TPM limit=20     → standard test body is 81 bytes → 81/4=20 estimated tokens
#                      first request uses exactly 20 (pass), second adds 20 (40>20, 429)
#   Monthly limit=3  → fire 3 (pass) then 1 more (429)
#
# Usage:
#   RPM_KEY=sk-xxx TPM_KEY=sk-yyy MONTHLY_KEY=sk-zzz ROOT_KEY=sk-www bash bin/test-dr13.sh
#
# Env vars:
#   BASE_URL    default: http://localhost:3000
#   SKIP_SLOW   set to 1 to skip the 62-second RPM window-expiry test in §8
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SKIP_SLOW="${SKIP_SLOW:-0}"

RPM_KEY="${RPM_KEY:-}"
TPM_KEY="${TPM_KEY:-}"
MONTHLY_KEY="${MONTHLY_KEY:-}"
ROOT_KEY="${ROOT_KEY:-}"

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
SEP='────────────────────────────────────────────────────────'

pass=0; fail=0
declare -A sec_p; declare -A sec_f
cur_sec=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
section() {
  cur_sec="$1"
  sec_p["$cur_sec"]=0; sec_f["$cur_sec"]=0
  echo ""
  echo -e "${BOLD}${CYAN}${SEP}${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}${SEP}${RESET}"
  echo ""
}

_do_curl() {
  local auth="$1" endpoint="$2" body="${3:-}"
  local -a dat=(); [[ -n "$body" ]] && dat+=(-d "$body")
  curl -s -w "\n__S__%{http_code}" --max-time 20 \
    -X POST \
    -H "Authorization: Bearer $auth" \
    -H "Content-Type: application/json" \
    "${dat[@]}" \
    "$BASE_URL$endpoint" 2>&1
}

_do_curl_no_auth() {
  local endpoint="$1" body="${2:-}"
  local -a dat=(); [[ -n "$body" ]] && dat+=(-d "$body")
  curl -s -w "\n__S__%{http_code}" --max-time 10 \
    -X POST -H "Content-Type: application/json" \
    "${dat[@]}" "$BASE_URL$endpoint" 2>&1
}

_status() { printf '%s' "$1" | tail -1 | sed 's/.*__S__//'; }
_body()   { printf '%s' "$1" | grep -v '__S__' | head -c 400; }

_record() {
  local label="$1" expected="$2" actual="$3" body_text="$4"
  echo -e "${BOLD}── $label${RESET}"
  echo -e "  ${DIM}expected : $expected     actual : $actual${RESET}"
  [[ -n "$body_text" ]] && echo -e "  ${DIM}body     : $body_text${RESET}"
  if [[ "$actual" == "$expected" ]]; then
    echo -e "  ${GREEN}✅ PASS${RESET}"
    sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
  else
    echo -e "  ${RED}❌ FAIL  (expected $expected, got $actual)${RESET}"
    sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
  fi
  echo ""
}

run_test() {
  local label="$1" expected="$2" auth="$3" endpoint="$4" body="${5:-}"
  local raw; raw=$(_do_curl "$auth" "$endpoint" "$body")
  _record "$label" "$expected" "$(_status "$raw")" "$(_body "$raw")"
}

# Assert middleware allowed the request (status != 429 AND no tenant_quota_exceeded).
# Used for "pass" cases — upstream may return any non-429 code (upstream errors are OK;
# we are testing the quota middleware, not the upstream provider).
assert_allowed() {
  local label="$1" auth="$2" endpoint="$3" body="${4:-}"
  local raw; raw=$(_do_curl "$auth" "$endpoint" "$body")
  local s; s=$(_status "$raw"); local bt; bt=$(_body "$raw")
  echo -e "${BOLD}── $label${RESET}"
  echo -e "  ${DIM}middleware must allow (status≠429, no tenant_quota_exceeded)  actual=$s${RESET}"
  [[ -n "$bt" ]] && echo -e "  ${DIM}body: $bt${RESET}"
  if [[ "$s" != "429" ]] && ! echo "$bt" | grep -qF "tenant_quota_exceeded"; then
    echo -e "  ${GREEN}✅ PASS${RESET}"
    sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
  else
    echo -e "  ${RED}❌ FAIL  — middleware blocked the request (status=$s)${RESET}"
    sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
  fi
  echo ""
}

assert_body() {
  local label="$1" needle="$2" auth="$3" endpoint="$4" body="${5:-}"
  local raw; raw=$(_do_curl "$auth" "$endpoint" "$body")
  local s; s=$(_status "$raw"); local bt; bt=$(_body "$raw")
  echo -e "${BOLD}── $label${RESET}"
  echo -e "  ${DIM}needle: \"$needle\"  status=$s${RESET}"
  [[ -n "$bt" ]] && echo -e "  ${DIM}body: $bt${RESET}"
  if echo "$bt" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✅ PASS${RESET}"
    sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
  else
    echo -e "  ${RED}❌ FAIL  — needle not found${RESET}"
    sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
  fi
  echo ""
}

assert_body_absent() {
  local label="$1" absent="$2" auth="$3" endpoint="$4" body="${5:-}"
  local raw; raw=$(_do_curl "$auth" "$endpoint" "$body")
  local s; s=$(_status "$raw"); local bt; bt=$(_body "$raw")
  echo -e "${BOLD}── $label${RESET}"
  echo -e "  ${DIM}must NOT contain: \"$absent\"  status=$s${RESET}"
  [[ -n "$bt" ]] && echo -e "  ${DIM}body: $bt${RESET}"
  if ! echo "$bt" | grep -qF "$absent"; then
    echo -e "  ${GREEN}✅ PASS${RESET}"
    sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
  else
    echo -e "  ${RED}❌ FAIL  — forbidden string found${RESET}"
    sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║         DR-13 TenantQuotaCheck Verification Suite        ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

missing=0
for var in RPM_KEY TPM_KEY MONTHLY_KEY ROOT_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo -e "${RED}ERROR: $var is not set${RESET}"
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo ""
  echo "  Usage: RPM_KEY=sk-xxx TPM_KEY=sk-yyy MONTHLY_KEY=sk-zzz ROOT_KEY=sk-www bash bin/test-dr13.sh"
  echo ""
  echo "  Token setup (admin UI):"
  echo "    RPM_KEY     rpm_limit=5,  tpm_limit=0,  monthly_limit=0"
  echo "    TPM_KEY     rpm_limit=0,  tpm_limit=20, monthly_limit=0"
  echo "    MONTHLY_KEY rpm_limit=0,  tpm_limit=0,  monthly_limit=3  (fresh token!)"
  echo "    ROOT_KEY    rpm_limit=0,  tpm_limit=0,  monthly_limit=0"
  exit 1
fi

echo -e "${CYAN}Checking server at $BASE_URL ...${RESET}"
if ! curl -sf -o /dev/null --max-time 5 "$BASE_URL/api/status"; then
  echo -e "${RED}Server not reachable.${RESET}"
  exit 1
fi
echo -e "${GREEN}Server OK${RESET}"
[[ "$SKIP_SLOW" == "1" ]] && echo -e "${YELLOW}SKIP_SLOW=1 — §8 window-expiry test will be skipped${RESET}"
echo ""

# Standard request body used throughout (81 bytes → 81/4 = 20 estimated tokens)
BODY='{"model":"gpt-4o-mini","messages":[{"role":"user","content":"x"}],"max_tokens":1}'

# ============================================================================
# SECTION 1 — RPM Enforcement
# Token has rpm_limit=5. First 5 requests must succeed, 6th must return 429.
# All 6 requests are fired immediately — they all fall within the 60s window.
# ============================================================================
section "SECTION 1 — RPM Enforcement: rpm_limit=5 → first 5 pass, 6th blocked"
echo -e "${DIM}  RPM_KEY has rpm_limit=5. Sliding window = 60 seconds.${RESET}"
echo -e "${DIM}  All 6 requests fired immediately so they share the same window.${RESET}"
echo ""

for i in 1 2 3 4 5; do
  assert_allowed "1.$i  RPM_KEY request #$i of 5 — middleware must allow" \
    "$RPM_KEY" "/v1/chat/completions" "$BODY"
done

run_test "1.6  RPM_KEY request #6 — limit reached, must return 429" \
  "429" "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "1.7  429 body contains 'tenant_quota_exceeded'" \
  "tenant_quota_exceeded" \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "1.8  429 body mentions 'rpm'" \
  "rpm" \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

run_test "1.9  RPM_KEY still blocked on 7th attempt (window not yet expired)" \
  "429" "$RPM_KEY" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 2 — TPM Enforcement
# Token has tpm_limit=20. Standard body = 81 bytes → 81/4 = 20 estimated tokens.
# First request: 0+20=20, is 20>20? No → allowed, counter=20.
# Second request: 20+20=40, is 40>20? Yes → 429.
# ============================================================================
section "SECTION 2 — TPM Enforcement: tpm_limit=20 → first request passes, second blocked"
echo -e "${DIM}  TPM_KEY has tpm_limit=20. Request body = 81 bytes → 20 estimated tokens.${RESET}"
echo -e "${DIM}  First request: 0+20=20 ≤ 20 → allowed. Second: 20+20=40 > 20 → 429.${RESET}"
echo ""

assert_allowed "2.1  TPM_KEY first request — 20 estimated tokens ≤ 20 limit → middleware allows" \
  "$TPM_KEY" "/v1/chat/completions" "$BODY"

run_test "2.2  TPM_KEY second request — bucket now 40 > 20 → 429" \
  "429" "$TPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "2.3  429 body contains 'tenant_quota_exceeded'" \
  "tenant_quota_exceeded" \
  "$TPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "2.4  429 body mentions 'tpm'" \
  "tpm" \
  "$TPM_KEY" "/v1/chat/completions" "$BODY"

assert_allowed "2.5  ROOT_KEY same body — no TPM limit → middleware allows (unlimited)" \
  "$ROOT_KEY" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 3 — Monthly Enforcement
# Token has monthly_limit=3. First 3 requests must pass, 4th must return 429.
# WARNING: monthly counter persists until end of calendar month.
#          Use a fresh token that has never been used this month.
# ============================================================================
section "SECTION 3 — Monthly Enforcement: monthly_limit=3 → first 3 pass, 4th blocked"
echo -e "${DIM}  MONTHLY_KEY has monthly_limit=3.${RESET}"
echo -e "${YELLOW}  ⚠️  Monthly counter persists all month. Run with a fresh token only.${RESET}"
echo ""

for i in 1 2 3; do
  assert_allowed "3.$i  MONTHLY_KEY request #$i of 3 — middleware must allow" \
    "$MONTHLY_KEY" "/v1/chat/completions" "$BODY"
done

run_test "3.4  MONTHLY_KEY request #4 — monthly limit reached, must return 429" \
  "429" "$MONTHLY_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "3.5  429 body contains 'tenant_quota_exceeded'" \
  "tenant_quota_exceeded" \
  "$MONTHLY_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "3.6  429 body mentions 'monthly'" \
  "monthly" \
  "$MONTHLY_KEY" "/v1/chat/completions" "$BODY"

run_test "3.7  MONTHLY_KEY still blocked on 5th attempt" \
  "429" "$MONTHLY_KEY" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 4 — Unlimited Token (all limits = 0)
# ROOT_KEY has no limits. Firing 10 requests rapidly must never return 429.
# ============================================================================
section "SECTION 4 — Unlimited Token: all limits=0, 10 requests never 429"
echo -e "${DIM}  ROOT_KEY has rpm_limit=0, tpm_limit=0, monthly_limit=0.${RESET}"
echo -e "${DIM}  Limit of 0 means unlimited — TenantQuotaCheck skips all checks.${RESET}"
echo ""

for i in $(seq 1 10); do
  assert_allowed "4.$i  ROOT_KEY request #$i — no limits, middleware must allow" \
    "$ROOT_KEY" "/v1/chat/completions" "$BODY"
done

# ============================================================================
# SECTION 5 — Error Response Schema
# Policy-blocked (429) responses must have a well-formed JSON error body.
# ============================================================================
section "SECTION 5 — Error Response Schema: 429 body must have correct fields"
echo -e "${DIM}  Validates that 429 is structured JSON — not a raw string or empty body.${RESET}"
echo ""

# Use RPM_KEY which is already exhausted from §1
assert_body \
  "5.1  429 body has 'type':'new_api_error'" \
  '"type":"new_api_error"' \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "5.2  429 body has 'code':'tenant_quota_exceeded'" \
  '"code":"tenant_quota_exceeded"' \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "5.3  429 body has top-level 'error' object" \
  '"error":{' \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body \
  "5.4  429 body has 'message' field" \
  '"message"' \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_body_absent \
  "5.5  429 body does NOT say 'model_not_eligible_for_kids_mode' (not a policy error)" \
  "model_not_eligible_for_kids_mode" \
  "$RPM_KEY" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 6 — Token Isolation
# One token exhausted must not affect a different token's counter.
# RPM_KEY is exhausted. ROOT_KEY must still be unlimited.
# ============================================================================
section "SECTION 6 — Token Isolation: exhausted token does not affect other tokens"
echo -e "${DIM}  RPM_KEY is exhausted from §1. ROOT_KEY must still work normally.${RESET}"
echo ""

run_test "6.1  RPM_KEY still blocked (confirmed exhausted)" \
  "429" "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_allowed "6.2  ROOT_KEY immediately after — still allowed (independent counter)" \
  "$ROOT_KEY" "/v1/chat/completions" "$BODY"

assert_allowed "6.3  ROOT_KEY again — still allowed" \
  "$ROOT_KEY" "/v1/chat/completions" "$BODY"

run_test "6.4  RPM_KEY again — still blocked (not contaminated by root)" \
  "429" "$RPM_KEY" "/v1/chat/completions" "$BODY"

assert_allowed "6.5  ROOT_KEY after more RPM_KEY blocks — root unaffected" \
  "$ROOT_KEY" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 7 — Quota Does Not Apply to Non-Relay Routes
# Admin API routes bypass the relay middleware chain entirely.
# TenantQuotaCheck must never interfere with /api/* routes.
# ============================================================================
section "SECTION 7 — Non-relay Routes: quota middleware not on admin API"
echo -e "${DIM}  GET /api/status is not in the relay router — quota must not run.${RESET}"
echo ""

echo -e "${BOLD}── 7.1  GET /api/status with exhausted RPM_KEY — must not return 429${RESET}"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer $RPM_KEY" "$BASE_URL/api/status")
echo -e "  ${DIM}actual: $STATUS_CODE (any non-429 is acceptable)${RESET}"
if [[ "$STATUS_CODE" != "429" ]]; then
  echo -e "  ${GREEN}✅ PASS — got $STATUS_CODE (quota not applied to admin API)${RESET}"
  sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
else
  echo -e "  ${RED}❌ FAIL — got 429, quota middleware must not run on /api/* routes${RESET}"
  sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
fi
echo ""

echo -e "${BOLD}── 7.2  GET /v1/models with exhausted RPM_KEY — must not return 429${RESET}"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer $RPM_KEY" "$BASE_URL/v1/models")
echo -e "  ${DIM}actual: $STATUS_CODE${RESET}"
if [[ "$STATUS_CODE" != "429" ]]; then
  echo -e "  ${GREEN}✅ PASS — got $STATUS_CODE${RESET}"
  sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
else
  echo -e "  ${RED}❌ FAIL — 429 on /v1/models, quota middleware scope is too broad${RESET}"
  sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
fi
echo ""

# ============================================================================
# SECTION 8 — Auth Boundary
# Quota middleware runs AFTER TokenAuth. Unauthenticated requests must be
# rejected at the auth layer (401) — quota 429 must never appear.
# ============================================================================
section "SECTION 8 — Auth Boundary: unauthenticated requests get 401, not 429"
echo -e "${DIM}  Quota runs after TokenAuth. No valid token = auth fails before quota.${RESET}"
echo ""

echo -e "${BOLD}── 8.1  No Authorization header → must not be 200 or 429${RESET}"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST -H "Content-Type: application/json" \
  -d "$BODY" "$BASE_URL/v1/chat/completions")
echo -e "  ${DIM}actual: $STATUS_CODE${RESET}"
if [[ "$STATUS_CODE" == "401" ]]; then
  echo -e "  ${GREEN}✅ PASS — 401 (auth rejected before quota)${RESET}"
  sec_p["$cur_sec"]=$(( ${sec_p[$cur_sec]:-0} + 1 )); pass=$(( pass + 1 ))
else
  echo -e "  ${RED}❌ FAIL — expected 401, got $STATUS_CODE${RESET}"
  sec_f["$cur_sec"]=$(( ${sec_f[$cur_sec]:-0} + 1 )); fail=$(( fail + 1 ))
fi
echo ""

run_test "8.2  Invalid Bearer token → 401 (auth fails, quota never runs)" \
  "401" "sk-totally-invalid-garbage-key-99999" "/v1/chat/completions" "$BODY"

assert_body_absent \
  "8.3  Invalid-auth response body must NOT mention 'tenant_quota_exceeded'" \
  "tenant_quota_exceeded" \
  "sk-totally-invalid-garbage-key-99999" "/v1/chat/completions" "$BODY"

# ============================================================================
# SECTION 9 — RPM Window Expiry [SLOW — skipped if SKIP_SLOW=1]
# After 62 seconds, the sliding window resets and RPM_KEY should be allowed again.
# ============================================================================
section "SECTION 9 — RPM Window Expiry (SLOW: 62-second wait)"

if [[ "$SKIP_SLOW" == "1" ]]; then
  echo -e "${YELLOW}  ⏩ Skipped (SKIP_SLOW=1). Run without SKIP_SLOW to verify window expiry.${RESET}"
  echo ""
else
  echo -e "${DIM}  RPM_KEY is exhausted (blocked). Waiting 62 seconds for the 60s window to expire...${RESET}"
  echo ""

  for i in $(seq 62 -1 1); do
    printf "\r  ${DIM}waiting: %ds${RESET}  " "$i"
    sleep 1
  done
  echo ""
  echo ""

  assert_allowed "9.1  RPM_KEY after 62-second wait — window expired, middleware must allow" \
    "$RPM_KEY" "/v1/chat/completions" "$BODY"

  assert_allowed "9.2  RPM_KEY second request in new window — still allowed" \
    "$RPM_KEY" "/v1/chat/completions" "$BODY"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║                        SUMMARY                          ║${RESET}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════╣${RESET}"

all_sections=(
  "SECTION 1 — RPM Enforcement: rpm_limit=5 → first 5 pass, 6th blocked"
  "SECTION 2 — TPM Enforcement: tpm_limit=20 → first request passes, second blocked"
  "SECTION 3 — Monthly Enforcement: monthly_limit=3 → first 3 pass, 4th blocked"
  "SECTION 4 — Unlimited Token: all limits=0, 10 requests never 429"
  "SECTION 5 — Error Response Schema: 429 body must have correct fields"
  "SECTION 6 — Token Isolation: exhausted token does not affect other tokens"
  "SECTION 7 — Non-relay Routes: quota middleware not on admin API"
  "SECTION 8 — Auth Boundary: unauthenticated requests get 401, not 429"
  "SECTION 9 — RPM Window Expiry (SLOW: 62-second wait)"
)

for s in "${all_sections[@]}"; do
  p=${sec_p["$s"]:-0}; f=${sec_f["$s"]:-0}
  if [[ "$f" -gt 0 ]]; then
    printf "${BOLD}║  %-52s ${RED}FAIL${RESET}${BOLD} %-2s/%-2s ║${RESET}\n" "${s:0:52}" "$p" "$((p+f))"
  else
    printf "${BOLD}║  %-52s ${GREEN}PASS${RESET}${BOLD} %-2s/%-2s ║${RESET}\n" "${s:0:52}" "$p" "$((p+f))"
  fi
done

echo -e "${BOLD}╠══════════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}║  Total : $((pass + fail))   Passed : ${GREEN}$pass${RESET}${BOLD}   Failed : ${RED}$fail${RESET}${BOLD}                   ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

if [[ "$fail" -gt 0 ]]; then
  echo -e "${RED}Some tests FAILED.${RESET}"
  echo -e "${DIM}  If §1/§2/§3 fail: verify the token limits are configured correctly in admin UI.${RESET}"
  echo -e "${DIM}  If §1 passes but the 6th is 200 (not 429): TenantQuotaCheck may not be wired.${RESET}"
  echo -e "${DIM}  Rebuild: docker compose -f docker-compose.dev.yml up -d --build new-api${RESET}"
  exit 1
else
  echo -e "${GREEN}All DR-13 tests passed. ✅ Safe to merge.${RESET}"
fi
