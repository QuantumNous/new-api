#!/bin/bash

# 返佣系统本地测试脚本
# 使用方法: bash test_commission.sh

BASE_URL="http://localhost:3000"
ADMIN_TOKEN=""
INVITER_TOKEN=""
INVITEE_TOKEN=""

echo "=========================================="
echo "  返佣系统本地验证测试"
echo "=========================================="
echo ""

# 1. 检查服务状态
echo "1. 检查服务状态..."
STATUS=$(curl -s "$BASE_URL/api/status")
if echo "$STATUS" | grep -q "success"; then
    echo "✅ 服务运行正常"
else
    echo "❌ 服务未启动"
    exit 1
fi
echo ""

# 2. 注册管理员账号
echo "2. 注册管理员账号..."
ADMIN_REG=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_test",
    "password": "Admin123456",
    "email": "admin@test.com"
  }')
echo "$ADMIN_REG" | jq . 2>/dev/null || echo "$ADMIN_REG"
echo ""

# 3. 管理员登录
echo "3. 管理员登录..."
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_test",
    "password": "Admin123456"
  }')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.token' 2>/dev/null)
echo "Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# 4. 设置管理员权限（需要手动在数据库中设置或使用现有管理员）
echo "4. 提示：如果需要管理员权限，请手动设置用户权限"
echo ""

# 5. 注册邀请人
echo "5. 注册邀请人（inviter）..."
INVITER_REG=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "inviter_test",
    "password": "Inviter123456",
    "email": "inviter@test.com"
  }')
echo "$INVITER_REG" | jq . 2>/dev/null || echo "$INVITER_REG"
echo ""

# 6. 邀请人登录
echo "6. 邀请人登录..."
INVITER_LOGIN=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "inviter_test",
    "password": "Inviter123456"
  }')
INVITER_TOKEN=$(echo "$INVITER_LOGIN" | jq -r '.data.token' 2>/dev/null)
echo "Token: ${INVITER_TOKEN:0:20}..."
echo ""

# 7. 获取邀请人的邀请码
echo "7. 获取邀请人的邀请码..."
INVITER_INFO=$(curl -s "$BASE_URL/api/user/self" \
  -H "Authorization: Bearer $INVITER_TOKEN")
AFF_CODE=$(echo "$INVITER_INFO" | jq -r '.data.aff_code' 2>/dev/null)
echo "邀请码: $AFF_CODE"
echo ""

# 8. 使用邀请码注册被邀请人
echo "8. 使用邀请码注册被邀请人..."
INVITEE_REG=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"invitee_test\",
    \"password\": \"Invitee123456\",
    \"email\": \"invitee@test.com\",
    \"aff\": \"$AFF_CODE\"
  }")
echo "$INVITEE_REG" | jq . 2>/dev/null || echo "$INVITEE_REG"
echo ""

# 9. 被邀请人登录
echo "9. 被邀请人登录..."
INVITEE_LOGIN=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "invitee_test",
    "password": "Invitee123456"
  }')
INVITEE_TOKEN=$(echo "$INVITEE_LOGIN" | jq -r '.data.token' 2>/dev/null)
echo "Token: ${INVITEE_TOKEN:0:20}..."
echo ""

# 10. 查看邀请人的返佣信息（初始状态）
echo "10. 查看邀请人的返佣信息（初始状态）..."
curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $INVITER_TOKEN" | jq .
echo ""

# 11. 查看返佣日志（应该为空）
echo "11. 查看返佣日志（应该为空）..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $INVITER_TOKEN" | jq .
echo ""

echo "=========================================="
echo "  基础测试完成"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 需要配置返佣规则（通过管理后台）"
echo "2. 需要触发消费请求（通过API调用）"
echo "3. 消费后检查返佣是否自动触发"
echo ""
echo "可以使用以下命令查看返佣系统设计文档："
echo "cat COMMISSION_SYSTEM_DESIGN.md"
