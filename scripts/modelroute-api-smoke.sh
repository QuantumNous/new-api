#!/usr/bin/env bash
# modelroute 本地 API 冒烟（需已启动 new-api）
#
# Prerequisites:
#   - 服务已启动（默认 http://127.0.0.1:3000）
#   - 有 Root 会话 cookie 或 access_token
#   - 可选：用户侧 API Key 用于 chat 验证
#
# Usage:
#   # 仅 Root 管理接口（列表 / 迁移 dry 检查）
#   ./scripts/modelroute-api-smoke.sh \
#     --base http://127.0.0.1:3000 \
#     --token 'YOUR_ROOT_ACCESS_TOKEN'
#
#   # 含 chat 一次 + 再拉 metrics
#   ./scripts/modelroute-api-smoke.sh \
#     --base http://127.0.0.1:3000 \
#     --token 'YOUR_ROOT_ACCESS_TOKEN' \
#     --api-key 'sk-xxx' \
#     --model 'gpt-4o-mini'
#
#   # 执行一键迁移（会改 priority 等，本地库才用）
#   ./scripts/modelroute-api-smoke.sh --base ... --token ... --migrate
#
#   # 切换 routing mode（写 option）
#   ./scripts/modelroute-api-smoke.sh --base ... --token ... --set-mode model_priority
#   ./scripts/modelroute-api-smoke.sh --base ... --token ... --set-mode channel_priority
#
# Cookie 方式（浏览器登录后复制 new-api-user 等）:
#   ./scripts/modelroute-api-smoke.sh --base ... --cookie 'session=...; new-api-user=1'
set -euo pipefail

BASE="${MODELROUTE_BASE:-http://127.0.0.1:3000}"
TOKEN="${MODELROUTE_TOKEN:-}"
COOKIE="${MODELROUTE_COOKIE:-}"
API_KEY="${MODELROUTE_API_KEY:-}"
MODEL="${MODELROUTE_MODEL:-gpt-4o-mini}"
DO_MIGRATE=0
SET_MODE=""
CHAT_ONLY=0
USER_ID="${MODELROUTE_USER_ID:-1}"

usage() {
  sed -n '2,35p' "$0"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --cookie) COOKIE="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --migrate) DO_MIGRATE=1; shift ;;
    --set-mode) SET_MODE="$2"; shift 2 ;;
    --chat) CHAT_ONLY=1; shift ;;
    --user-id) USER_ID="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TOKEN" && -z "$COOKIE" ]]; then
  echo "error: need --token or --cookie (Root auth)" >&2
  echo "hint: login UI then copy access token from /api/user/self or use cookie" >&2
  exit 1
fi

BASE="${BASE%/}"
AUTH_H=()
if [[ -n "$TOKEN" ]]; then
  AUTH_H=(-H "Authorization: Bearer ${TOKEN}" -H "New-Api-User: ${USER_ID}")
fi
if [[ -n "$COOKIE" ]]; then
  AUTH_H+=(-H "Cookie: ${COOKIE}")
fi

json_get() {
  # stdin JSON, arg: jq path or python fallback
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r "$path"
  else
    python3 -c 'import json,sys; d=json.load(sys.stdin)
path=sys.argv[1]
# very small path support: .success / .message / .data
cur=d
for part in path.lstrip(".").split("."):
  if part=="": continue
  if part.endswith("?") :
    part=part[:-1]
  if isinstance(cur, dict):
    cur=cur.get(part)
  else:
    cur=None
    break
print("" if cur is None else cur)' "$path"
  fi
}

req() {
  local method="$1" path="$2"
  shift 2
  local url="${BASE}${path}"
  local code body tmp
  tmp="$(mktemp)"
  code=$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    "${AUTH_H[@]}" \
    "$@")
  body="$(cat "$tmp")"
  rm -f "$tmp"
  echo "--- ${method} ${path} -> HTTP ${code}"
  if command -v jq >/dev/null 2>&1; then
    echo "$body" | jq . 2>/dev/null || echo "$body"
  else
    echo "$body"
  fi
  if [[ "$code" -ge 400 ]]; then
    echo "FAIL http $code" >&2
    return 1
  fi
  # export last body for callers
  LAST_BODY="$body"
  LAST_CODE="$code"
}

step() { echo; echo "==> $*"; }

# --- chat only path ---
if [[ "$CHAT_ONLY" -eq 1 ]]; then
  if [[ -z "$API_KEY" ]]; then
    echo "error: --chat needs --api-key" >&2
    exit 1
  fi
  step "chat completions model=$MODEL"
  curl -sS -X POST "${BASE}/v1/chat/completions" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":8,\"stream\":false}" \
    | (command -v jq >/dev/null && jq . || cat)
  exit 0
fi

step "GET /api/status (public)"
curl -sS "${BASE}/api/status" | (command -v jq >/dev/null && jq '{success,data:.data|if type=="object" then {version,system_name} else . end}' 2>/dev/null || cat) || true

step "GET /api/model_route/policies"
req GET /api/model_route/policies

step "GET /api/model_route/metrics"
req GET /api/model_route/metrics

if [[ -n "$SET_MODE" ]]; then
  if [[ "$SET_MODE" != "model_priority" && "$SET_MODE" != "channel_priority" ]]; then
    echo "error: --set-mode must be model_priority|channel_priority" >&2
    exit 1
  fi
  step "PUT option routing_priority_mode=$SET_MODE"
  # project uses POST /api/option/ with {key,value}
  req PUT /api/option/ -d "{\"key\":\"routing_priority_mode\",\"value\":\"${SET_MODE}\"}" 2>/dev/null \
    || req POST /api/option/ -d "{\"key\":\"routing_priority_mode\",\"value\":\"${SET_MODE}\"}"
fi

if [[ "$DO_MIGRATE" -eq 1 ]]; then
  step "POST /api/model_route/migrate  (mutates DB)"
  req POST /api/model_route/migrate -d '{}'
fi

if [[ -n "$API_KEY" ]]; then
  step "POST /v1/chat/completions model=$MODEL (user traffic)"
  tmp="$(mktemp)"
  code=$(curl -sS -o "$tmp" -w '%{http_code}' -X POST "${BASE}/v1/chat/completions" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with ok only\"}],\"max_tokens\":8,\"stream\":false}")
  echo "--- chat HTTP $code"
  cat "$tmp" | (command -v jq >/dev/null && jq '{id, model, choices:[.choices[]?|{message}], error}' 2>/dev/null || cat "$tmp")
  rm -f "$tmp"
  if [[ "$code" -ge 400 ]]; then
    echo "chat failed (may be no channel/quota) — continue to metrics" >&2
  fi
  step "GET metrics again (look for last_success / experience / role)"
  req GET /api/model_route/metrics
fi

step "smoke finished"
echo "Tips:"
echo "  1) 先 --migrate（本地库）再 --set-mode model_priority"
echo "  2) 再带 --api-key 打 chat，看 metrics 是否更新"
echo "  3) 出问题用 --set-mode channel_priority 回退"
