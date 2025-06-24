#!/bin/bash

# 测试脚本：验证 smart-sync.sh 的交互式提示是否正确显示文件名

cd /Users/zhao/Documents/workspace/coding/agi/new-api

echo "测试 smart-sync.sh 的交互式提示..."
echo ""

# 模拟用户输入：对前两个文件输入 'n'，然后取消整个同步
echo -e "y\nn\nn\nn\nn" | timeout 30 ./smart-sync.sh sync 2>&1 | head -50

echo ""
echo "测试完成！"
