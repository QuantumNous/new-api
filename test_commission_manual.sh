#!/bin/bash

# 返佣系统手动测试脚本（带详细输出）
BASE_URL="http://localhost:3001"

echo "=========================================="
echo "  返佣系统完整验证测试"
echo "=========================================="
echo ""

# 1. 注册邀请人
echo "【步骤 1】注册邀请人..."
REGISTER_RESULT=$(curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_manual","password":"Inviter123456","email":"inviter_manual@test.com"}')
echo "注册结果: $REGISTER_RESULT"
echo ""

# 2. 邀请人登录
echo "【步骤 2】邀请人登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_manual","password":"Inviter123456"}')
echo "登录结果: $LOGIN_RESULT"
echo ""

# 3. 提取 token
echo "【步骤 3】提取 Token..."
# 尝试多种方式提取 token
INVITER_TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$INVITER_TOKEN" ]; then
    echo "尝试其他方式提取..."
    INVITER_TOKEN=$(echo "$LOGIN_RESULT" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
fi
echo "提取到的 Token: $INVITER_TOKEN"
echo ""

if [ -z "$INVITER_TOKEN" ]; then
    echo "❌ 无法提取 Token，测试终止"
    exit 1
fi

# 4. 获取用户信息
echo "【步骤 4】获取用户信息..."
curl -s "$BASE_URL/api/user/self" \
  -H "Authorization: Bearer $INVITER_TOKEN" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 5. 查看返佣信息
echo "【步骤 5】查看返佣信息..."
curl -s "$BASE_URL/api/user/commission/info" \
  -H "Authorization: Bearer $INVITER_TOKEN" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 6. 查看返佣日志
echo "【步骤 6】查看返佣日志..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -H "Authorization: Bearer $INVITER_TOKEN" \
  -H "Content-Type: application/json"
echo ""
echo ""

# 7. 查看返佣统计
echo "【步骤 7】查看返佣统计..."
curl -s "$BASE_URL/api/user/commission/stats" \
  -H "Authorization: Bearer $INVITER_TOKEN" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "=========================================="
echo "  验证完成！"
echo "=========================================="
echo ""
echo "返佣系统 API 端点列表："
echo "  - GET  /api/user/commission/info    (获取返佣信息)"
echo "  - GET  /api/user/commission/logs    (获取返佣明细)"
echo "  - GET  /api/user/commission/stats   (获取返佣统计)"
echo "  - POST /api/user/commission/transfer (转移额度)"
echo ""
echo "服务地址: http://localhost:3001"
