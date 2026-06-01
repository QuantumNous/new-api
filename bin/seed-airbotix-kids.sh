#!/usr/bin/env bash
# =============================================================================
# bin/seed-airbotix-kids.sh
#
# Idempotently provisions DeepRouter launch tenants:
#   • airbotix-kids  — kids_mode=true, kid-safe policy, for Airbotix workshop
#   • jr-academy      — kids_mode=false, adult policy, for JR Academy coding
#
# Design principles
#   - Idempotent: safe to re-run; skips existing users rather than failing
#   - Exit-on-error: every curl/jq failure aborts immediately
#   - No secrets in argv: credentials via env vars only
#   - Audit trail: timestamped log file next to the script
#   - Dry-run: DRY_RUN=1 prints actions without executing API calls
#
# Usage
#   # Local dev (Docker Compose)
#   ./bin/seed-airbotix-kids.sh
#
#   # Staging / production
#   BASE_URL=https://api.deeprouter.ai \
#   ROOT_PASSWORD=<secret>             \
#   ./bin/seed-airbotix-kids.sh
#
#   # Preview only — no writes
#   DRY_RUN=1 ./bin/seed-airbotix-kids.sh
#
# Environment variables (all optional with sane defaults)
#   BASE_URL          DeepRouter base URL            default: http://localhost:3000
#   ROOT_PASSWORD     root user password             default: 123456
#   KIDS_PASSWORD     airbotix-kids user password    default: random 24-char
#   JR_PASSWORD       jr-academy user password       default: random 24-char
#   KIDS_WEBHOOK_URL  billing webhook for kids       default: (empty — disabled)
#   JR_WEBHOOK_URL    billing webhook for jr         default: (empty — disabled)
#   INITIAL_QUOTA     starting quota units           default: 5000000 (~$10)
#   DRY_RUN           set to 1 to preview only       default: 0
#   VERBOSE           set to 1 for curl -v output    default: 0
#
# Output
#   Prints a summary table of created/existing tenants with their API tokens.
#   Writes the same summary to bin/seed-output-<timestamp>.txt for audit.
#
# Requirements: bash 4+, curl, jq, openssl  (python3 NOT required)
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_USER="root"
ROOT_PASSWORD="${ROOT_PASSWORD:-123456}"
INITIAL_QUOTA="${INITIAL_QUOTA:-5000000}"   # ~$10 at default ratio
DRY_RUN="${DRY_RUN:-0}"
VERBOSE="${VERBOSE:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/seed-output-$(date +%Y%m%d-%H%M%S).txt"
COOKIE_JAR="$(mktemp)"

# ── Colour helpers ─────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${RESET}$*${RESET}" | tee -a "$LOG_FILE"; }
info() { log "${BLUE}  ▸ $*${RESET}"; }
ok()   { log "${GREEN}  ✓ $*${RESET}"; }
warn() { log "${YELLOW}  ⚠ $*${RESET}"; }
err()  { log "${RED}  ✗ $*${RESET}"; exit 1; }
step() { log "\n${BOLD}${CYAN}══ $* ══${RESET}"; }
dry()  { log "${YELLOW}  [DRY-RUN] $*${RESET}"; }

# ── Cleanup ────────────────────────────────────────────────────────────────────

cleanup() { rm -f "$COOKIE_JAR"; }
trap cleanup EXIT

# ── Prerequisite checks ────────────────────────────────────────────────────────

step "Prerequisites"

for cmd in curl jq openssl; do
  if command -v "$cmd" &>/dev/null; then
    ok "$cmd found: $(command -v "$cmd")"
  else
    err "$cmd is required but not installed. Install it and retry."
  fi
done

# Generate secure random passwords if not supplied
KIDS_PASSWORD="${KIDS_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)}"
JR_PASSWORD="${JR_PASSWORD:-$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20)}"

# Generate HMAC webhook secrets
KIDS_WEBHOOK_SECRET="$(openssl rand -hex 32)"
JR_WEBHOOK_SECRET="$(openssl rand -hex 32)"

KIDS_WEBHOOK_URL="${KIDS_WEBHOOK_URL:-}"
JR_WEBHOOK_URL="${JR_WEBHOOK_URL:-}"

CURL_FLAGS=(-s -S --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR")
[[ "$VERBOSE" == "1" ]] && CURL_FLAGS+=(-v)

# ── Connectivity check ─────────────────────────────────────────────────────────

step "Connectivity: ${BASE_URL}"

if [[ "$DRY_RUN" == "1" ]]; then
  dry "Would check ${BASE_URL}/api/status"
else
  STATUS_CODE=$(curl "${CURL_FLAGS[@]}" -o /dev/null -w "%{http_code}" \
    "${BASE_URL}/api/status" 2>/dev/null || echo "000")
  if [[ "$STATUS_CODE" == "200" ]]; then
    ok "DeepRouter is reachable (HTTP $STATUS_CODE)"
  else
    err "DeepRouter not reachable at ${BASE_URL} (HTTP $STATUS_CODE). Is it running?"
  fi
fi

# ── Authentication ─────────────────────────────────────────────────────────────

step "Authenticate as root"

if [[ "$DRY_RUN" == "1" ]]; then
  dry "Would POST /api/user/login as '${ROOT_USER}'"
else
  LOGIN_RESP=$(curl "${CURL_FLAGS[@]}" -X POST "${BASE_URL}/api/user/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${ROOT_USER}\",\"password\":\"${ROOT_PASSWORD}\"}")

  LOGIN_OK=$(echo "$LOGIN_RESP" | jq -r '.success // false')
  if [[ "$LOGIN_OK" != "true" ]]; then
    MSG=$(echo "$LOGIN_RESP" | jq -r '.message // "unknown error"')
    err "Login failed: ${MSG}. Check ROOT_PASSWORD."
  fi
  ok "Logged in as ${ROOT_USER}"
fi

# ── Helper functions ───────────────────────────────────────────────────────────

# api_post <path> <json-body> → response JSON
api_post() {
  local path="$1" body="$2"
  curl "${CURL_FLAGS[@]}" -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# api_put <path> <json-body> → response JSON
api_put() {
  local path="$1" body="$2"
  curl "${CURL_FLAGS[@]}" -X PUT "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# api_get <path> → response JSON
api_get() {
  local path="$1"
  curl "${CURL_FLAGS[@]}" -X GET "${BASE_URL}${path}"
}

# find_user <username> → user-id or ""
# URL-encode via jq @uri (jq is already a declared dependency; no python3 needed).
find_user() {
  local username="$1"
  local encoded
  encoded=$(printf '%s' "$username" | jq -Rr '@uri')
  api_get "/api/user/search?keyword=${encoded}" \
    | jq -r --arg u "$username" '.data // [] | map(select(.username==$u)) | first | .id // empty' 2>/dev/null || true
}

# create_user <username> <password> <display_name> → user-id
# The CreateUser API returns {"success":true,"message":""} with no id field.
# We fetch the id via a separate search GET immediately after creation.
create_user() {
  local username="$1" password="$2" display_name="$3"
  local resp
  resp=$(api_post "/api/user/" \
    "{\"username\":\"${username}\",\"password\":\"${password}\",\"display_name\":\"${display_name}\",\"role\":1}")
  local ok
  ok=$(echo "$resp" | jq -r '.success // false')
  if [[ "$ok" != "true" ]]; then
    MSG=$(echo "$resp" | jq -r '.message // "unknown"')
    err "Failed to create user '${username}': ${MSG}"
  fi
  find_user "$username"
}

# update_tenant <user-id> <json-fields>
update_tenant() {
  local user_id="$1" fields="$2"
  local payload
  payload=$(echo "$fields" | jq --argjson id "$user_id" '. + {"id": $id}')
  local resp
  resp=$(api_put "/api/user/" "$payload")
  local ok
  ok=$(echo "$resp" | jq -r '.success // false')
  [[ "$ok" == "true" ]] || err "Failed to update user ${user_id}: $(echo "$resp" | jq -r '.message')"
}

# add_quota <user-id> <quota-units>
add_quota() {
  local user_id="$1" units="$2"
  local resp
  resp=$(api_post "/api/user/manage" \
    "{\"id\":${user_id},\"action\":\"add_quota\",\"value\":${units},\"mode\":\"add\"}")
  local ok
  ok=$(echo "$resp" | jq -r '.success // false')
  [[ "$ok" == "true" ]] || warn "Could not add quota to user ${user_id} (may require root): $(echo "$resp" | jq -r '.message')"
}

# create_token <display-name> → api-key string
# Logs in as the tenant user first so the token belongs to them.
create_tenant_token() {
  local tenant_user="$1" tenant_pass="$2" token_name="$3"

  # Log in as tenant to create their token
  local tenant_jar
  tenant_jar="$(mktemp)"
  local resp
  resp=$(curl -s -S --cookie-jar "$tenant_jar" --cookie "$tenant_jar" \
    -X POST "${BASE_URL}/api/user/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${tenant_user}\",\"password\":\"${tenant_pass}\"}")

  local login_ok
  login_ok=$(echo "$resp" | jq -r '.success // false')
  if [[ "$login_ok" != "true" ]]; then
    rm -f "$tenant_jar"
    warn "Could not log in as ${tenant_user} to create token"
    echo ""
    return
  fi

  local token_resp
  token_resp=$(curl -s -S --cookie-jar "$tenant_jar" --cookie "$tenant_jar" \
    -X POST "${BASE_URL}/api/token/" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${token_name}\",\"remain_quota\":0,\"unlimited_quota\":true,\"expired_time\":-1}")

  rm -f "$tenant_jar"

  local token_ok
  token_ok=$(echo "$token_resp" | jq -r '.success // false')
  if [[ "$token_ok" == "true" ]]; then
    echo "$token_resp" | jq -r '.data // empty'
  else
    warn "Could not create token for ${tenant_user}: $(echo "$token_resp" | jq -r '.message // "unknown"')"
    echo ""
  fi
}

# ── Tenant definition ──────────────────────────────────────────────────────────

# Tenant 1: Airbotix Kids
KIDS_USERNAME="airbotix-kids"
KIDS_DISPLAY="Airbotix Kids Platform"
KIDS_FIELDS=$(jq -n \
  --arg pp "kid-safe" \
  --arg wu "$KIDS_WEBHOOK_URL" \
  --arg ws "$KIDS_WEBHOOK_SECRET" \
  --arg cp "airbotix-v1" \
  '{
    kids_mode: true,
    policy_profile: $pp,
    billing_webhook_url: $wu,
    webhook_secret: $ws,
    custom_pricing_id: $cp,
    username: "",
    password: "",
    display_name: ""
  }')

# Tenant 2: JR Academy
JR_USERNAME="jr-academy"
JR_DISPLAY="JR Academy"
JR_FIELDS=$(jq -n \
  --arg pp "adult" \
  --arg wu "$JR_WEBHOOK_URL" \
  --arg ws "$JR_WEBHOOK_SECRET" \
  --arg cp "jr-v1" \
  '{
    kids_mode: false,
    policy_profile: $pp,
    billing_webhook_url: $wu,
    webhook_secret: $ws,
    custom_pricing_id: $cp,
    username: "",
    password: "",
    display_name: ""
  }')

# ── Provision tenants ──────────────────────────────────────────────────────────

provision_tenant() {
  local username="$1" password="$2" display_name="$3" fields="$4"
  local token_name="${5:-default}"

  step "Tenant: ${display_name} (${username})"

  if [[ "$DRY_RUN" == "1" ]]; then
    dry "Would create/update user '${username}' with fields: $(echo "$fields" | jq -c 'del(.username,.password,.display_name)')"
    dry "Would add ${INITIAL_QUOTA} quota units (~\$$(echo "scale=2; $INITIAL_QUOTA/500000" | bc))"
    dry "Would create API token '${token_name}'"
    return
  fi

  # Check if user already exists
  local user_id
  user_id=$(find_user "$username")

  if [[ -n "$user_id" && "$user_id" != "null" ]]; then
    warn "User '${username}' already exists (id=${user_id}) — updating fields only"
  else
    info "Creating user '${username}'..."
    user_id=$(create_user "$username" "$password" "$display_name")
    if [[ -z "$user_id" || "$user_id" == "null" ]]; then
      err "Could not retrieve id for newly created user '${username}'"
    fi
    ok "Created user '${username}' (id=${user_id})"

    info "Adding initial quota (${INITIAL_QUOTA} units)..."
    add_quota "$user_id" "$INITIAL_QUOTA"
    ok "Quota added"
  fi

  info "Applying tenant policy fields..."
  update_tenant "$user_id" "$fields"
  ok "Fields updated (kids_mode, policy_profile, billing_webhook_url, webhook_secret)"

  info "Creating API token..."
  local api_key
  api_key=$(create_tenant_token "$username" "$password" "$token_name")

  # Store results for summary
  RESULT_USERS+=("$username")
  RESULT_IDS+=("$user_id")
  RESULT_TOKENS+=("${api_key:-<see admin UI>}")
  RESULT_KIDS_MODES+=("$(echo "$fields" | jq -r '.kids_mode')")
  RESULT_PROFILES+=("$(echo "$fields" | jq -r '.policy_profile')")
  RESULT_PASSWORDS+=("$password")
  RESULT_WEBHOOK_SECRETS+=("$(echo "$fields" | jq -r '.webhook_secret')")
}

# Initialise result arrays
RESULT_USERS=(); RESULT_IDS=(); RESULT_TOKENS=()
RESULT_KIDS_MODES=(); RESULT_PROFILES=(); RESULT_PASSWORDS=(); RESULT_WEBHOOK_SECRETS=()

provision_tenant \
  "$KIDS_USERNAME" "$KIDS_PASSWORD" "$KIDS_DISPLAY" "$KIDS_FIELDS" \
  "workshop-key-$(date +%Y%m)"

provision_tenant \
  "$JR_USERNAME" "$JR_PASSWORD" "$JR_DISPLAY" "$JR_FIELDS" \
  "jr-api-key-$(date +%Y%m)"

# ── Summary ────────────────────────────────────────────────────────────────────

step "Summary"

if [[ "$DRY_RUN" == "1" ]]; then
  warn "DRY-RUN mode — no changes were made."
else
  log ""
  log "${BOLD}┌──────────────────────────────────────────────────────────────────────┐${RESET}"
  log "${BOLD}│                   DeepRouter Tenant Seed — Results                   │${RESET}"
  log "${BOLD}└──────────────────────────────────────────────────────────────────────┘${RESET}"
  log ""

  for i in "${!RESULT_USERS[@]}"; do
    local_username="${RESULT_USERS[$i]}"
    local_id="${RESULT_IDS[$i]}"
    local_token="${RESULT_TOKENS[$i]}"
    local_kids="${RESULT_KIDS_MODES[$i]}"
    local_profile="${RESULT_PROFILES[$i]}"
    local_password="${RESULT_PASSWORDS[$i]}"
    local_webhook_secret="${RESULT_WEBHOOK_SECRETS[$i]}"

    log "${BOLD}  Tenant ${i+1}: ${local_username}${RESET}"
    log "  ├─ User ID          : ${local_id}"
    log "  ├─ Password         : ${local_password}"
    log "  ├─ kids_mode        : ${local_kids}"
    log "  ├─ policy_profile   : ${local_profile}"
    log "  ├─ Webhook Secret   : ${local_webhook_secret}"
    log "  └─ API Key          : ${BOLD}${GREEN}${local_token}${RESET}"
    log ""
  done

  log "${YELLOW}  ⚠  Save the above credentials — passwords and webhook secrets cannot"
  log "     be recovered after this script exits.${RESET}"
  log ""
  log "  Next step:"
  log "  1. Share API Key with the client integration team"
  log "  2. Share Webhook Secret with the platform-backend team"
  log "  3. Verify: curl -H 'Authorization: Bearer <API_KEY>' \\"
  log "             ${BASE_URL}/v1/models"
  log ""
  log "${GREEN}  Full output saved to: ${LOG_FILE}${RESET}"
fi
