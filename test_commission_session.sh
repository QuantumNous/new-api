#!/bin/bash

# 返佣系统测试（基于 session cookie）
BASE_URL="http://localhost:3001"
COOKIE_JAR="/tmp/commission_test_cookies.txt"

echo "=========================================="
echo "  返佣系统 Session 认证测试"
echo "=========================================="
echo ""

# 清理旧的 cookie
rm -f "$COOKIE_JAR"

# 1. 注册邀请人
echo "【步骤 1】注册邀请人..."
curl -s -X POST "$BASE_URL/api/user/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_session","password":"Inviter123456","email":"inviter_session@test.com"}' \
  -c "$COOKIE_JAR"
echo ""
echo ""

# 2. 邀请人登录（保存 session cookie）
echo "【步骤 2】邀请人登录..."
curl -s -X POST "$BASE_URL/api/user/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"inviter_session","password":"Inviter123456"}' \
  -c "$COOKIE_JAR"
echo ""
echo ""

# 3. 使用 session 获取用户信息
echo "【步骤 3】获取用户信息（使用 session）..."
curl -s "$BASE_URL/api/user/self" \
  -b "$COOKIE_JAR"
echo ""
echo ""

# 4. 查看返佣信息
echo "【步骤 4】查看返佣信息..."
curl -s "$BASE_URL/api/user/commission/info" \
  -b "$COOKIE_JAR"
echo ""
echo ""

# 5. 查看返佣日志
echo "【步骤 5】查看返佣日志..."
curl -s "$BASE_URL/api/user/commission/logs" \
  -b "$COOKIE_JAR"
echo ""
echo ""

# 6. 查看返佣统计
echo "【步骤 6】查看返佣统计..."
curl -s "$BASE_URL/api/user/commission/stats" \
  -b "$COOKIE_JAR"
echo ""
echo ""

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
echo ""
echo "说明："
echo "  - 服务地址: http://localhost:3001"
echo "  - 认证方式: Session Cookie"
echo "  - Cookie 文件: $COOKIE_JAR"
echo ""
echo "浏览器访问："
echo "  打开 http://localhost:3001 进行可视化测试"
