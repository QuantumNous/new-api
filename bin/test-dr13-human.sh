#!/usr/bin/env bash
# =============================================================================
# bin/test-dr13-human.sh — DR-13 Human-in-the-Loop Comprehensive Test
#
# Covers boundary cases, combined limits, error quality, burst, and isolation.
# Human reviewer observes each result and validates behaviour is correct.
#
# Keys (set all 7 before running):
#   RPM_KEY      rpm_limit=5   tpm_limit=0  monthly_limit=0
#   TPM_KEY      rpm_limit=0   tpm_limit=20 monthly_limit=0
#   MONTHLY_KEY  rpm_limit=0   tpm_limit=0  monthly_limit=3   (fresh)
#   ROOT_KEY     rpm_limit=0   tpm_limit=0  monthly_limit=0   (unlimited)
#   RPM1_KEY     rpm_limit=1   tpm_limit=0  monthly_limit=0
#   MONTHLY1_KEY rpm_limit=0   tpm_limit=0  monthly_limit=1   (fresh, ONE-TIME)
#   COMBO_KEY    rpm_limit=3   tpm_limit=0  monthly_limit=10  (fresh)
#
# Usage:
#   RPM_KEY=sk-... TPM_KEY=sk-... MONTHLY_KEY=sk-... ROOT_KEY=sk-... \
#   RPM1_KEY=sk-... MONTHLY1_KEY=sk-... COMBO_KEY=sk-... \
#   bash bin/test-dr13-human.sh
# =============================================================================
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RPM_KEY="${RPM_KEY:-}"
TPM_KEY="${TPM_KEY:-}"
MONTHLY_KEY="${MONTHLY_KEY:-}"
ROOT_KEY="${ROOT_KEY:-}"
RPM1_KEY="${RPM1_KEY:-}"
MONTHLY1_KEY="${MONTHLY1_KEY:-}"
COMBO_KEY="${COMBO_KEY:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
MAGENTA='\033[0;35m'
SEP='══════════════════════════════════════════════════════════'

PASS=0; FAIL=0

# ── helpers ──────────────────────────────────────────────────────────────────

section() {
  echo ""
  echo -e "${BOLD}${CYAN}${SEP}${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BOLD}${CYAN}${SEP}${RESET}"
  echo ""
}

sub() { echo -e "${BOLD}── $1${RESET}"; }
info() { echo -e "${DIM}  ℹ  $1${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${RESET}"; }

human() {
  echo ""
  echo -e "${MAGENTA}${BOLD}  👁  HUMAN CHECK — $1${RESET}"
  echo -e "${MAGENTA}     Expected: $2${RESET}"
  echo ""
}

pause() {
  echo -e "${YELLOW}  ▶  Press Enter to continue...${RESET}"
  read -r
}

# Returns: sets global LAST_STATUS and LAST_BODY
do_req() {
  local key="$1" body="$2"
  local raw
  raw=$(curl -s -w '\n%{http_code}' \
    -X POST "${BASE_URL}/v1/chat/completions" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d "${body}" 2>/dev/null)
  LAST_STATUS=$(echo "$raw" | tail -1)
  LAST_BODY=$(echo "$raw" | head -1)
}

assert_allowed() {
  local label="$1"
  # 401 = token invalid (auth failed before quota) — this is a test setup error, not a pass
  if [[ "$LAST_STATUS" == "401" ]] || echo "$LAST_BODY" | grep -qF "Invalid token"; then
    echo -e "  ${RED}❌ FAIL${RESET} — ${label}: token returned 401 (INVALID/DELETED TOKEN — recreate it)"
    echo -e "${RED}     status=${LAST_STATUS}  ${LAST_BODY:0:200}${RESET}"
    ((FAIL++))
  elif [[ "$LAST_STATUS" == "429" ]] && echo "$LAST_BODY" | grep -qF "tenant_quota_exceeded"; then
    echo -e "  ${RED}❌ FAIL${RESET} — ${label}: middleware blocked when it should ALLOW"
    echo -e "${RED}     status=${LAST_STATUS}  ${LAST_BODY:0:200}${RESET}"
    ((FAIL++))
  else
    echo -e "  ${GREEN}✅ PASS${RESET} — ${label}"
    echo -e "${DIM}     status=${LAST_STATUS}  ${LAST_BODY:0:140}${RESET}"
    ((PASS++))
  fi
}

assert_blocked() {
  local label="$1" want_str="${2:-tenant_quota_exceeded}"
  if [[ "$LAST_STATUS" == "429" ]] && echo "$LAST_BODY" | grep -qF "$want_str"; then
    echo -e "  ${GREEN}✅ PASS${RESET} — ${label}"
    echo -e "${DIM}     status=429  ${LAST_BODY:0:180}${RESET}"
    ((PASS++))
  else
    echo -e "  ${RED}❌ FAIL${RESET} — ${label}: expected 429+'${want_str}'"
    echo -e "${RED}     got status=${LAST_STATUS}  ${LAST_BODY:0:200}${RESET}"
    ((FAIL++))
  fi
}

assert_body_contains() {
  local label="$1" needle="$2"
  if echo "$LAST_BODY" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✅ PASS${RESET} — ${label}: body contains '${needle}'"
    ((PASS++))
  else
    echo -e "  ${RED}❌ FAIL${RESET} — ${label}: body does NOT contain '${needle}'"
    echo -e "${RED}     body: ${LAST_BODY:0:200}${RESET}"
    ((FAIL++))
  fi
}

assert_body_not_contains() {
  local label="$1" needle="$2"
  if ! echo "$LAST_BODY" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✅ PASS${RESET} — ${label}: body correctly omits '${needle}'"
    ((PASS++))
  else
    echo -e "  ${RED}❌ FAIL${RESET} — ${label}: body CONTAINS '${needle}' but should not"
    echo -e "${RED}     body: ${LAST_BODY:0:200}${RESET}"
    ((FAIL++))
  fi
}

BODY='{"model":"llama-3.1-8b-instant","max_tokens":1,"messages":[{"role":"user","content":"What is 1+1?"}]}'

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔${SEP}╗${RESET}"
echo -e "${BOLD}║    DR-13 Human-in-the-Loop Comprehensive Test Suite        ║${RESET}"
echo -e "${BOLD}╚${SEP}╝${RESET}"
echo ""
echo -e "${DIM}  BASE_URL : ${BASE_URL}${RESET}"
echo -e "${DIM}  Keys loaded: $([ -n "$RPM_KEY" ] && echo RPM ✓ || echo 'RPM ✗') $([ -n "$TPM_KEY" ] && echo TPM ✓ || echo 'TPM ✗') $([ -n "$MONTHLY_KEY" ] && echo MONTHLY ✓ || echo 'MONTHLY ✗') $([ -n "$ROOT_KEY" ] && echo ROOT ✓ || echo 'ROOT ✗') $([ -n "$RPM1_KEY" ] && echo RPM1 ✓ || echo 'RPM1 ✗') $([ -n "$MONTHLY1_KEY" ] && echo M1 ✓ || echo 'M1 ✗') $([ -n "$COMBO_KEY" ] && echo COMBO ✓ || echo 'COMBO ✗')${RESET}"

# Pre-flight: verify all tokens are valid (not deleted/expired)
echo ""
echo -e "${BOLD}  Pre-flight: checking all 7 tokens are valid...${RESET}"
PREFLIGHT_OK=1
for VAR_NAME in RPM_KEY TPM_KEY MONTHLY_KEY ROOT_KEY RPM1_KEY MONTHLY1_KEY COMBO_KEY; do
  KEY="${!VAR_NAME}"
  RAW=$(curl -s -w '\n%{http_code}' -X GET "${BASE_URL}/v1/models" \
    -H "Authorization: Bearer ${KEY}" 2>/dev/null)
  ST=$(echo "$RAW" | tail -1)
  BD=$(echo "$RAW" | head -1)
  if echo "$BD" | grep -qF "Invalid token"; then
    echo -e "  ${RED}❌ ${VAR_NAME}: token is INVALID/DELETED — recreate it in Admin UI before running${RESET}"
    PREFLIGHT_OK=0
  else
    echo -e "  ${GREEN}✅ ${VAR_NAME}: valid (${ST})${RESET}"
  fi
done
if [[ "$PREFLIGHT_OK" -eq 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD}  ⛔ Some tokens are invalid. Recreate them in Admin UI and re-run.${RESET}"
  exit 1
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
section "§A — Admin UI Verification (Human Eyes Only)"
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${MAGENTA}${BOLD}  Open http://localhost:17231 and verify these 4 things:${RESET}"
echo ""
echo -e "${BOLD}  A1. Advanced mode create — quota fields visible${RESET}"
echo "      Click 'Add API Key' → pick Advanced → scroll to Quota Settings section"
echo "      ✓ Three fields: RPM Limit / TPM Limit / Monthly Limit"
echo "      ✓ Each defaults to 0, with hint text '0 = ∞'"
echo ""
echo -e "${BOLD}  A2. Save persists values${RESET}"
echo "      Create a NEW throwaway token (e.g. 'test-ui-temp'), set RPM=99 / TPM=999 / Monthly=9999, save, re-open"
echo "      ✓ Fields still show 99 / 999 / 9999 (not reset to 0)"
echo -e "      ${YELLOW}⚠️  DO NOT edit or delete any of the 7 test tokens during §A — it will break later sections${RESET}"
echo ""
echo -e "${BOLD}  A3. Save button works in Advanced create mode${RESET}"
echo "      Open 'Add API Key' → Advanced, fill only the Name field, click Save"
echo "      ✓ Token is created successfully (no silent failure)"
echo ""
echo -e "${BOLD}  A4. Simple mode hides quota fields${RESET}"
echo "      Open 'Add API Key' → Simple mode"
echo "      ✓ RPM / TPM / Monthly fields are NOT visible"
echo ""
pause

# ─────────────────────────────────────────────────────────────────────────────
section "§B — Minimum RPM Boundary: rpm_limit=1"
# ─────────────────────────────────────────────────────────────────────────────
info "RPM1_KEY has rpm_limit=1. First request passes, second is immediately blocked."
warn "Window = 60 s. RPM1_KEY will be blocked for the rest of this minute."
echo ""

sub "B1. Request #1 — must be ALLOWED"
do_req "$RPM1_KEY" "$BODY"
assert_allowed "rpm_limit=1 first request"

sub "B2. Request #2 — must be BLOCKED (same window)"
do_req "$RPM1_KEY" "$BODY"
assert_blocked "rpm_limit=1 second request" "tenant_quota_exceeded"
assert_body_contains "error code is tenant_quota_exceeded" "tenant_quota_exceeded"
assert_body_contains "error mentions rpm" "rpm"

sub "B3. Request #3 — still blocked"
do_req "$RPM1_KEY" "$BODY"
assert_blocked "rpm_limit=1 third request — window still open" "rpm"

human "RPM=1 boundary" "Req 1 passes, req 2 & 3 blocked with rpm error"

# ─────────────────────────────────────────────────────────────────────────────
section "§C — Minimum Monthly Boundary: monthly_limit=1"
# ─────────────────────────────────────────────────────────────────────────────
info "MONTHLY1_KEY has monthly_limit=1."
warn "⚠️  Monthly counter is PERMANENT — after this section, MONTHLY1_KEY is exhausted for the month."
echo ""

sub "C1. Request #1 — must be ALLOWED"
do_req "$MONTHLY1_KEY" "$BODY"
assert_allowed "monthly_limit=1 first request"

sub "C2. Request #2 — monthly quota hit → BLOCKED"
do_req "$MONTHLY1_KEY" "$BODY"
assert_blocked "monthly_limit=1 second request" "monthly"
assert_body_contains "error mentions monthly" "monthly"

sub "C3. Request #3 — still blocked"
do_req "$MONTHLY1_KEY" "$BODY"
assert_blocked "monthly_limit=1 third request" "tenant_quota_exceeded"

human "Monthly=1 boundary" "Req 1 passes; all subsequent blocked with 'monthly' in error"

# ─────────────────────────────────────────────────────────────────────────────
section "§D — Combined Limits: rpm_limit=3, monthly_limit=10"
# ─────────────────────────────────────────────────────────────────────────────
info "COMBO_KEY has rpm_limit=3 AND monthly_limit=10."
info "RPM hits first within a minute. Monthly decrements for each PASS."
warn "3 monthly requests consumed. COMBO_KEY monthly will have 7 remaining."
echo ""

sub "D1. Request #1 — passes (rpm 1/3, monthly 1/10)"
do_req "$COMBO_KEY" "$BODY"
assert_allowed "COMBO req #1"

sub "D2. Request #2 — passes (rpm 2/3, monthly 2/10)"
do_req "$COMBO_KEY" "$BODY"
assert_allowed "COMBO req #2"

sub "D3. Request #3 — passes (rpm 3/3, monthly 3/10)"
do_req "$COMBO_KEY" "$BODY"
assert_allowed "COMBO req #3"

sub "D4. Request #4 — RPM exhausted → blocked"
do_req "$COMBO_KEY" "$BODY"
assert_blocked "COMBO req #4 (rpm exhausted)" "tenant_quota_exceeded"

sub "D5. Error says 'rpm' not 'monthly' (monthly still has 7 left)"
assert_body_contains "error indicates rpm limit" "rpm"
assert_body_not_contains "error must NOT say monthly (not the monthly limit)" "monthly"

human "Combined RPM+Monthly" "RPM blocks after 3; error correctly says 'rpm' not 'monthly'"

# ─────────────────────────────────────────────────────────────────────────────
section "§E — Error Message Quality (Human Reads All Three)"
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${MAGENTA}${BOLD}  Read the three 429 bodies below. Each should clearly name the violated limit.${RESET}"
echo ""

sub "E1. RPM 429 message:"
do_req "$RPM_KEY" "$BODY"
echo -e "${CYAN}  ${LAST_BODY}${RESET}"
echo ""

sub "E2. Monthly 429 message (MONTHLY1_KEY is exhausted):"
do_req "$MONTHLY1_KEY" "$BODY"
echo -e "${CYAN}  ${LAST_BODY}${RESET}"
echo ""

sub "E3. TPM 429 message:"
# Use a large body to exhaust tpm_limit=20
LARGE='{"model":"llama-3.1-8b-instant","max_tokens":1,"messages":[{"role":"user","content":"Explain the entire history of artificial intelligence from the 1950s through to the present day in as much detail as possible including key researchers milestones and breakthroughs."}]}'
do_req "$TPM_KEY" "$LARGE"
if [[ "$LAST_STATUS" == "429" ]]; then
  echo -e "${CYAN}  ${LAST_BODY}${RESET}"
else
  info "TPM_KEY allowed large body (counter may have reset). Doing a second request to push over:"
  do_req "$TPM_KEY" "$LARGE"
  echo -e "${CYAN}  ${LAST_BODY}${RESET}"
fi
echo ""

human "Error message quality" \
  "Each message clearly states WHICH limit (rpm/tpm/monthly), the limit value, and the unit"
pause

# ─────────────────────────────────────────────────────────────────────────────
section "§F — Unlimited Token: 20-Request Burst (ROOT_KEY)"
# ─────────────────────────────────────────────────────────────────────────────
info "ROOT_KEY has all limits=0. Fire 20 requests rapidly — zero should be 429."
echo ""

BURST_PASS=0; BURST_FAIL=0
for i in $(seq 1 20); do
  do_req "$ROOT_KEY" "$BODY"
  if [[ "$LAST_STATUS" != "429" ]] && ! echo "$LAST_BODY" | grep -qF "tenant_quota_exceeded"; then
    echo -e "  ${GREEN}✅${RESET} Burst #${i} → ${LAST_STATUS}"
    ((BURST_PASS++))
  else
    echo -e "  ${RED}❌${RESET} Burst #${i} → BLOCKED (${LAST_STATUS})"
    ((BURST_FAIL++))
  fi
done

echo ""
if (( BURST_FAIL == 0 )); then
  echo -e "  ${GREEN}✅ All 20 burst requests allowed — unlimited token never throttled${RESET}"
  ((PASS += 20))
else
  echo -e "  ${RED}❌ ${BURST_FAIL}/20 requests were throttled — unlimited token should not be throttled${RESET}"
  ((FAIL += BURST_FAIL))
  ((PASS += BURST_PASS))
fi

human "Unlimited burst" "All 20 requests → 200; no 429 at any point"

echo ""
warn "§F sent 20 requests — waiting 65 s for Groq upstream RPM window to reset before §G/§J..."
echo -n "  "
for i in $(seq 1 65); do sleep 1; echo -n "."; done
echo ""

# ─────────────────────────────────────────────────────────────────────────────
section "§G — Isolation Under Load: Exhausted vs Unlimited Interleaved"
# ─────────────────────────────────────────────────────────────────────────────
info "Alternate between RPM1_KEY (blocked) and ROOT_KEY (unlimited)."
info "ROOT_KEY must stay unaffected by RPM1_KEY being exhausted."
echo ""

# Warm-up: the 65s sleep in §F may have reset the RPM1_KEY window.
# Re-exhaust it before the isolation loop so we test the blocked state.
info "Warm-up: re-exhausting RPM1_KEY (rpm_limit=1) before isolation loop..."
do_req "$RPM1_KEY" "$BODY"
if [[ "$LAST_STATUS" == "200" ]]; then
  echo -e "  ${DIM}  Warm-up #1 → 200 (window was reset by §F sleep — now exhausted)${RESET}"
  do_req "$RPM1_KEY" "$BODY"
  echo -e "  ${DIM}  Warm-up #2 → ${LAST_STATUS} (RPM1_KEY now blocked)${RESET}"
else
  echo -e "  ${DIM}  Warm-up → ${LAST_STATUS} (RPM1_KEY already blocked)${RESET}"
fi
echo ""

for i in 1 2 3 4 5; do
  do_req "$RPM1_KEY" "$BODY"
  if [[ "$LAST_STATUS" == "429" ]]; then
    echo -e "  ${GREEN}✅${RESET} Round ${i} — RPM1_KEY → 429 (expected blocked)"
    ((PASS++))
  else
    echo -e "  ${RED}❌${RESET} Round ${i} — RPM1_KEY → ${LAST_STATUS} (should be 429)"
    ((FAIL++))
  fi

  do_req "$ROOT_KEY" "$BODY"
  if [[ "$LAST_STATUS" != "429" ]] && ! echo "$LAST_BODY" | grep -qF "tenant_quota_exceeded"; then
    echo -e "  ${GREEN}✅${RESET} Round ${i} — ROOT_KEY → ${LAST_STATUS} (expected allowed)"
    ((PASS++))
  else
    echo -e "  ${RED}❌${RESET} Round ${i} — ROOT_KEY → ${LAST_STATUS} (should be allowed)"
    ((FAIL++))
  fi
done

human "Token isolation under load" "RPM1_KEY always 429; ROOT_KEY always passes in same loop"

# ─────────────────────────────────────────────────────────────────────────────
section "§H — Auth Runs Before Quota (Invalid Token → 401 not 429)"
# ─────────────────────────────────────────────────────────────────────────────
info "TenantQuotaCheck is after TokenAuth. Bad token must fail at auth, not quota."
echo ""

sub "H1. No Authorization header → 401"
H_RAW=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/v1/chat/completions" \
  -H "Content-Type: application/json" -d "$BODY" 2>/dev/null)
LAST_STATUS=$(echo "$H_RAW" | tail -1); LAST_BODY=$(echo "$H_RAW" | head -1)
if [[ "$LAST_STATUS" == "401" ]]; then
  echo -e "  ${GREEN}✅ PASS${RESET} — no auth → 401"; ((PASS++))
else
  echo -e "  ${RED}❌ FAIL${RESET} — expected 401, got ${LAST_STATUS}"; ((FAIL++))
fi

sub "H2. Garbage Bearer token → 401"
do_req "sk-thisisnotavalidtoken12345" "$BODY"
if [[ "$LAST_STATUS" == "401" ]]; then
  echo -e "  ${GREEN}✅ PASS${RESET} — invalid token → 401"; ((PASS++))
else
  echo -e "  ${RED}❌ FAIL${RESET} — expected 401, got ${LAST_STATUS}"; ((FAIL++))
fi

sub "H3. Invalid auth body must not mention tenant_quota_exceeded"
assert_body_not_contains "401 body has no quota error" "tenant_quota_exceeded"

human "Auth before quota" "Bad token → 401 (auth layer); quota error never leaks into auth failures"

# ─────────────────────────────────────────────────────────────────────────────
section "§I — Non-Relay Admin Routes Bypass Quota"
# ─────────────────────────────────────────────────────────────────────────────
info "Quota middleware only runs on relay routes (/v1/chat/completions etc)."
info "Admin endpoints like /api/status must not be affected even with an exhausted token."
echo ""

sub "I1. GET /api/status with exhausted RPM_KEY → must NOT be 429"
ADMIN_RAW=$(curl -s -w '\n%{http_code}' -X GET "${BASE_URL}/api/status" \
  -H "Authorization: Bearer ${RPM_KEY}" 2>/dev/null)
LAST_STATUS=$(echo "$ADMIN_RAW" | tail -1); LAST_BODY=$(echo "$ADMIN_RAW" | head -1)
if [[ "$LAST_STATUS" != "429" ]]; then
  echo -e "  ${GREEN}✅ PASS${RESET} — /api/status → ${LAST_STATUS} (quota not applied)"; ((PASS++))
else
  echo -e "  ${RED}❌ FAIL${RESET} — /api/status returned 429 (quota should not apply here)"; ((FAIL++))
fi

sub "I2. GET /v1/models with exhausted RPM_KEY → must NOT be 429"
MODELS_RAW=$(curl -s -w '\n%{http_code}' -X GET "${BASE_URL}/v1/models" \
  -H "Authorization: Bearer ${RPM_KEY}" 2>/dev/null)
LAST_STATUS=$(echo "$MODELS_RAW" | tail -1)
if [[ "$LAST_STATUS" != "429" ]]; then
  echo -e "  ${GREEN}✅ PASS${RESET} — /v1/models → ${LAST_STATUS}"; ((PASS++))
else
  echo -e "  ${RED}❌ FAIL${RESET} — /v1/models returned 429"; ((FAIL++))
fi

human "Non-relay routes" "/api/status and /v1/models bypass quota even for exhausted tokens"

# ─────────────────────────────────────────────────────────────────────────────
section "§J — Monthly Counter Persists Across Multiple Requests"
# ─────────────────────────────────────────────────────────────────────────────
info "MONTHLY_KEY has monthly_limit=3 (fresh). Run 3 requests — all pass."
info "4th request must be blocked. Counter accumulates, not resetting between requests."
echo ""

for i in 1 2 3; do
  sub "J${i}. MONTHLY_KEY request #${i} — must pass"
  do_req "$MONTHLY_KEY" "$BODY"
  assert_allowed "monthly req #${i} of 3"
done

sub "J4. MONTHLY_KEY request #4 — monthly limit hit → BLOCKED"
do_req "$MONTHLY_KEY" "$BODY"
assert_blocked "monthly req #4 blocked" "monthly"

sub "J5. Still blocked on #5"
do_req "$MONTHLY_KEY" "$BODY"
assert_blocked "monthly req #5 still blocked" "tenant_quota_exceeded"

human "Monthly persistence" "Counter accumulates correctly: 3 pass then permanent block"

# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔${SEP}╗${RESET}"
echo -e "${BOLD}║                    FINAL SUMMARY                          ║${RESET}"
echo -e "${BOLD}╠${SEP}╣${RESET}"
printf "${BOLD}║  Total : %-4s  Passed : ${GREEN}%-4s${RESET}${BOLD}  Failed : ${RED}%-4s${RESET}${BOLD}              ║\n${RESET}" \
  "$((PASS + FAIL))" "$PASS" "$FAIL"
echo -e "${BOLD}╚${SEP}╝${RESET}"
echo ""

if (( FAIL == 0 )); then
  echo -e "${GREEN}${BOLD}  ✅ All automated checks passed.${RESET}"
  echo -e "${GREEN}     Review the §A UI checklist and all HUMAN CHECK notes above.${RESET}"
  echo -e "${GREEN}     If those look good → DR-13 is ready for PR.${RESET}"
else
  echo -e "${RED}${BOLD}  ❌ ${FAIL} automated check(s) failed. Fix before raising PR.${RESET}"
fi
echo ""
