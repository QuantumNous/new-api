#!/bin/bash

# 返佣系统完整验证脚本
BASE_URL="http://localhost:3001"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "  返佣系统本地验证"
echo "=========================================="
echo ""

# 1. 注册邀请人
echo "【1】注册邀请人..."
curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"inviter_$TIMESTAMP\",\"password\":\"Inviter123456\",\"email\":\"inviter@test.com\"}"
echo ""
echo ""

# 2. 邀请人登录
echo "【2】邀请人登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"inviter_$TIMESTAMP\",\"password\":\"Inviter123456\"}")
echo "$LOGIN_RESULT"
echo ""

# 提取 token
INVITER_TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${INVITER_TOKEN:0:30}..."
echo ""

# 3. 获取邀请人信息
echo "【3】获取邀请人信息..."
curl -s "$BASE_URL/api/user/self" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

# 4. 查看返佣信息
echo "【4】查看返佣信息..."
curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

# 5. 查看返佣日志
echo "【5】查看返佣日志..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

# 6. 查看返佣统计
echo "【6】查看返佣统计..."
curl -s "$BASE_URL/api/user/commission/stats" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
