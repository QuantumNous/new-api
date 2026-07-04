#!/bin/bash

# 返佣系统测试（使用 API Token）
BASE_URL="http://localhost:3001"
COOKIE_JAR="/tmp/commission_test_cookies.txt"

echo "=========================================="
echo "  返佣系统 API Token 测试"
echo "=========================================="
echo ""

# 清理旧的 cookie
rm -f "$COOKIE_JAR"

# 1. 注册用户
echo "【步骤 1】注册用户..."
curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"token_test","password":"Token123456","email":"token@test.com"}' \
  -c "$COOKIE_JAR"
echo ""
echo ""

# 2. 登录
echo "【步骤 2】用户登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"token_test","password":"Token123456"}' \
  -c "$COOKIE_JAR")
echo "$LOGIN_RESULT"
echo ""

# 提取用户ID
USER_ID=$(echo "$LOGIN_RESULT" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "用户ID: $USER_ID"
echo ""

# 3. 创建 API Token
echo "【步骤 3】创建 API Token..."
TOKEN_RESULT=$(curl -s -X POST "$BASE_URL/api/token/" \
  -H "Content-Type: application/json" \
  -H "New-Api-User: $USER_ID" \
  -b "$COOKIE_JAR" \
  -d "{
    \"name\": \"commission_test_token\",
    \"remain_quota\": 1000000,
    \"expired_time\": -1,
    \"unlimited_quota\": true
  }")
echo "$TOKEN_RESULT"
echo ""

# 提取 API Token
API_TOKEN=$(echo "$TOKEN_RESULT" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
echo "API Token: $API_TOKEN"
echo ""

if [ -z "$API_TOKEN" ]; then
    echo "❌ 无法创建 API Token，尝试直接访问..."
    # 尝试查看现有的 tokens
    echo "【查看现有 Tokens】"
    curl -s "$BASE_URL/api/token/?p=0&size=10" \
      -H "New-Api-User: $USER_ID" \
      -b "$COOKIE_JAR"
    echo ""
    exit 1
fi

# 4. 使用 API Token 获取返佣信息
echo "【步骤 4】使用 API Token 获取返佣信息..."
curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 5. 获取返佣日志
echo "【步骤 5】获取返佣日志..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 6. 获取返佣统计
echo "【步骤 6】获取返佣统计..."
curl -s "$BASE_URL/api/user/commission/stats" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 7. 获取消费记录
echo "【步骤 7】获取消费返佣记录..."
curl -s "$BASE_URL/api/user/commission/consumption" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "=========================================="
echo "  ✅ 测试完成！"
echo "=========================================="
echo ""
echo "保存以下信息用于后续测试："
echo "  用户ID: $USER_ID"
echo "  API Token: $API_TOKEN"
echo ""
echo "使用 API Token 的命令格式："
echo "  curl -H 'Authorization: Bearer $API_TOKEN' \\"
echo "       -H 'New-Api-User: $USER_ID' \\"
echo "       $BASE_URL/api/user/commission/info"
