#!/bin/bash
# ============================================================
# update_mimo_models.sh
# 1) ModelRatio + CompletionRatio pricing set করবে
# 2) Channel remark (description) update করবে
# 3) Models table-এ model description যোগ করবে
# ============================================================

PSQL="docker exec -i postgres psql -U root -d new-api"

echo "▶ Step 1: Setting model pricing (ModelRatio + CompletionRatio)"

# ModelRatio update (input_price = ratio * 2, so ratio = input_price / 2)
# Flagship $0.90/M → ratio=0.45 | Advanced $0.70/M → ratio=0.35
# Standard $0.50/M → ratio=0.25 | Lite $0.30/M → ratio=0.15

$PSQL -t -c "
UPDATE options SET value = (value::jsonb ||
  '{
    \"claude-fable-5\": 0.45,
    \"claude-opus-4.8\": 0.45,
    \"gpt-5.5\": 0.45,
    \"grok-4.1\": 0.45,
    \"gemini-3.1-pro\": 0.45,
    \"deepseek-v4-pro\": 0.45,
    \"claude-opus-4.7\": 0.35,
    \"claude-opus-4.6\": 0.35,
    \"gpt-5.4\": 0.35,
    \"grok-4\": 0.35,
    \"gemini-3-pro\": 0.35,
    \"deepseek-r1\": 0.35,
    \"claude-sonnet-4.6\": 0.25,
    \"gpt-5.3-codex\": 0.25,
    \"grok-3\": 0.25,
    \"gemini-2.5-pro\": 0.25,
    \"deepseek-v4\": 0.25,
    \"claude-sonnet-4.5\": 0.15,
    \"gemini-2.5-flash\": 0.15,
    \"deepseek-v3\": 0.15
  }'::jsonb)::text
WHERE key = 'ModelRatio';
" 2>&1 && echo "  ✅ ModelRatio updated" || echo "  ❌ ModelRatio failed"

# CompletionRatio = output/input (all 2:1 ratio → output = 2x input)
$PSQL -t -c "
UPDATE options SET value = (value::jsonb ||
  '{
    \"claude-fable-5\": 2,
    \"claude-opus-4.8\": 2,
    \"claude-opus-4.7\": 2,
    \"claude-opus-4.6\": 2,
    \"claude-sonnet-4.6\": 2,
    \"claude-sonnet-4.5\": 2,
    \"gemini-3.1-pro\": 2,
    \"gemini-3-pro\": 2,
    \"gemini-2.5-pro\": 2,
    \"gemini-2.5-flash\": 2,
    \"grok-4.1\": 2,
    \"grok-4\": 2,
    \"grok-3\": 2,
    \"deepseek-v4-pro\": 2,
    \"deepseek-r1\": 2,
    \"deepseek-v4\": 2,
    \"deepseek-v3\": 2,
    \"gpt-5.4\": 2,
    \"gpt-5.5\": 2,
    \"gpt-5.3-codex\": 2
  }'::jsonb)::text
WHERE key = 'CompletionRatio';
" 2>&1 && echo "  ✅ CompletionRatio updated" || echo "  ❌ CompletionRatio failed"

echo ""
echo "▶ Step 2: Updating channel remarks (English descriptions)"

declare -A REMARKS
REMARKS["Claude Fable 5"]="Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks."
REMARKS["Claude Opus 4.8"]="The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving."
REMARKS["Claude Opus 4.7"]="An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and creative writing."
REMARKS["Claude Opus 4.6"]="A reliable and fast Opus model. Effective for everyday complex tasks, documentation, and code review."
REMARKS["Claude Sonnet 4.6"]="The perfect balance of speed and intelligence. Ideal for fast and reliable assistance in daily workflows."
REMARKS["Claude Sonnet 4.5"]="An efficient and affordable model that delivers excellent results for simple to moderately complex tasks."
REMARKS["Gemini 3.1 Pro"]="Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks."
REMARKS["Gemini 3 Pro"]="An advanced pro model with powerful multimodal capabilities. Delivers high accuracy in research, coding, and analytical work."
REMARKS["Gemini 2.5 Pro"]="Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding."
REMARKS["Gemini 2.5 Flash"]="Ultra-fast and cost-efficient. The best choice for general Q&A, summarization, and quick task execution."
REMARKS["Grok 4.1"]="xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis."
REMARKS["Grok 4"]="A powerful reasoning model. Extremely effective for math, science, and engineering problems."
REMARKS["Grok 3"]="Fast and reliable. An excellent assistant for everyday tasks and creative writing."
REMARKS["DeepSeek V4-Pro"]="DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning."
REMARKS["DeepSeek R1"]="A powerful reasoning model. Unmatched at solving complex problems step-by-step and in mathematics."
REMARKS["DeepSeek V4"]="An advanced and efficient model. Delivers high-quality results in code generation, debugging, and data analysis."
REMARKS["DeepSeek V3"]="Reliable and cost-effective. Maintains an excellent balance for simple to moderately complex tasks."
REMARKS["GPT-5.5"]="OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task."
REMARKS["GPT-5.4"]="Powerful and versatile. Delivers high-quality results and stable performance in coding, writing, and analysis."
REMARKS["GPT-5.3-Codex"]="A coding-specialized model. Exceptionally skilled in programming, debugging, and software design."

for CHANNEL_NAME in "${!REMARKS[@]}"; do
  REMARK="${REMARKS[$CHANNEL_NAME]}"
  RESULT=$($PSQL -t -c "UPDATE channels SET remark='${REMARK}' WHERE name='${CHANNEL_NAME}';" 2>&1)
  if echo "$RESULT" | grep -q "UPDATE 1"; then
    echo "  ✅ Remark set: ${CHANNEL_NAME}"
  else
    echo "  ⚠️  ${CHANNEL_NAME}: $RESULT"
  fi
done

echo ""
echo "▶ Step 3: Adding models to models table with descriptions"

declare -A DESCRIPTIONS
DESCRIPTIONS["claude-fable-5"]="Anthropic's most advanced flagship model. Unmatched in complex analysis, deep reasoning, and long-context processing. The best choice for the most demanding tasks."
DESCRIPTIONS["claude-opus-4.8"]="The latest and most capable version of the Opus series. Exceptionally skilled at coding, research analysis, and multi-step problem solving."
DESCRIPTIONS["claude-opus-4.7"]="An advanced model in the powerful Opus series. Excellent at complex question analysis, detailed explanations, and creative writing."
DESCRIPTIONS["claude-opus-4.6"]="A reliable and fast Opus model. Effective for everyday complex tasks, documentation, and code review."
DESCRIPTIONS["claude-sonnet-4.6"]="The perfect balance of speed and intelligence. Ideal for fast and reliable assistance in daily workflows."
DESCRIPTIONS["claude-sonnet-4.5"]="An efficient and affordable model that delivers excellent results for simple to moderately complex tasks."
DESCRIPTIONS["gemini-3.1-pro"]="Google's most advanced multimodal model. Outstanding in text, code, and complex data analysis. Superior in long-context and reasoning tasks."
DESCRIPTIONS["gemini-3-pro"]="An advanced pro model with powerful multimodal capabilities. Delivers high accuracy in research, coding, and analytical work."
DESCRIPTIONS["gemini-2.5-pro"]="Google's premium model with strong analytical capabilities and fast responses. Particularly useful for complex reasoning and coding."
DESCRIPTIONS["gemini-2.5-flash"]="Ultra-fast and cost-efficient. The best choice for general Q&A, summarization, and quick task execution."
DESCRIPTIONS["grok-4.1"]="xAI's latest flagship model. A top performer in deep scientific thinking, coding, and complex logical analysis."
DESCRIPTIONS["grok-4"]="A powerful reasoning model. Extremely effective for math, science, and engineering problems."
DESCRIPTIONS["grok-3"]="Fast and reliable. An excellent assistant for everyday tasks and creative writing."
DESCRIPTIONS["deepseek-v4-pro"]="DeepSeek's most capable model. World-class performance in mathematics, coding, and scientific reasoning."
DESCRIPTIONS["deepseek-r1"]="A powerful reasoning model. Unmatched at solving complex problems step-by-step and in mathematics."
DESCRIPTIONS["deepseek-v4"]="An advanced and efficient model. Delivers high-quality results in code generation, debugging, and data analysis."
DESCRIPTIONS["deepseek-v3"]="Reliable and cost-effective. Maintains an excellent balance for simple to moderately complex tasks."
DESCRIPTIONS["gpt-5.5"]="OpenAI's most capable model. Unrivaled in accuracy, creativity, and deep analysis across any complex task."
DESCRIPTIONS["gpt-5.4"]="Powerful and versatile. Delivers high-quality results and stable performance in coding, writing, and analysis."
DESCRIPTIONS["gpt-5.3-codex"]="A coding-specialized model. Exceptionally skilled in programming, debugging, and software design."

declare -A TAGS_MAP
TAGS_MAP["claude-fable-5"]="anthropic,claude,flagship"
TAGS_MAP["claude-opus-4.8"]="anthropic,claude,opus"
TAGS_MAP["claude-opus-4.7"]="anthropic,claude,opus"
TAGS_MAP["claude-opus-4.6"]="anthropic,claude,opus"
TAGS_MAP["claude-sonnet-4.6"]="anthropic,claude,sonnet"
TAGS_MAP["claude-sonnet-4.5"]="anthropic,claude,sonnet"
TAGS_MAP["gemini-3.1-pro"]="google,gemini,pro"
TAGS_MAP["gemini-3-pro"]="google,gemini,pro"
TAGS_MAP["gemini-2.5-pro"]="google,gemini,pro"
TAGS_MAP["gemini-2.5-flash"]="google,gemini,flash"
TAGS_MAP["grok-4.1"]="xai,grok,flagship"
TAGS_MAP["grok-4"]="xai,grok"
TAGS_MAP["grok-3"]="xai,grok"
TAGS_MAP["deepseek-v4-pro"]="deepseek,pro"
TAGS_MAP["deepseek-r1"]="deepseek,reasoning"
TAGS_MAP["deepseek-v4"]="deepseek"
TAGS_MAP["deepseek-v3"]="deepseek"
TAGS_MAP["gpt-5.5"]="openai,gpt,flagship"
TAGS_MAP["gpt-5.4"]="openai,gpt"
TAGS_MAP["gpt-5.3-codex"]="openai,gpt,codex,coding"

TS=$(date +%s)
for MODEL_ID in "${!DESCRIPTIONS[@]}"; do
  DESC="${DESCRIPTIONS[$MODEL_ID]}"
  TAGS="${TAGS_MAP[$MODEL_ID]}"
  RESULT=$($PSQL -t -c "
INSERT INTO models(model_name, description, tags, status, created_time, updated_time)
VALUES('${MODEL_ID}', '${DESC}', '${TAGS}', 1, ${TS}, ${TS})
ON CONFLICT (model_name, deleted_at) DO UPDATE SET description='${DESC}', tags='${TAGS}', updated_time=${TS};
" 2>&1)
  if echo "$RESULT" | grep -q "INSERT\|UPDATE"; then
    echo "  ✅ Model entry: ${MODEL_ID}"
  else
    echo "  ⚠️  ${MODEL_ID}: $RESULT"
  fi
done

echo ""
echo "══════════════════════════════════════════════"
echo "✅ All done! Pricing + Descriptions updated."
echo "══════════════════════════════════════════════"
