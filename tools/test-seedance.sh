#!/usr/bin/env bash
# test-seedance.sh — 端到端验证 Seedance 2.0 通过 aikanhub 转发
#
# 使用前提：
#   1. 已经在 admin 后台配好 doubao 渠道（type=DoubaoVideo, models 含 doubao-seedance-2-0-260128）
#   2. 已经创建一个用户 token，并通过环境变量传入：
#        export AIKANHUB_TOKEN=sk-xxxxxxxxxxxxxxxxxxxx
#   3. 服务在 http://localhost:3000 运行
#
# 用法：
#   bash tools/test-seedance.sh                      # 文生视频，默认 prompt
#   bash tools/test-seedance.sh "你的中文 prompt"      # 文生视频，自定义 prompt
#
# 流程：submit → 拿 task_id → 每 5s poll 一次 → 拿到视频 URL 退出

set -euo pipefail

BASE_URL="${AIKANHUB_BASE_URL:-http://localhost:3000}"
TOKEN="${AIKANHUB_TOKEN:?请先 export AIKANHUB_TOKEN=sk-xxx}"
MODEL="${AIKANHUB_MODEL:-doubao-seedance-2-0-fast-260128}"
PROMPT="${1:-一只橘猫慢慢从镜头前走过，背景是夕阳下的东京街道，4K，电影感}"

echo "==> Submitting task to $BASE_URL"
echo "    model:  $MODEL"
echo "    prompt: $PROMPT"
echo ""

submit_resp=$(curl -sS -X POST "$BASE_URL/v1/video/generations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "model": "$MODEL",
  "prompt": "$PROMPT",
  "size": "720p",
  "duration": 5,
  "metadata": {
    "ratio": "16:9"
  }
}
EOF
)")

echo "==> Submit response:"
echo "$submit_resp" | jq . 2>/dev/null || echo "$submit_resp"

task_id=$(echo "$submit_resp" | jq -r '.task_id // .id // empty' 2>/dev/null)

if [ -z "$task_id" ]; then
  echo ""
  echo "❌ 没拿到 task_id，检查上面的响应"
  exit 1
fi

echo ""
echo "==> task_id: $task_id"
echo "==> 开始轮询（每 5s 一次，最多 5 分钟）..."
echo ""

for i in $(seq 1 60); do
  sleep 5
  poll=$(curl -sS "$BASE_URL/v1/video/generations/$task_id" \
    -H "Authorization: Bearer $TOKEN")
  status=$(echo "$poll" | jq -r '.status // .data.status // empty' 2>/dev/null)
  echo "  [$((i*5))s] status=$status"

  case "$status" in
    succeeded|SUCCESS|success|completed)
      echo ""
      echo "✅ 完成！"
      echo "$poll" | jq . 2>/dev/null || echo "$poll"
      exit 0
      ;;
    failed|FAILED|failure|error)
      echo ""
      echo "❌ 失败"
      echo "$poll" | jq . 2>/dev/null || echo "$poll"
      exit 1
      ;;
  esac
done

echo ""
echo "⏰ 超时 5 分钟未完成，最后状态：$status"
exit 2
