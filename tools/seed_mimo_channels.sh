#!/bin/bash
# ============================================================
# seed_mimo_channels.sh
# ২০টা user-facing model → সব mimo-v2.5 backend-এ route করবে
# VPS-এ চালাও: bash seed_mimo_channels.sh
# ============================================================

PSQL="docker exec -i postgres psql -U root -d new-api"

MIMO_KEY="sk-sqn6ewkthmwh62xzyrsqxjf0tq9ypmqicrxb2ziezgoqvxdi"
MIMO_BASE_URL="https://api.xiaomimimo.com"
MIMO_BACKEND_MODEL="mimo-v2.5"
CHANNEL_TYPE=1   # OpenAI compatible

echo "▶ Creating 20 MiMo channels (all → $MIMO_BACKEND_MODEL)"
echo ""

# Format: "USER_FACING_MODEL|CHANNEL_NAME|TAG|PRIORITY"
CHANNELS=(
  "claude-fable-5|Claude Fable 5|Anthropic|200"
  "claude-opus-4.8|Claude Opus 4.8|Anthropic|199"
  "claude-opus-4.7|Claude Opus 4.7|Anthropic|198"
  "claude-opus-4.6|Claude Opus 4.6|Anthropic|197"
  "claude-sonnet-4.6|Claude Sonnet 4.6|Anthropic|196"
  "claude-sonnet-4.5|Claude Sonnet 4.5|Anthropic|195"
  "gemini-3.1-pro|Gemini 3.1 Pro|Google|190"
  "gemini-3-pro|Gemini 3 Pro|Google|189"
  "gemini-2.5-pro|Gemini 2.5 Pro|Google|188"
  "gemini-2.5-flash|Gemini 2.5 Flash|Google|187"
  "grok-4.1|Grok 4.1|xAI|180"
  "grok-4|Grok 4|xAI|179"
  "grok-3|Grok 3|xAI|178"
  "deepseek-v4-pro|DeepSeek V4-Pro|DeepSeek|170"
  "deepseek-r1|DeepSeek R1|DeepSeek|169"
  "deepseek-v4|DeepSeek V4|DeepSeek|168"
  "deepseek-v3|DeepSeek V3|DeepSeek|167"
  "gpt-5.4|GPT-5.4|OpenAI|160"
  "gpt-5.5|GPT-5.5|OpenAI|159"
  "gpt-5.3-codex|GPT-5.3-Codex|OpenAI|158"
)

SUCCESS=0
FAIL=0

for entry in "${CHANNELS[@]}"; do
  IFS='|' read -r MODEL_ID CHANNEL_NAME TAG PRIORITY <<< "$entry"

  MAPPING="{\"${MODEL_ID}\":\"${MIMO_BACKEND_MODEL}\"}"
  TS=$(date +%s)

  RESULT=$($PSQL -t -c "
INSERT INTO channels(
  type, \"key\", status, name, weight,
  created_time, base_url, models, \"group\",
  model_mapping, priority, auto_ban, tag,
  other, other_info, settings, channel_info
) VALUES (
  ${CHANNEL_TYPE},
  '${MIMO_KEY}',
  1,
  '${CHANNEL_NAME}',
  0,
  ${TS},
  '${MIMO_BASE_URL}',
  '${MODEL_ID}',
  'default',
  '${MAPPING}',
  ${PRIORITY},
  1,
  '${TAG}',
  '', '', '', '{}'
) ON CONFLICT DO NOTHING;
" 2>&1)

  if echo "$RESULT" | grep -q "INSERT\|1"; then
    echo "  ✅ [${TAG}] ${CHANNEL_NAME} (${MODEL_ID}) → ${MIMO_BACKEND_MODEL}"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ FAIL: ${CHANNEL_NAME} → $RESULT"
    FAIL=$((FAIL + 1))
  fi

done

echo ""
echo "══════════════════════════════════════"
echo "✅ Success: $SUCCESS  ❌ Failed: $FAIL"
echo "══════════════════════════════════════"
echo ""
echo "এখন Admin Panel → Models গিয়ে মডেলগুলো enable করো!"
