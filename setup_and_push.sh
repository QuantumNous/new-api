#!/bin/bash

# VIP功能推送脚本
# 使用方法: ./setup_and_push.sh YOUR_GITHUB_USERNAME

set -e

if [ -z "$1" ]; then
    echo "❌ 请提供您的GitHub用户名"
    echo "使用方法: ./setup_and_push.sh YOUR_GITHUB_USERNAME"
    echo ""
    echo "例如: ./setup_and_push.sh TianTian-O1"
    exit 1
fi

GITHUB_USERNAME="$1"
echo "🔧 配置GitHub用户名: $GITHUB_USERNAME"

# 配置origin为您的fork
echo "📤 添加您的fork作为origin..."
git remote add origin "https://github.com/$GITHUB_USERNAME/new-api.git"

# 验证配置
echo "✅ 远程仓库配置:"
git remote -v

# 推送代码
echo ""
echo "🚀 推送VIP功能分支到您的fork..."
git push -u origin feature/vip-upgrade-system

echo ""
echo "🎉 推送成功！"
echo ""
echo "📋 下一步："
echo "1. 访问 https://github.com/$GITHUB_USERNAME/new-api"
echo "2. 点击 'Compare & pull request' 按钮"
echo "3. 使用 PR_DESCRIPTION.md 中的内容作为PR描述"
echo "4. 提交PR到 Calcium-Ion/new-api"
echo ""
echo "📄 PR标题: feat: 添加VIP用户升级系统"
echo "📄 PR描述: 请复制 PR_DESCRIPTION.md 文件内容"
