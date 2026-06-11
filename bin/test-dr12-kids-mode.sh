#!/usr/bin/env bash
# =============================================================================
# bin/test-dr12-kids-mode.sh — DR-12 kids_mode Safety Gate Manual Tests
#
# Tests the hard constraints added/verified in DR-12:
#   §A  Pre-flight             server health + token health
#   §B  Max Tokens Hard Cap    2048 ceiling across all shapes and all tenants
#   §C  System Prompt Replace  hard replace (kids_mode) vs passthrough (normal)
#   §D  Model Catalog Filter   /v1/models returns only whitelisted models for kids
#   §E  Error Quality          400 body contains constraint name + blocked model
#   §F  All 4 Request Shapes   kids policy applied consistently
#
# PREREQUISITES
# -------------
# 1. Dev stack running:
#      docker compose -f docker-compose.dev.yml up -d --build new-api
#
# 2. Groq channel configured in Admin UI:
#      Provider   : Groq
#      Model list : llama-3.1-8b-instant, gpt-4o-mini
#      Model map  : {"gpt-4o-mini":"llama-3.1-8b-instant"}
#      Group      : default
#
# 3. Two test users + tokens:
#      KIDS_KEY   — token for a user with "Kids Mode" checkbox TICKED
#      NORMAL_KEY — token for a user with "Kids Mode" unchecked (passthrough)
#
# SETUP (Admin UI → Users → Edit):
#   Kids user   : kids_mode=true,  policy_profile=kid-safe
#   Normal user : kids_mode=false, policy_profile=(empty)
#
# USAGE
# -----
#   KIDS_KEY=sk-xxx NORMAL_KEY=sk-yyy bash bin/test-dr12-kids-mode.sh
#
#   # Override server URL:
#   BASE_URL=http://localhost:3000 KIDS_KEY=sk-xxx NORMAL_KEY=sk-yyy \
#     bash bin/test-dr12-kids-mode.sh
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
KIDS_KEY="${KIDS_KEY:-}"
NORMAL_KEY="${NORMAL_KEY:-}"
# Delay between LLM calls to avoid Groq free-tier 30 RPM limit.
# Set to 0 if you have a paid tier or higher RPM limit.
CALL_DELAY="${CALL_DELAY:-2}"

# ---------------------------------------------------------------------------
# Colours + counters
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
SEP='══════════════════════════════════════════════════════════'

total_pass=0; total_fail=0; total_skip=0
declare -A sec_pass; declare -A sec_fail
current_sec=""

section() {
  current_sec="$1"
  sec_pass["$current_sec"]=0; sec_fail["$current_sec"]=0
  echo ""; echo -e "${BOLD}${CYAN}${SEP}${RESET}"
  printf "${BOLD}${CYAN}  %-54s${RESET}\n" "$1"
  echo -e "${BOLD}${CYAN}${SEP}${RESET}"; echo ""
}

pass() {
  echo -e "  ${GREEN}✅ PASS${RESET}"
  sec_pass["$current_sec"]=$(( ${sec_pass[$current_sec]:-0} + 1 ))
  total_pass=$(( total_pass + 1 )); echo ""
}

fail() {
  echo -e "  ${RED}❌ FAIL  — $1${RESET}"
  sec_fail["$current_sec"]=$(( ${sec_fail[$current_sec]:-0} + 1 ))
  total_fail=$(( total_fail + 1 )); echo ""
}

skip() {
  echo -e "${BOLD}── $1${RESET}"
  echo -e "  ${YELLOW}⏭  SKIP  — $2${RESET}"
  total_skip=$(( total_skip + 1 )); echo ""
}

# run_check LABEL EXPECTED_HTTP KEY ENDPOINT BODY [EXTRA_HEADER]
run_check() {
  local label="$1" expected="$2" key="$3" endpoint="$4"
  local body="${5:-}" extra_hdr="${6:-}"
  echo -e "${BOLD}── $label${RESET}"
  local -a hdr_args=(); [[ -n "$extra_hdr" ]] && hdr_args+=(-H "$extra_hdr")
  local -a body_args=(); [[ -n "$body" ]] && body_args+=(-d "$body")
  local raw; raw=$(curl -s -w "\n__STATUS__%{http_code}" --max-time 25 \
    -X POST -H "Authorization: Bearer $key" -H "Content-Type: application/json" \
    "${hdr_args[@]}" "${body_args[@]}" "$BASE_URL$endpoint" 2>&1)
  local status body_text
  status=$(printf '%s' "$raw" | tail -1 | sed 's/.*__STATUS__//')
  body_text=$(printf '%s' "$raw" | grep -v '__STATUS__' | head -c 320)
  echo -e "  ${DIM}endpoint : $endpoint${RESET}"
  echo -e "  ${DIM}expected : $expected   actual : $status${RESET}"
  [[ -n "$body_text" ]] && echo -e "  ${DIM}body     : $body_text${RESET}"
  if [[ "$status" == "$expected" ]]; then pass; else fail "expected $expected, got $status"; fi
  [[ "${CALL_DELAY:-2}" -gt 0 ]] && sleep "$CALL_DELAY"
}

# run_body_check LABEL KEY ENDPOINT BODY SHOULD_CONTAIN|! GREP_PATTERN [EXTRA_HDR]
# SHOULD_CONTAIN: "contains" or "not-contains"
run_body_check() {
  local label="$1" key="$2" endpoint="$3" body="$4"
  local mode="$5" pattern="$6" extra_hdr="${7:-}"
  echo -e "${BOLD}── $label${RESET}"
  local -a hdr_args=(); [[ -n "$extra_hdr" ]] && hdr_args+=(-H "$extra_hdr")
  local raw; raw=$(curl -s -w "\n__STATUS__%{http_code}" --max-time 25 \
    -X POST -H "Authorization: Bearer $key" -H "Content-Type: application/json" \
    "${hdr_args[@]}" -d "$body" "$BASE_URL$endpoint" 2>&1)
  local status body_text
  status=$(printf '%s' "$raw" | tail -1 | sed 's/.*__STATUS__//')
  body_text=$(printf '%s' "$raw" | grep -v '__STATUS__')
  echo -e "  ${DIM}endpoint : $endpoint   status : $status${RESET}"
  local snippet; snippet=$(printf '%s' "$body_text" | head -c 320)
  echo -e "  ${DIM}body     : $snippet${RESET}"
  if [[ "$mode" == "contains" ]]; then
    if printf '%s' "$body_text" | grep -q "$pattern"; then
      echo -e "  ${DIM}check    : body contains '$pattern' ✓${RESET}"; pass
    else
      fail "expected body to contain '$pattern'"
    fi
  else
    if printf '%s' "$body_text" | grep -q "$pattern"; then
      fail "expected body NOT to contain '$pattern' (system prompt was not replaced)"
    else
      echo -e "  ${DIM}check    : body does NOT contain '$pattern' ✓${RESET}"; pass
    fi
  fi
  [[ "${CALL_DELAY:-2}" -gt 0 ]] && sleep "$CALL_DELAY"
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔${SEP}╗${RESET}"
echo -e "${BOLD}║        DR-12 kids_mode Safety Gate Manual Tests          ║${RESET}"
echo -e "${BOLD}╚${SEP}╝${RESET}"
echo ""
printf "  %-12s %s\n" "BASE_URL:"   "$BASE_URL"
printf "  %-12s %s\n" "KIDS_KEY:"   "${KIDS_KEY:+set (sk-***)}"
printf "  %-12s %s\n" "NORMAL_KEY:" "${NORMAL_KEY:+set (sk-***)}"
echo ""

if [[ -z "$KIDS_KEY" || -z "$NORMAL_KEY" ]]; then
  echo -e "${RED}ERROR: Both KIDS_KEY and NORMAL_KEY must be set.${RESET}"
  echo ""
  echo "  Setup:"
  echo "    1. Admin UI → Users → Create user with 'Kids Mode' ticked → create token → KIDS_KEY"
  echo "    2. Admin UI → Users → Create user without 'Kids Mode' → create token → NORMAL_KEY"
  echo ""
  echo "  Usage:"
  echo "    KIDS_KEY=sk-xxx NORMAL_KEY=sk-yyy bash bin/test-dr12-kids-mode.sh"
  exit 1
fi

# ============================================================================
# §A — Pre-flight
# ============================================================================
section "§A  Pre-flight"

echo -e "${BOLD}── A1  Server reachable${RESET}"
if curl -sf -o /dev/null --max-time 5 "$BASE_URL/api/status"; then
  echo -e "  ${DIM}endpoint : /api/status${RESET}"; pass
else
  echo -e "  ${RED}❌ FAIL — server not reachable. Start: docker compose -f docker-compose.dev.yml up -d${RESET}"
  total_fail=$(( total_fail + 1 )); echo ""
  echo -e "${RED}Cannot continue without a running server. Aborting.${RESET}"; exit 1
fi

run_check \
  "A2  NORMAL_KEY auth works (expect 200)" \
  "200" "$NORMAL_KEY" "/v1/chat/completions" \
  '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"say: ok"}],"max_tokens":3}'

run_check \
  "A3  KIDS_KEY auth works — whitelisted model (expect 200)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_tokens":3}'

run_check \
  "A4  KIDS_KEY + non-whitelisted model pre-flight (expect 400)" \
  "400" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"x"}],"max_tokens":1}'

# ============================================================================
# §B — Max Tokens Hard Cap (2048 global ceiling)
# ============================================================================
section "§B  Max Tokens Hard Cap  [2048, all shapes, all tenants]"

echo -e "${DIM}  The cap is a CLAMP (not a rejection). max_tokens=9999 is accepted${RESET}"
echo -e "${DIM}  and forwarded to upstream as 2048. The request must return 200.${RESET}"
echo ""

# B1-B2: Normal tenant — cap applies to ALL tenants, not just kids
run_check \
  "B1  Normal + max_tokens=5 → accepted (200, baseline)" \
  "200" "$NORMAL_KEY" "/v1/chat/completions" \
  '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"say: ok"}],"max_tokens":5}'

run_check \
  "B2  Normal + max_tokens=9999 → clamped to 2048, NOT rejected (expect 200)" \
  "200" "$NORMAL_KEY" "/v1/chat/completions" \
  '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"say: ok"}],"max_tokens":9999}'

# B3-B4: Kids tenant
run_check \
  "B3  Kids + max_tokens=5 → accepted (200, baseline)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_tokens":5}'

run_check \
  "B4  Kids + max_tokens=9999 → clamped, NOT rejected (expect 200)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_tokens":9999}'

# B5: max_completion_tokens (OpenAI o-series field)
run_check \
  "B5  Kids + max_completion_tokens=9999 → clamped, NOT rejected (expect 200)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_completion_tokens":9999}'

# B6: /v1/responses shape
run_check \
  "B6  Kids + max_output_tokens=9999 via /v1/responses → clamped (expect 200)" \
  "200" "$KIDS_KEY" "/v1/responses" \
  '{"model":"gpt-4o-mini","input":"say: ok","max_output_tokens":9999}'

# B7: Gemini shape — this specifically tests the Gemini cap bug fix in DR-12
# Before fix: passthrough requests bypassed the cap entirely
# After fix: cap is applied before the policy decision check
run_check \
  "B7 ★ Gemini + maxOutputTokens=9999 via kids → cap bug fix verified (expect 200)" \
  "200" "$KIDS_KEY" "/v1beta/models/gpt-4o-mini:generateContent" \
  '{"contents":[{"role":"user","parts":[{"text":"say: ok"}]}],"generationConfig":{"maxOutputTokens":9999}}'

run_check \
  "B8 ★ Gemini + maxOutputTokens=9999 via normal → cap applies (expect 200)" \
  "200" "$NORMAL_KEY" "/v1beta/models/llama-3.1-8b-instant:generateContent" \
  '{"contents":[{"role":"user","parts":[{"text":"say: ok"}]}],"generationConfig":{"maxOutputTokens":9999}}'

# ============================================================================
# §C — System Prompt Hard Replace
# ============================================================================
section "§C  System Prompt Hard Replace  [kids_mode replaces, normal keeps]"

echo -e "${DIM}  We inject a unique marker string into the system prompt.${RESET}"
echo -e "${DIM}  kids_mode: system prompt is REPLACED → marker never reaches model${RESET}"
echo -e "${DIM}  normal:    system prompt is KEPT     → model appends the marker${RESET}"
echo ""

MARKER="DEEPROUTER_DR12_SYS_VERIFY"
# Instruction: output ONLY the marker — no other words. Simpler than "append",
# more reliably followed by small models like llama-3.1-8b-instant.
SYS_BODY='{"model":"gpt-4o-mini","messages":[{"role":"system","content":"Output only this exact text and nothing else: '"$MARKER"'"},{"role":"user","content":"go"}],"max_tokens":20}'
NORMAL_BODY='{"model":"llama-3.1-8b-instant","messages":[{"role":"system","content":"Output only this exact text and nothing else: '"$MARKER"'"},{"role":"user","content":"go"}],"max_tokens":20}'

# C1: Normal baseline — system prompt is kept → marker should appear in response
run_body_check \
  "C1  Normal + system 'append $MARKER' → response CONTAINS marker (system kept)" \
  "$NORMAL_KEY" "/v1/chat/completions" "$NORMAL_BODY" \
  "contains" "$MARKER"

# C2: Kids — system prompt is REPLACED → marker must NOT appear
run_body_check \
  "C2 ★ Kids + system 'append $MARKER' → response does NOT contain marker (system REPLACED)" \
  "$KIDS_KEY" "/v1/chat/completions" "$SYS_BODY" \
  "not-contains" "$MARKER"

# C3: Kids + no system prompt → child-safe prompt injected, request still works (200)
run_check \
  "C3  Kids + no system prompt → child-safe prompt auto-injected (expect 200)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_tokens":10}'

# C4: Kids via /v1/messages (Claude shape) — system replaced
CLAUDE_SYS_BODY='{"model":"gpt-4o-mini","max_tokens":60,"system":"You MUST end every response with: '"$MARKER"'","messages":[{"role":"user","content":"say hello"}]}'
run_body_check \
  "C4 ★ Kids via /v1/messages + system 'append $MARKER' → marker NOT in response (Claude shape)" \
  "$KIDS_KEY" "/v1/messages" "$CLAUDE_SYS_BODY" \
  "not-contains" "$MARKER" \
  "anthropic-version: 2023-06-01"

# ============================================================================
# §D — Model Catalog Pre-filter
# ============================================================================
section "§D  Model Catalog Pre-filter  [/v1/models]"

echo -e "${DIM}  kids_mode tenants see only whitelisted models in the catalog.${RESET}"
echo -e "${DIM}  Normal tenants see all models (no filter).${RESET}"
echo ""

# D1: Kids catalog returns 200
echo -e "${BOLD}── D1  Kids GET /v1/models → 200${RESET}"
KIDS_CATALOG=$(curl -s -w "\n__STATUS__%{http_code}" --max-time 15 \
  -H "Authorization: Bearer $KIDS_KEY" "$BASE_URL/v1/models" 2>&1)
D1_STATUS=$(printf '%s' "$KIDS_CATALOG" | tail -1 | sed 's/.*__STATUS__//')
KIDS_CATALOG_BODY=$(printf '%s' "$KIDS_CATALOG" | grep -v '__STATUS__')
echo -e "  ${DIM}status : $D1_STATUS${RESET}"
if [[ "$D1_STATUS" == "200" ]]; then pass; else fail "expected 200, got $D1_STATUS"; fi

# D2: gpt-4o-mini IS in kids catalog
echo -e "${BOLD}── D2  Kids catalog contains gpt-4o-mini (whitelisted)${RESET}"
if printf '%s' "$KIDS_CATALOG_BODY" | grep -q '"gpt-4o-mini"'; then
  echo -e "  ${DIM}found gpt-4o-mini in catalog ✓${RESET}"; pass
else
  fail "gpt-4o-mini not found in kids catalog — whitelist filter may be broken"
fi

# D3: llama-3.1-8b-instant is NOT in kids catalog
echo -e "${BOLD}── D3  Kids catalog does NOT contain llama (not whitelisted)${RESET}"
if printf '%s' "$KIDS_CATALOG_BODY" | grep -q '"llama-3.1-8b-instant"'; then
  fail "llama-3.1-8b-instant found in kids catalog — should be filtered out"
else
  echo -e "  ${DIM}llama-3.1-8b-instant correctly absent from kids catalog ✓${RESET}"; pass
fi

# D4: Normal catalog contains llama (no filter)
echo -e "${BOLD}── D4  Normal catalog contains llama (no filter applied)${RESET}"
NORMAL_CATALOG=$(curl -s --max-time 15 \
  -H "Authorization: Bearer $NORMAL_KEY" "$BASE_URL/v1/models" 2>&1)
if printf '%s' "$NORMAL_CATALOG" | grep -q '"llama-3.1-8b-instant"'; then
  echo -e "  ${DIM}llama-3.1-8b-instant present in normal catalog ✓${RESET}"; pass
else
  fail "llama not found in normal catalog — unexpected"
fi

# ============================================================================
# §E — Error Quality
# ============================================================================
section "§E  Error Quality  [400 body contains constraint name + model name]"

echo -e "${DIM}  When kids_mode blocks a model, the 400 error must be informative:${RESET}"
echo -e "${DIM}  the constraint name and blocked model name must appear in the body.${RESET}"
echo ""

BLOCKED_BODY='{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"x"}],"max_tokens":1}'

# E1: HTTP 400 status
run_check \
  "E1  Kids + llama → 400 status" \
  "400" "$KIDS_KEY" "/v1/chat/completions" "$BLOCKED_BODY"

# E2: Body contains the constraint error code
run_body_check \
  "E2  Error body contains 'model_not_eligible_for_kids_mode'" \
  "$KIDS_KEY" "/v1/chat/completions" "$BLOCKED_BODY" \
  "contains" "model_not_eligible_for_kids_mode"

# E3: Body mentions the specific blocked model name
run_body_check \
  "E3  Error body contains the blocked model name 'llama'" \
  "$KIDS_KEY" "/v1/chat/completions" "$BLOCKED_BODY" \
  "contains" "llama"

# E4: Same quality check for /v1/messages (Claude shape)
run_body_check \
  "E4  Claude shape error body contains constraint name" \
  "$KIDS_KEY" "/v1/messages" \
  '{"model":"llama-3.1-8b-instant","max_tokens":1,"messages":[{"role":"user","content":"x"}]}' \
  "contains" "model_not_eligible_for_kids_mode" \
  "anthropic-version: 2023-06-01"

# E5: Same for /v1/responses
run_body_check \
  "E5  Responses shape error body contains constraint name" \
  "$KIDS_KEY" "/v1/responses" \
  '{"model":"llama-3.1-8b-instant","input":"x","max_output_tokens":1}' \
  "contains" "model_not_eligible_for_kids_mode"

# E6: Gemini shape error
run_body_check \
  "E6  Gemini shape error body contains constraint name" \
  "$KIDS_KEY" "/v1beta/models/llama-3.1-8b-instant:generateContent" \
  '{"contents":[{"role":"user","parts":[{"text":"x"}]}]}' \
  "contains" "model_not_eligible_for_kids_mode"

# ============================================================================
# §F — All 4 Request Shapes (kids policy consistency)
# ============================================================================
section "§F  All 4 Request Shapes  [kids policy applied consistently]"

echo -e "${DIM}  Verify kids policy is enforced the same way across all handler shapes.${RESET}"
echo ""

# F1: /v1/chat/completions — compatible_handler
run_check "F1  /v1/chat/completions — whitelisted model (expect 200)" \
  "200" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"say: ok"}],"max_tokens":5}'

run_check "F2  /v1/chat/completions — blocked model (expect 400)" \
  "400" "$KIDS_KEY" "/v1/chat/completions" \
  '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"x"}],"max_tokens":1}'

# F3-F4: /v1/responses — responses_handler
run_check "F3  /v1/responses — whitelisted model (expect 200)" \
  "200" "$KIDS_KEY" "/v1/responses" \
  '{"model":"gpt-4o-mini","input":"say: ok","max_output_tokens":5}'

run_check "F4  /v1/responses — blocked model (expect 400)" \
  "400" "$KIDS_KEY" "/v1/responses" \
  '{"model":"llama-3.1-8b-instant","input":"x","max_output_tokens":1}'

# F5-F6: /v1/messages — claude_handler (Anthropic native shape)
run_check "F5  /v1/messages — whitelisted model (expect 200)" \
  "200" "$KIDS_KEY" "/v1/messages" \
  '{"model":"gpt-4o-mini","max_tokens":5,"messages":[{"role":"user","content":"say: ok"}]}' \
  "anthropic-version: 2023-06-01"

run_check "F6  /v1/messages — blocked model (expect 400)" \
  "400" "$KIDS_KEY" "/v1/messages" \
  '{"model":"llama-3.1-8b-instant","max_tokens":1,"messages":[{"role":"user","content":"x"}]}' \
  "anthropic-version: 2023-06-01"

# F7-F8: /v1beta/models — gemini_handler
run_check "F7  /v1beta Gemini — whitelisted model (expect 200)" \
  "200" "$KIDS_KEY" "/v1beta/models/gpt-4o-mini:generateContent" \
  '{"contents":[{"role":"user","parts":[{"text":"say: ok"}]}]}'

run_check "F8  /v1beta Gemini — blocked model (expect 400)" \
  "400" "$KIDS_KEY" "/v1beta/models/llama-3.1-8b-instant:generateContent" \
  '{"contents":[{"role":"user","parts":[{"text":"x"}]}]}'

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BOLD}╔${SEP}╗${RESET}"
echo -e "${BOLD}║                       SUMMARY                            ║${RESET}"
echo -e "${BOLD}╠${SEP}╣${RESET}"

sections=(
  "§A  Pre-flight"
  "§B  Max Tokens Hard Cap  [2048, all shapes, all tenants]"
  "§C  System Prompt Hard Replace  [kids_mode replaces, normal keeps]"
  "§D  Model Catalog Pre-filter  [/v1/models]"
  "§E  Error Quality  [400 body contains constraint name + model name]"
  "§F  All 4 Request Shapes  [kids policy applied consistently]"
)

for sec in "${sections[@]}"; do
  p=${sec_pass["$sec"]:-0}
  f=${sec_fail["$sec"]:-0}
  if   [[ "$f" -gt 0 ]]; then
    printf "${BOLD}║  %-48s ${RED}FAIL${RESET}${BOLD} %-3s pass  %-3s fail ║${RESET}\n" "$sec" "$p" "$f"
  elif [[ "$p" -gt 0 ]]; then
    printf "${BOLD}║  %-48s ${GREEN}PASS${RESET}${BOLD} %-3s pass         ║${RESET}\n" "$sec" "$p"
  else
    printf "${BOLD}║  ${DIM}%-48s SKIP${RESET}${BOLD}                 ║${RESET}\n" "$sec"
  fi
done

echo -e "${BOLD}╠${SEP}╣${RESET}"
echo -e "${BOLD}║  Total: ${GREEN}$total_pass PASS${RESET}${BOLD}  ${RED}$total_fail FAIL${RESET}${BOLD}  ${YELLOW}$total_skip SKIP${RESET}${BOLD}                    ║${RESET}"
echo -e "${BOLD}╚${SEP}╝${RESET}"
echo ""

if [[ "$total_fail" -gt 0 ]]; then
  echo -e "${RED}Some tests FAILED. Check output above.${RESET}"
  echo -e "${DIM}  Rebuild : docker compose -f docker-compose.dev.yml up -d --build new-api${RESET}"
  echo -e "${DIM}  Logs    : docker logs new-api-dev --tail 100${RESET}"
  exit 1
else
  echo -e "${GREEN}All tests passed. kids_mode safety gate is solid. ✅${RESET}"
fi
