#!/bin/bash

# 快速验证脚本：渠道重试避开已用渠道功能
# 用途：验证代码修改是否正确，无需完整部署

set -e

echo "========================================="
echo "  代码修改验证脚本"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_file() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# 检查文件存在
check_file_exists() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

echo "1. 检查后端代码修改..."
echo "-----------------------------------"

# 检查 common/constants.go
check_file "common/constants.go" "RetryAvoidUsedChannelEnabled" \
    "common/constants.go: 添加全局变量"

# 检查 model/option.go
check_file "model/option.go" "RetryAvoidUsedChannelEnabled.*FormatBool" \
    "model/option.go: 注册到 OptionMap"

check_file "model/option.go" "case.*RetryAvoidUsedChannelEnabled" \
    "model/option.go: 添加到 updateOptionMap"

# 检查 service/channel_select.go
check_file "service/channel_select.go" "UsedChannelIds.*map\[int\]struct" \
    "service/channel_select.go: 扩展 RetryParam 结构体"

check_file "service/channel_select.go" "func.*AddUsedChannel" \
    "service/channel_select.go: 添加 AddUsedChannel 方法"

check_file "service/channel_select.go" "func.*IsChannelUsed" \
    "service/channel_select.go: 添加 IsChannelUsed 方法"

# 检查 model/channel_cache.go
check_file "model/channel_cache.go" "GetRandomSatisfiedChannel.*excludeIds.*map\[int\]struct" \
    "model/channel_cache.go: 修改函数签名"

check_file "model/channel_cache.go" "if.*excluded.*excludeIds" \
    "model/channel_cache.go: 添加过滤逻辑"

# 检查 model/ability.go
check_file "model/ability.go" "GetChannel.*excludeIds.*map\[int\]struct" \
    "model/ability.go: 修改函数签名"

check_file "model/ability.go" "NOT IN.*excludeIdList" \
    "model/ability.go: 添加 SQL 过滤"

# 检查 controller/relay.go
check_file "controller/relay.go" "\"strconv\"" \
    "controller/relay.go: 添加 strconv 导入"

check_file "controller/relay.go" "RetryAvoidUsedChannelEnabled.*retryParam.GetRetry" \
    "controller/relay.go: 添加开关判断"

check_file "controller/relay.go" "retryParam.AddUsedChannel" \
    "controller/relay.go: 调用 AddUsedChannel"

echo ""
echo "2. 检查前端代码修改..."
echo "-----------------------------------"

# 检查 OperationSetting.jsx
check_file "web/src/components/settings/OperationSetting.jsx" "RetryAvoidUsedChannelEnabled.*false" \
    "OperationSetting.jsx: 添加到 inputs"

# 检查 SettingsMonitoring.jsx
check_file "web/src/pages/Setting/Operation/SettingsMonitoring.jsx" "RetryAvoidUsedChannelEnabled.*false" \
    "SettingsMonitoring.jsx: 添加到 inputs"

check_file "web/src/pages/Setting/Operation/SettingsMonitoring.jsx" "field=.*RetryAvoidUsedChannelEnabled" \
    "SettingsMonitoring.jsx: 添加开关控件"

# 检查国际化文件
check_file "web/src/i18n/locales/zh.json" "重试时避开已尝试渠道" \
    "zh.json: 添加中文文案"

check_file "web/src/i18n/locales/en.json" "Avoid used channels on retry" \
    "en.json: 添加英文文案"

echo ""
echo "3. 检查文档..."
echo "-----------------------------------"

# 检查文档文件
check_file_exists "/Users/liyifan20/Documents/个人知识库/百度/10、项目介绍/new-api/功能开发/02-渠道重试避开已用渠道-开发文档.md" \
    "开发文档存在"

check_file_exists "/Users/liyifan20/Documents/个人知识库/百度/10、项目介绍/new-api/功能开发/03-渠道重试避开已用渠道-自测文档.md" \
    "自测文档存在"

check_file_exists "/Users/liyifan20/Documents/个人知识库/百度/10、项目介绍/new-api/功能开发/04-部署和测试指南.md" \
    "部署指南存在"

check_file_exists "/Users/liyifan20/Documents/个人知识库/百度/10、项目介绍/new-api/功能开发/05-代码变更总结.md" \
    "变更总结存在"

echo ""
echo "4. 语法检查..."
echo "-----------------------------------"

# 检查 Go 语法（如果 Go 可用）
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    echo -e "${YELLOW}当前 Go 版本: $GO_VERSION${NC}"

    # 检查版本是否满足要求
    REQUIRED_VERSION="1.24.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        echo -e "${GREEN}✓${NC} Go 版本满足要求 (>= 1.24.0)"

        # 尝试编译检查
        echo "  正在进行编译检查..."
        if go build -o /tmp/new-api-test main.go 2>&1 | grep -q "error"; then
            echo -e "${RED}✗${NC} 编译检查失败，请查看错误信息"
            go build -o /tmp/new-api-test main.go 2>&1 | head -20
        else
            echo -e "${GREEN}✓${NC} 编译检查通过"
            rm -f /tmp/new-api-test
        fi
    else
        echo -e "${YELLOW}⚠${NC} Go 版本不满足要求 (需要 >= 1.24.0)"
        echo "  请升级 Go 版本或使用 Docker 构建"
    fi
else
    echo -e "${YELLOW}⚠${NC} Go 未安装，跳过编译检查"
fi

echo ""
echo "5. 前端构建检查..."
echo "-----------------------------------"

# 检查前端构建产物
if [ -d "web/dist" ]; then
    echo -e "${GREEN}✓${NC} 前端已构建 (web/dist 存在)"

    # 检查关键文件
    if [ -f "web/dist/index.html" ]; then
        echo -e "${GREEN}✓${NC} index.html 存在"
    else
        echo -e "${RED}✗${NC} index.html 不存在"
    fi
else
    echo -e "${YELLOW}⚠${NC} 前端未构建 (web/dist 不存在)"
    echo "  运行: cd web && bun run build"
fi

echo ""
echo "========================================="
echo "  验证完成"
echo "========================================="
echo ""
echo "下一步："
echo "1. 如果所有检查都通过，可以进行部署"
echo "2. 参考 04-部署和测试指南.md 进行部署"
echo "3. 参考 03-渠道重试避开已用渠道-自测文档.md 进行测试"
echo ""
echo "如果有检查失败："
echo "1. 查看具体的错误信息"
echo "2. 参考 05-代码变更总结.md 确认修改是否正确"
echo "3. 重新执行相应的修改步骤"
echo ""

