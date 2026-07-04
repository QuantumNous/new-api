#!/bin/bash

# 返佣系统简单测试脚本（不依赖 jq）
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "  返佣系统本地验证测试（简单版）"
echo "=========================================="
echo ""

# 1. 检查服务状态
echo "1. 检查服务状态..."
curl -s "$BASE_URL/api/status" > /dev/null && echo "✅ 服务运行正常" || echo "❌ 服务未启动"
echo ""

# 2. 注册邀请人
echo "2. 注册邀请人（inviter）..."
INVITER_REG=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "inviter_'$(date +%s)'",
    "password": "Inviter123456",
    "email": "inviter@test.com"
  }')
echo "注册结果: $INVITER_REG"
echo ""

# 3. 邀请人登录
echo "3. 邀请人登录..."
INVITER_LOGIN=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "inviter_'$(date +%s)'",
    "password": "Inviter123456"
  }')
echo "登录结果: $INVITER_LOGIN"
echo ""

# 4. 查看用户信息（获取邀请码）
echo "4. 查看用户信息..."
USER_INFO=$(curl -s "$BASE_URL/api/user/self" \
  -H "Authorization: Bearer $INVITER_TOKEN")
echo "用户信息: $USER_INFO"
echo ""

# 5. 查看返佣信息
echo "5. 查看返佣信息..."
COMMISSION_INFO=$(curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $INVITER_TOKEN")
echo "返佣信息: $COMMISSION_INFO"
echo ""

# 6. 查看返佣日志
echo "6. 查看返佣日志..."
COMMISSION_LOGS=$(curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $INVITER_TOKEN")
echo "返佣日志: $COMMISSION_LOGS"
echo ""

echo "=========================================="
echo "  测试完成"
echo "=========================================="
