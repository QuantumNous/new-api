#!/usr/bin/env bash
# =============================================================================
# bin/setup-dr12-test-accounts.sh — One-shot DR-12 test account setup
#
# Creates two test users via the admin API and prints KIDS_KEY + NORMAL_KEY
# ready to paste into test-dr12-kids-mode.sh.
#
# Users created:
#   dr12-normal  — passthrough (kids_mode=false)
#   dr12-kids    — kids_mode=true, policy_profile=kid-safe
#
# USAGE
# -----
#   # Default root password "123456":
#   bash bin/setup-dr12-test-accounts.sh
#
#   # Custom root password:
#   ROOT_PASS=mypassword bash bin/setup-dr12-test-accounts.sh
#
#   # Custom server URL:
#   BASE_URL=http://localhost:8080 bash bin/setup-dr12-test-accounts.sh
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_PASS="${ROOT_PASS:-123456}"
ROOT_USER="${ROOT_USER:-root}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

# Temp files for session cookies (auto-cleaned on exit)
ROOT_COOKIE=$(mktemp)
NORMAL_COOKIE=$(mktemp)
KIDS_COOKIE=$(mktemp)
trap 'rm -f "$ROOT_COOKIE" "$NORMAL_COOKIE" "$KIDS_COOKIE"' EXIT

die() { echo -e "${RED}ERROR: $1${RESET}" >&2; exit 1; }
log() { echo -e "${DIM}  → $1${RESET}" >&2; }
ok()  { echo -e "${GREEN}  ✓ $1${RESET}" >&2; }

# Detect python first — needed for direct $PY -c calls regardless of jq.
PY=""
if   command -v python3 &>/dev/null; then PY=python3
elif command -v python  &>/dev/null; then PY=python
fi

# jq preferred for _jq helpers; python is the fallback.
if command -v jq &>/dev/null; then
  _jq() { jq -r "$@"; }
  _jq_set_str() {
    local file="$1" key="$2" val="$3"
    jq --arg v "$val" ".$key = \$v" "$file"
  }
  _jq_set_bool() {
    local file="$1" key="$2" val="$3"   # val: true | false
    jq ".$key = $val" "$file"
  }
else
  [[ -n "$PY" ]] || die "Neither jq nor python found. Install one of them."
  _jq() {
    local query="$1"; shift
    $PY -c "
import json, sys
data = json.load(sys.stdin)
# Minimal subset: handle .field and .field.subfield
q = '$query'.lstrip('.')
parts = q.split('.')
v = data
for p in parts:
    v = v.get(p, '') if isinstance(v, dict) else ''
print(v if v is not None else '')
" "$@"
  }
  _jq_set_str() {
    local file="$1" key="$2" val="$3"
    $PY -c "
import json, sys
with open('$file') as f: data = json.load(f)
data['$key'] = '$val'
print(json.dumps(data))
"
  }
  _jq_set_bool() {
    local file="$1" key="$2" val="$3"
    $PY -c "
import json, sys
with open('$file') as f: data = json.load(f)
data['$key'] = $val
print(json.dumps(data))
"
  }
fi

# Current user ID for New-Api-User header (set after each login)
CURRENT_USER_ID=""

# ---------------------------------------------------------------------------
# api_call METHOD COOKIE_FILE ENDPOINT [BODY]
# Returns response body; exits if HTTP status is not 200.
# Requires CURRENT_USER_ID to be set (New-Api-User header).
# ---------------------------------------------------------------------------
api_call() {
  local method="$1" cookie_file="$2" endpoint="$3" body="${4:-}"
  local -a args=(-s -w "\n__HTTP__%{http_code}" --max-time 20
    -b "$cookie_file" -c "$cookie_file"
    -X "$method"
    -H "Content-Type: application/json"
    -H "New-Api-User: ${CURRENT_USER_ID:-0}")
  [[ -n "$body" ]] && args+=(-d "$body")
  local raw; raw=$(curl "${args[@]}" "$BASE_URL$endpoint" 2>&1)
  local status; status=$(printf '%s' "$raw" | tail -1 | sed 's/.*__HTTP__//')
  local resp;   resp=$(printf '%s' "$raw" | grep -v '__HTTP__')
  if [[ "$status" != "200" ]]; then die "$method $endpoint → HTTP $status\n$resp"; fi
  printf '%s' "$resp"
}

# login_and_set_user USERNAME PASSWORD COOKIE_FILE
# Logs in and sets CURRENT_USER_ID from response.
login_and_set_user() {
  local uname="$1" pass="$2" cookie_file="$3"
  # Login doesn't need New-Api-User, bypass api_call
  local raw; raw=$(curl -s -w "\n__HTTP__%{http_code}" --max-time 20 \
    -b "$cookie_file" -c "$cookie_file" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"username\":\"$uname\",\"password\":\"$pass\"}" \
    "$BASE_URL/api/user/login" 2>&1)
  local status; status=$(printf '%s' "$raw" | tail -1 | sed 's/.*__HTTP__//')
  local resp;   resp=$(printf '%s' "$raw" | grep -v '__HTTP__')
  if [[ "$status" != "200" ]]; then die "Login as $uname failed (HTTP $status): $resp"; fi
  if ! printf '%s' "$resp" | grep -q '"success":true'; then die "Login as $uname failed: $resp"; fi
  CURRENT_USER_ID=$(printf '%s' "$resp" | \
    $PY -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))")
  if [[ -z "$CURRENT_USER_ID" ]]; then die "Could not parse user ID from login response: $resp"; fi
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗"
echo -e "║   DR-12 Test Account Setup                           ║"
echo -e "╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
printf "  %-12s %s\n" "BASE_URL:" "$BASE_URL"
printf "  %-12s %s\n" "Root user:" "$ROOT_USER"
echo ""

# ===========================================================================
# Step 1: Check server
# ===========================================================================
echo -e "${BOLD}[1/6] Checking server…${RESET}"
curl -sf -o /dev/null --max-time 5 "$BASE_URL/api/status" \
  || die "Server not reachable at $BASE_URL. Run: docker compose -f docker-compose.dev.yml up -d"
ok "Server is up"

# ===========================================================================
# Step 2: Login as root
# ===========================================================================
echo -e "${BOLD}[2/6] Logging in as root…${RESET}"
login_and_set_user "$ROOT_USER" "$ROOT_PASS" "$ROOT_COOKIE"
ok "Logged in as root (id=$CURRENT_USER_ID)"

# ===========================================================================
# Step 3: Create users (idempotent — skip if username already exists)
# ===========================================================================
echo -e "${BOLD}[3/6] Creating test users…${RESET}"

TEST_PASS="Dr12Test@2024"  # strong enough to pass validation

create_user_if_missing() {
  local uname="$1" display="$2"
  log "Checking if $uname exists…"
  SEARCH=$(api_call GET "$ROOT_COOKIE" "/api/user/search?keyword=$uname")
  # If the exact username is in the result, skip creation
  if printf '%s' "$SEARCH" | grep -q "\"username\":\"$uname\""; then
    ok "$uname already exists — skipping creation"
    return 0
  fi
  log "Creating $uname…"
  CREATE_RESP=$(api_call POST "$ROOT_COOKIE" "/api/user/" \
    "{\"username\":\"$uname\",\"password\":\"$TEST_PASS\",\"display_name\":\"$display\",\"role\":1}")
  printf '%s' "$CREATE_RESP" | grep -q '"success":true' \
    || die "Failed to create $uname: $CREATE_RESP"
  ok "Created $uname"
}

create_user_if_missing "dr12-normal" "DR12 Normal Test"
create_user_if_missing "dr12-kids"   "DR12 Kids Test"

# ===========================================================================
# Step 4: Get user IDs and set kids_mode on dr12-kids
# ===========================================================================
echo -e "${BOLD}[4/6] Configuring kids_mode on dr12-kids…${RESET}"

# Search for each user to get their ID
log "Fetching user IDs…"
SEARCH_NORMAL=$(api_call GET "$ROOT_COOKIE" "/api/user/search?keyword=dr12-normal")
SEARCH_KIDS=$(api_call GET "$ROOT_COOKIE" "/api/user/search?keyword=dr12-kids")

# Extract IDs — items is an array; grab first match by username
NORMAL_ID=$(printf '%s' "$SEARCH_NORMAL" | \
  $PY -c "
import json,sys
data = json.load(sys.stdin)
items = data.get('data',{}).get('items',[]) or data.get('data',[])
for u in items:
    if u.get('username') == 'dr12-normal':
        print(u['id']); break
")
KIDS_ID=$(printf '%s' "$SEARCH_KIDS" | \
  $PY -c "
import json,sys
data = json.load(sys.stdin)
items = data.get('data',{}).get('items',[]) or data.get('data',[])
for u in items:
    if u.get('username') == 'dr12-kids':
        print(u['id']); break
")

if [[ -z "$NORMAL_ID" ]]; then die "Could not find user ID for dr12-normal"; fi
if [[ -z "$KIDS_ID"   ]]; then die "Could not find user ID for dr12-kids"; fi
log "dr12-normal id=$NORMAL_ID  dr12-kids id=$KIDS_ID"

# GET full user object for dr12-kids, then PUT back with kids_mode=true
KIDS_USER_RAW=$(api_call GET "$ROOT_COOKIE" "/api/user/$KIDS_ID")
KIDS_USER_DATA=$(printf '%s' "$KIDS_USER_RAW" | \
  $PY -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('data',d)))")

KIDS_USER_UPDATED=$(printf '%s' "$KIDS_USER_DATA" | \
  $PY -c "
import json,sys
u = json.load(sys.stdin)
u['kids_mode'] = True
u['policy_profile'] = 'kid-safe'
# Remove password so edit() keeps existing hash
u.pop('password', None)
print(json.dumps(u))
")

UPDATE_RESP=$(api_call PUT "$ROOT_COOKIE" "/api/user/" "$KIDS_USER_UPDATED")
if ! printf '%s' "$UPDATE_RESP" | grep -q '"success":true'; then die "Failed to update dr12-kids: $UPDATE_RESP"; fi
ok "dr12-kids updated: kids_mode=true, policy_profile=kid-safe"

# ===========================================================================
# Step 5: Create API tokens (login as each user, then create token)
# ===========================================================================
echo -e "${BOLD}[5/6] Creating API tokens…${RESET}"

create_token_for_user() {
  local uname="$1" cookie_file="$2" token_name="$3"
  log "Logging in as $uname…"
  login_and_set_user "$uname" "$TEST_PASS" "$cookie_file"

  log "Creating API token '$token_name'…"
  CREATE=$(api_call POST "$cookie_file" "/api/token/" \
    "{\"name\":\"$token_name\",\"unlimited_quota\":true,\"expired_time\":-1,\"model_limits_enabled\":false,\"group\":\"default\"}")
  if ! printf '%s' "$CREATE" | grep -q '"success":true'; then die "Token creation failed for $uname: $CREATE"; fi

  log "Fetching token list…"
  TOKEN_LIST=$(api_call GET "$cookie_file" "/api/token/?p=0&page_size=20")
  # Find the token ID by name
  TOKEN_ID=$(printf '%s' "$TOKEN_LIST" | \
    $PY -c "
import json,sys
data = json.load(sys.stdin)
items = data.get('data',{}).get('items',[]) or data.get('data',[])
for t in items:
    if t.get('name') == '$token_name':
        print(t['id']); break
")
  if [[ -z "$TOKEN_ID" ]]; then die "Could not find created token for $uname"; fi

  log "Revealing token key (id=$TOKEN_ID)…"
  KEY_RESP=$(api_call POST "$cookie_file" "/api/token/$TOKEN_ID/key")
  TOKEN_KEY=$(printf '%s' "$KEY_RESP" | \
    $PY -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('key',''))")
  if [[ -z "$TOKEN_KEY" ]]; then die "Empty key returned for $uname"; fi
  printf '%s' "$TOKEN_KEY"
}

NORMAL_KEY=$(create_token_for_user "dr12-normal" "$NORMAL_COOKIE" "dr12-normal-test-token")
ok "NORMAL_KEY created"

KIDS_KEY=$(create_token_for_user "dr12-kids" "$KIDS_COOKIE" "dr12-kids-test-token")
ok "KIDS_KEY created"

# ===========================================================================
# Step 6: Print results
# ===========================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗"
echo -e "║   Setup complete! Copy these env vars:               ║"
echo -e "╠══════════════════════════════════════════════════════╣${RESET}"
echo ""
echo -e "${BOLD}  NORMAL_KEY=${NORMAL_KEY}${RESET}"
echo -e "${BOLD}  KIDS_KEY=${KIDS_KEY}${RESET}"
echo ""
echo -e "${DIM}  Users:${RESET}"
echo -e "${DIM}    dr12-normal  id=$NORMAL_ID  kids_mode=false${RESET}"
echo -e "${DIM}    dr12-kids    id=$KIDS_ID    kids_mode=true, policy_profile=kid-safe${RESET}"
echo -e "${DIM}    password for both: $TEST_PASS${RESET}"
echo ""
echo -e "${BOLD}${CYAN}── Run DR-12 manual tests ───────────────────────────────${RESET}"
echo ""
echo -e "  KIDS_KEY=${KIDS_KEY} \\"
echo -e "  NORMAL_KEY=${NORMAL_KEY} \\"
echo -e "  bash bin/test-dr12-kids-mode.sh"
echo ""
echo -e "${BOLD}${CYAN}── Or export and run ────────────────────────────────────${RESET}"
echo ""
echo -e "  export KIDS_KEY=${KIDS_KEY}"
echo -e "  export NORMAL_KEY=${NORMAL_KEY}"
echo -e "  bash bin/test-dr12-kids-mode.sh"
echo ""
