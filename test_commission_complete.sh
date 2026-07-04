#!/bin/bash

# 返佣系统完整测试（正确的认证方式）
BASE_URL="http://localhost:3001"
COOKIE_JAR="/tmp/commission_test_cookies.txt"

echo "=========================================="
echo "  返佣系统完整验证"
echo "=========================================="
echo ""

# 清理旧的 cookie
rm -f "$COOKIE_JAR"

# 1. 注册邀请人
echo "【步骤 1】注册邀请人..."
REGISTER_RESULT=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_complete","password":"Inviter123456","email":"inviter_complete@test.com"}' \
  -c "$COOKIE_JAR")
echo "$REGISTER_RESULT"
echo ""

# 2. 邀请人登录
echo "【步骤 2】邀请人登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_complete","password":"Inviter123456"}' \
  -c "$COOKIE_JAR")
echo "$LOGIN_RESULT"
echo ""

# 提取用户ID
USER_ID=$(echo "$LOGIN_RESULT" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "用户ID: $USER_ID"
echo ""

if [ -z "$USER_ID" ]; then
    echo "❌ 无法获取用户ID，测试终止"
    exit 1
fi

# 3. 获取用户信息（带完整认证）
echo "【步骤 3】获取用户信息..."
curl -s "$BASE_URL/api/user/self" \
  -b "$COOKIE_JAR" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 4. 查看返佣信息
echo "【步骤 4】查看返佣信息..."
curl -s "$BASE_URL/api/user/commission/info" \
  -b "$COOKIE_JAR" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 5. 查看返佣日志
echo "【步骤 5】查看返佣日志..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -b "$COOKIE_JAR" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 6. 查看返佣统计
echo "【步骤 6】查看返佣统计..."
curl -s "$BASE_URL/api/user/commission/stats" \
  -b "$COOKIE_JAR" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "=========================================="
echo "  ✅ 测试完成！"
echo "=========================================="
echo ""
echo "返佣系统已成功启动并可访问！"
echo ""
echo "服务信息："
echo "  - 地址: http://localhost:3001"
echo "  - 认证: Session + New-Api-User Header"
echo ""
echo "API 端点："
echo "  - GET /api/user/commission/info    (返佣信息)"
echo "  - GET /api/user/commission/logs    (返佣明细)"
echo "  - GET /api/user/commission/stats   (返佣统计)"
echo "  - POST /api/user/commission/transfer (转移额度)"
echo ""
echo "浏览器访问 http://localhost:3001 可进行可视化测试"
