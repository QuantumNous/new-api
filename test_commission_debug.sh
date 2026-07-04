#!/bin/bash

# 返佣系统调试测试
BASE_URL="http://localhost:3001"
COOKIE_JAR="/tmp/commission_debug_cookies.txt"

echo "=========================================="
echo "  返佣系统调试测试"
echo "=========================================="
echo ""

rm -f "$COOKIE_JAR"

# 注册并登录
echo "【1】注册用户..."
curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"debug_test","password":"Debug123456","email":"debug@test.com"}' \
  -c "$COOKIE_JAR"
echo ""

echo "【2】登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"debug_test","password":"Debug123456"}' \
  -c "$COOKIE_JAR")
echo "$LOGIN_RESULT" | grep -o '"id":[0-9]*' | head -1
USER_ID=$(echo "$LOGIN_RESULT" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "User ID: $USER_ID"
echo ""

# 创建 token 并保存完整响应
echo "【3】创建 API Token（完整响应）..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/token/" \
  -H "Content-Type: application/json" \
  -H "New-Api-User: $USER_ID" \
  -b "$COOKIE_JAR" \
  -d '{
    "name": "debug_token",
    "remain_quota": 1000000,
    "expired_time": -1,
    "unlimited_quota": true
  }')
echo "创建响应: $TOKEN_RESPONSE"
echo ""

# 直接测试返佣 API（不带 token，看看错误信息）
echo "【4】测试返佣 API（无认证）..."
curl -s "$BASE_URL/api/user/commission/info"
echo ""
echo ""

# 使用 session cookie 测试（带 New-Api-User）
echo "【5】测试返佣 API（session + header）..."
curl -s "$BASE_URL/api/user/commission/info" \
  -b "$COOKIE_JAR" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 查看数据库中的token
echo "【6】查看数据库中的 Tokens..."
TOKENS=$(curl -s "$BASE_URL/api/token/?p=0&size=10" \
  -H "New-Api-User: $USER_ID" \
  -b "$COOKIE_JAR")
echo "$TOKENS"
echo ""

# 提取 token key 的前缀
TOKEN_PREFIX=$(echo "$TOKENS" | grep -o '"key":"[^"]*"' | cut -d'"' -f4 | cut -d'*' -f1)
echo "Token前缀: $TOKEN_PREFIX"
echo ""

echo "=========================================="
echo "  调试完成"
echo "=========================================="
