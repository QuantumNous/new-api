#!/bin/bash

# 返佣系统完整测试流程
BASE_URL="http://localhost:3000"

echo "=========================================="
echo "  返佣系统完整测试流程"
echo "=========================================="
echo ""

# 1. 注册邀请人
echo "【步骤 1】注册邀请人..."
curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_test_1","password":"Inviter123456","email":"inviter@test.com"}'
echo ""
echo ""

# 2. 邀请人登录
echo "【步骤 2】邀请人登录..."
INVITER_LOGIN=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_test_1","password":"Inviter123456"}')
echo "$INVITER_LOGIN"
echo ""

# 3. 获取邀请人信息和邀请码
echo "【步骤 3】获取邀请人信息（包含邀请码）..."
# 先提取 token（简单字符串处理）
INVITER_TOKEN=$(echo "$INVITER_LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "Token: ${INVITER_TOKEN:0:30}..."
echo ""

# 获取用户信息
curl -s "$BASE_URL/api/user/self" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

# 4. 查看返佣信息（初始状态）
echo "【步骤 4】查看返佣信息（初始状态）..."
curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

# 5. 查看返佣日志
echo "【步骤 5】查看返佣日志（应该为空）..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $INVITER_TOKEN"
echo ""
echo ""

echo "=========================================="
echo "  基础测试完成"
echo "=========================================="
echo ""
echo "下一步需要："
echo "1. 获取邀请码"
echo "2. 使用邀请码注册被邀请人"
echo "3. 触发消费请求"
echo "4. 验证返佣是否自动计算"
