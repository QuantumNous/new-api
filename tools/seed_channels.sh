#!/bin/bash
# ============================================================
# seed_channels.sh — PostgreSQL-এ সরাসরি channel তৈরি করে
# VPS-এ চালাও: bash seed_channels.sh
# ============================================================

PSQL="docker exec -i postgres psql -U root -d new-api"

# ── Account 1: claude-opus-4.8 ──────────────────────────────
USER_MODEL="claude-opus-4.8"
ALI_KEY="sk-4fc27cde61a64eeda7c0958461b6314c"
BASE_URL="https://ws-gbnowfivva3rg7rk.ap-southeast-1.maas.aliyuncs.com"
TAG="Anthropic"

MODELS=(
  "qwen-plus"
  "qwen-turbo"
  "qwen3.5-122b-a10b"
  "qwen3-max"
  "qwen3.5-plus"
  "qwen3.6-plus"
  "qwen-max"
  "qwen3-235b-a22b-thinking-2507"
  "qwen3-vl-235b-a22b-thinking"
  "qwen3-vl-30b-a3b-thinking"
  "qwen3.7-max-preview"
  "qwen3-32b"
  "qwen3.5-397b-a17b"
  "qwen3.6-flash"
  "deepseek-v3.2"
  "qwen3-coder-next"
  "qwen3.5-flash"
  "deepseek-v4-flash"
  "qwen3.5-35b-a3b"
  "qwen3-30b-a3b-thinking-2507"
  "qwen3-coder-plus-2025-09-23"
  "qwen-plus-latest"
  "qwen3-coder-480b-a35b-instruct"
  "qwen3-max-2026-01-23"
  "qwen3-coder-plus"
  "qwen3-max-preview"
  "qwen3.5-plus-2026-02-15"
  "qwen3.6-plus-2026-04-02"
  "qwen3.7-max-2026-05-20"
  "qwen3-coder-30b-a3b-instruct"
  "qwen3-8b"
  "qwen3.6-27b"
  "qwen3-235b-a22b"
  "qvq-max"
  "qwen3-coder-flash"
  "qwen3-next-80b-a3b-thinking"
  "qwen3.5-27b"
  "qwen3-30b-a3b"
  "qwen3-14b"
  "deepseek-v4-pro"
  "qwen3-30b-a3b-instruct-2507"
  "qwen-flash"
  "qwen3.6-35b-a3b"
  "qwen3-235b-a22b-instruct-2507"
  "qwq-plus"
  "qwen3-coder-plus-2025-07-22"
  "qwen3.5-plus-2026-04-20"
  "qwen3.7-max"
  "glm-5.1"
  "qwen3.7-plus"
  "qwen3.7-plus-2026-05-26"
  "qwen3.7-max-2026-06-08"
)

echo "▶ Creating ${#MODELS[@]} channels for: $USER_MODEL"

TOTAL=${#MODELS[@]}
SUCCESS=0
FAIL=0

for i in "${!MODELS[@]}"; do
  PRIORITY=$((TOTAL - i))
  PADDED=$(printf "%02d" $PRIORITY)
  NAME="ANT-${USER_MODEL}-P${PADDED}"
  QWEN="${MODELS[$i]}"
  MAPPING="{\"${USER_MODEL}\":\"${QWEN}\"}"
  TS=$(date +%s)

  RESULT=$($PSQL -t -c "
INSERT INTO channels(
  type, \"key\", status, name, weight,
  created_time, base_url, models, \"group\",
  model_mapping, priority, auto_ban, tag,
  other, other_info, settings, channel_info
) VALUES (
  17, '${ALI_KEY}', 1, '${NAME}', 0,
  ${TS}, '${BASE_URL}', '${USER_MODEL}', 'default',
  '${MAPPING}', ${PRIORITY}, 1, '${TAG}',
  '', '', '', '{}'
) ON CONFLICT DO NOTHING;
" 2>&1)

  if echo "$RESULT" | grep -q "INSERT\|1"; then
    echo "  ✅ [P${PADDED}] $NAME → $QWEN"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ [P${PADDED}] $NAME → FAIL: $RESULT"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "══════════════════════════════"
echo "✅ Success: $SUCCESS  ❌ Failed: $FAIL"
echo "══════════════════════════════"
