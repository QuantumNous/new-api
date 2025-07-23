#!/bin/bash

# Claude Code Launcher Script
# Version: 2.0.4

# 版本信息
VERSION="2.0.4"
REMOTE_SCRIPT_URL="https://res.vibebob.com/cc/cc_launcher.sh"

# API 推荐模型列表（适用于 API 接入）
declare -a API_RECOMMENDED_MODELS=(
    "claude-sonnet-4-20250514"
    "claude-3-5-sonnet-20241022"
    "claude-3-5-haiku-20241022"
    "claude-3-opus-20240229"
)

# Claude Code 可用模型列表（适用于账户接入）
declare -a CLAUDE_CODE_MODELS=(
    "claude-sonnet-4-20250514"
    "claude-3-5-sonnet-20241022"
    "claude-3-5-haiku-20241022"
)

# 设置默认的 ANTHROPIC_BASE_URL（仅在需要时设置）
ANTHROPIC_BASE_URL_DEFAULT="https://aihubmax.com"
# 注意：ANTHROPIC_BASE_URL 将在选择接入方式后设置

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检测配置文件中是否有指定的环境变量
check_env_in_files() {
    local var_name=$1
    local files=("$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc")
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]] && grep -q "export $var_name=" "$file"; then
            return 0
        fi
    done
    return 1
}

# 添加环境变量到配置文件
add_to_config_files() {
    local var_name=$1
    local var_value=$2
    local files=("$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc")
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            # 如果变量已存在，先删除旧的
            sed -i.bak "/export $var_name=/d" "$file" 2>/dev/null || sed -i '' "/export $var_name=/d" "$file"
            # 添加新的
            echo "export $var_name=\"$var_value\"" >> "$file"
            print_info "已添加 $var_name 到 $file"
        fi
    done
}

# 激活配置文件
source_config_files() {
    if [[ -f "$HOME/.bash_profile" ]]; then
        source "$HOME/.bash_profile" 2>/dev/null
    fi
    if [[ -f "$HOME/.bashrc" ]]; then
        source "$HOME/.bashrc" 2>/dev/null
    fi
    if [[ -f "$HOME/.zshrc" ]]; then
        source "$HOME/.zshrc" 2>/dev/null
    fi
}

# 测试 API 密钥
test_api_key() {
    local api_key=$1
    print_info "正在验证 API 密钥..."
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "\n%{http_code}" --location --request POST "$ANTHROPIC_BASE_URL/v1/messages" \
        --header "x-api-key: $api_key" \
        --header "anthropic-version: 2023-06-01" \
        --header "content-type: application/json" \
        --data-raw '{
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": [
                {"role": "user", "content": "Hello, world"}
            ]
        }' 2>/dev/null)
    
    local end_time=$(date +%s.%N)
    local elapsed=$(echo "$end_time - $start_time" | bc)
    
    # 分离响应体和 HTTP 状态码
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]] && echo "$body" | grep -q '"type":"message"'; then
        print_success "API 密钥验证成功！"
        printf "${GREEN}请求耗时: %.2f 秒${NC}\n" "$elapsed"
        return 0
    else
        print_error "API 密钥验证失败！"
        if [[ -n "$body" ]]; then
            print_error "错误信息: $body"
        fi
        return 1
    fi
}

# 测试自定义模型ID
test_custom_model() {
    local model_id=$1
    local api_key=$2
    print_info "正在验证模型ID: $model_id..."
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "\n%{http_code}" --location --request POST "$ANTHROPIC_BASE_URL/v1/messages" \
        --header "x-api-key: $api_key" \
        --header "anthropic-version: 2023-06-01" \
        --header "content-type: application/json" \
        --data-raw '{
            "model": "'"$model_id"'",
            "max_tokens": 1024,
            "messages": [
                {"role": "user", "content": "Hello"}
            ]
        }' 2>/dev/null)
    
    local end_time=$(date +%s.%N)
    local elapsed=$(echo "$end_time - $start_time" | bc)
    
    # 分离响应体和 HTTP 状态码
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]] && echo "$body" | grep -q '"type":"message"'; then
        print_success "模型ID验证成功！"
        printf "${GREEN}请求耗时: %.2f 秒${NC}\n" "$elapsed"
        return 0
    else
        print_error "模型ID验证失败！"
        if [[ -n "$body" ]]; then
            print_error "错误信息: $body"
        fi
        return 1
    fi
}

# 显示API推荐模型列表
show_api_models() {
    echo ""
    echo "API 推荐模型列表："
    for i in "${!API_RECOMMENDED_MODELS[@]}"; do
        echo "$((i+1)). ${API_RECOMMENDED_MODELS[$i]}"
    done
    echo "$((${#API_RECOMMENDED_MODELS[@]}+1)). 手动输入模型ID"
}

# 显示Claude Code可用模型列表
show_claude_code_models() {
    echo ""
    echo "Claude Code 可用模型列表："
    for i in "${!CLAUDE_CODE_MODELS[@]}"; do
        echo "$((i+1)). ${CLAUDE_CODE_MODELS[$i]}"
    done
}

# 显示自定义命令参数说明
show_custom_command_help() {
    echo ""
    echo "常用 Claude Code 启动参数："
    echo "┌─────────────────────────────────┬──────────────────────┬─────────────────────────────────────┐"
    echo "│ 标志                            │ 描述                 │ 示例                                │"
    echo "├─────────────────────────────────┼──────────────────────┼─────────────────────────────────────┤"
    echo "│ --model MODEL_ID                │ 指定模型ID           │ claude --model claude-sonnet-4     │"
    echo "│ --dangerously-skip-permissions  │ 跳过权限检查         │ claude --dangerously-skip-permissions│"
    echo "│ --resume                        │ 继续上次对话         │ claude --resume                     │"
    echo "│ --help                          │ 显示帮助信息         │ claude --help                       │"
    echo "└─────────────────────────────────┴──────────────────────┴─────────────────────────────────────┘"
}

# 读取单个字符输入（无需回车）
read_single_char() {
    local prompt="$1"
    local default="$2"
    local char=""
    
    # 显示提示信息
    if [[ -n "$prompt" ]]; then
        if [[ -n "$default" ]]; then
            echo -n "$prompt [$default]: "
        else
            echo -n "$prompt: "
        fi
    fi
    
    # 保存当前终端设置
    local old_stty=$(stty -g)
    
    # 设置终端为原始模式，关闭回显
    stty raw -echo
    
    # 读取单个字符
    char=$(dd bs=1 count=1 2>/dev/null)
    
    # 恢复终端设置
    stty "$old_stty"
    
    # 处理回车键（ASCII 13 或 10）
    if [[ "$char" == $'\r' ]] || [[ "$char" == $'\n' ]]; then
        if [[ -n "$default" ]]; then
            char="$default"
        fi
    fi
    
    # 显示用户输入的字符（除非是特殊字符）
    if [[ "$char" =~ [[:print:]] ]]; then
        echo "$char" >&2
    else
        echo "" >&2
    fi
    
    # 返回字符
    echo "$char"
}

# 读取有效选项的单个字符输入
read_valid_option() {
    local prompt="$1"
    local default="$2"
    local valid_options="$3"  # 有效选项，如 "1234"
    local char=""
    
    # 设置 Ctrl+C 信号处理
    trap 'echo ""; print_info "用户取消操作，退出脚本"; exit 0' INT
    
    while true; do
        # 显示提示信息
        if [[ -n "$prompt" ]]; then
            if [[ -n "$default" ]]; then
                echo -n "$prompt [$default]: " >&2
            else
                echo -n "$prompt: " >&2
            fi
        fi
        
        # 保存当前终端设置
        local old_stty=$(stty -g)
        
        # 设置终端为原始模式，关闭回显
        stty raw -echo
        
        # 读取单个字符
        char=$(dd bs=1 count=1 2>/dev/null)
        
        # 恢复终端设置
        stty "$old_stty"
        
        # 检查是否是 Ctrl+C (ASCII 3)
        if [[ $(printf "%d" "'$char") -eq 3 ]]; then
            echo "" >&2
            print_info "用户取消操作，退出脚本"
            exit 0
        fi
        
        # 处理回车键（ASCII 13 或 10）
        if [[ "$char" == $'\r' ]] || [[ "$char" == $'\n' ]]; then
            if [[ -n "$default" ]]; then
                char="$default"
                echo "$char" >&2
                break
            else
                echo "" >&2
                continue
            fi
        fi
        
        # 检查是否为有效选项
        if [[ "$valid_options" == *"$char"* ]]; then
            echo "$char" >&2
            break
        else
            # 无效输入，清除当前行并重新提示
            echo -ne "\r\033[K" >&2
        fi
    done
    
    # 清除信号处理
    trap - INT
    
    # 返回字符（只返回字符，不包含提示信息）
    echo "$char"
}

# 显示loading动画
show_loading() {
    local message="$1"
    local duration="$2"
    local pid="$3"
    
    local spinner="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local i=0
    
    # 隐藏光标
    echo -ne "\033[?25l"
    
    while [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; do
        local spin_char=${spinner:$i:1}
        echo -ne "\r${BLUE}[INFO]${NC} $message $spin_char"
        sleep 0.1
        i=$(( (i + 1) % ${#spinner} ))
    done
    
    # 恢复光标
    echo -ne "\033[?25h"
    echo -ne "\r\033[K"
}

# 带loading的curl请求
curl_with_loading() {
    local url="$1"
    local message="$2"
    local timeout="$3"
    local max_time="$4"
    
    # 启动后台curl进程
    local temp_file=$(mktemp)
    curl -s --connect-timeout "$timeout" --max-time "$max_time" "$url" > "$temp_file" 2>/dev/null &
    local curl_pid=$!
    
    # 显示loading动画
    local spinner="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local i=0
    
    # 隐藏光标
    echo -ne "\033[?25l"
    
    # 立即显示第一个loading状态
    echo -ne "\r${BLUE}[INFO]${NC} $message ⠋"
    
    while kill -0 "$curl_pid" 2>/dev/null; do
        local spin_char=${spinner:$i:1}
        echo -ne "\r${BLUE}[INFO]${NC} $message $spin_char"
        sleep 0.1
        i=$(( (i + 1) % ${#spinner} ))
    done
    
    # 等待curl完成
    wait "$curl_pid"
    local exit_code=$?
    
    # 恢复光标并清除loading行
    echo -ne "\033[?25h"
    echo -ne "\r\033[K"
    
    # 显示完成状态
    if [[ $exit_code -eq 0 ]]; then
        print_info "${message%...}完成"
    else
        print_error "${message%...}失败"
    fi
    
    # 输出结果
    if [[ $exit_code -eq 0 ]]; then
        cat "$temp_file"
        rm -f "$temp_file"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# 版本比较函数（语义化版本号比较）
compare_versions() {
    local version1="$1"
    local version2="$2"
    
    # 检查输入是否为空或包含非版本号内容
    if [[ -z "$version1" || -z "$version2" ]]; then
        return 0  # 如果有空值，认为相等
    fi
    
    # 检查是否包含非版本号内容（如果包含空格或其他字符，可能是错误信息）
    if [[ "$version1" =~ [[:space:]] || "$version2" =~ [[:space:]] ]]; then
        return 0  # 如果包含空格，可能是错误信息，认为相等
    fi
    
    # 移除可能的前缀字符（如 v）
    version1=$(echo "$version1" | sed 's/^[vV]//')
    version2=$(echo "$version2" | sed 's/^[vV]//')
    
    # 分割版本号
    IFS='.' read -ra VER1 <<< "$version1"
    IFS='.' read -ra VER2 <<< "$version2"
    
    # 确保版本号数组长度一致，不足的补0
    while [ ${#VER1[@]} -lt 3 ]; do VER1+=(0); done
    while [ ${#VER2[@]} -lt 3 ]; do VER2+=(0); done
    
    # 逐位比较
    for i in {0..2}; do
        local v1=${VER1[i]:-0}
        local v2=${VER2[i]:-0}
        
        # 确保是数字
        if ! [[ "$v1" =~ ^[0-9]+$ ]]; then v1=0; fi
        if ! [[ "$v2" =~ ^[0-9]+$ ]]; then v2=0; fi
        
        if [ "$v1" -gt "$v2" ]; then
            return 1  # version1 > version2
        elif [ "$v1" -lt "$v2" ]; then
            return 2  # version1 < version2
        fi
    done
    
    return 0  # version1 == version2
}

# 获取线上版本号
get_remote_version() {
    local remote_version=""
    local max_retries=3
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        if [[ $retry_count -gt 0 ]]; then
            print_warning "获取版本信息失败，1秒后重试... ($((retry_count + 1))/$max_retries)"
            sleep 1
        fi
        
        # 尝试获取线上脚本的版本号（带loading动画）
        local curl_result
        if [[ $retry_count -eq 0 ]]; then
            curl_result=$(curl_with_loading "$REMOTE_SCRIPT_URL" "正在获取最新版本信息..." 5 10)
        else
            print_info "重试获取版本信息..."
            curl_result=$(curl -s --connect-timeout 5 --max-time 10 "$REMOTE_SCRIPT_URL")
        fi
        
        if [[ -n "$curl_result" ]]; then
            remote_version=$(echo "$curl_result" | grep '^# Version:' | head -1 | sed 's/# Version: //')
            if [[ -n "$remote_version" ]]; then
                echo "$remote_version"
                return 0
            fi
        fi
        
        retry_count=$((retry_count + 1))
    done
    
    print_error "无法获取线上版本信息（已重试 $max_retries 次）"
    return 1
}

# 下载并更新脚本
update_script() {
    local script_path="$0"
    local temp_file=$(mktemp)
    
    print_info "正在下载最新版本..."
    
    # 下载最新版本到临时文件（带loading动画）
    local download_result=$(curl_with_loading "$REMOTE_SCRIPT_URL" "正在下载最新版本..." 10 30)
    
    if [[ -n "$download_result" ]]; then
        echo "$download_result" > "$temp_file"
        
        # 验证下载的文件是否是有效的 bash 脚本
        if bash -n "$temp_file" 2>/dev/null; then
            # 获取原文件权限
            local file_perms=$(stat -f "%A" "$script_path" 2>/dev/null || stat -c "%a" "$script_path" 2>/dev/null)
            
            # 原子操作：替换文件
            if mv "$temp_file" "$script_path"; then
                # 恢复执行权限
                chmod "$file_perms" "$script_path" 2>/dev/null || chmod +x "$script_path"
                print_success "脚本更新成功！"
                print_info "正在重新启动脚本..."
                echo ""
                
                # 重新启动脚本
                exec "$script_path" "$@"
            else
                print_error "更新失败：无法替换脚本文件"
                rm -f "$temp_file"
                return 1
            fi
        else
            print_error "更新失败：下载的文件不是有效的脚本"
            rm -f "$temp_file"
            return 1
        fi
    else
        print_error "更新失败：无法下载最新版本"
        rm -f "$temp_file"
        return 1
    fi
}

# 检查并更新版本
check_and_update() {
    print_info "检查脚本版本..."
    print_info "当前版本: $VERSION"
    print_info "正在检查最新版本..."
    
    # 获取线上版本
    local remote_version=$(get_remote_version)
    
    if [[ $? -eq 0 && -n "$remote_version" ]]; then
        print_info "线上版本: $remote_version"
        
        # 比较版本
        compare_versions "$VERSION" "$remote_version"
        local comparison_result=$?
        
        if [[ $comparison_result -eq 2 ]]; then
            # 本地版本 < 线上版本
            print_warning "发现新版本！"
            echo ""
            echo "当前版本: $VERSION"
            echo "最新版本: $remote_version"
            echo ""
            print_info "正在自动更新到最新版本..."
            
            update_script "$@"
        elif [[ $comparison_result -eq 1 ]]; then
            # 本地版本 > 线上版本
            print_info "当前版本较新，无需更新"
        else
            # 版本相同
            print_success "当前已是最新版本"
        fi
    else
        print_info "继续使用本地版本: $VERSION"
    fi
    
    echo ""
}

# 主程序开始
print_info "Claude Code Launcher 启动中..."

# 版本检查（如果不是在更新过程中）
if [[ "$1" != "--skip-update" ]]; then
    check_and_update "$@"
fi

# 先加载配置文件以确保环境变量可用
source_config_files

# 检测环境变量中是否有 ANTHROPIC_API_KEY
if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    print_warning "检测到环境变量中存在 ANTHROPIC_API_KEY"
    print_info "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
else
    print_info "未检测到环境变量中的 ANTHROPIC_API_KEY"
fi

# 检测环境变量中是否有 ANTHROPIC_BASE_URL
if [[ -n "$ANTHROPIC_BASE_URL" ]]; then
    print_warning "检测到环境变量中存在 ANTHROPIC_BASE_URL"
    print_info "ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
else
    print_info "未检测到环境变量中的 ANTHROPIC_BASE_URL"
fi

# 无论是否检测到，都显示选择菜单
echo ""
echo "请选择接入方式："
echo "1:API接入（默认）"
echo "2:Claude Code账户登录"
echo ""
choice=$(read_valid_option "请输入选项" "1" "12")
choice=${choice:-1}

# 调试信息
print_info "用户选择: '$choice'"

# 记录接入方式用于后续的自定义模型选择
ACCESS_MODE=""
if [[ "$choice" == "2" ]]; then
    print_info "使用账户登录模式，检查环境变量状态..."
    
    # 检查当前环境变量状态
    if [[ -n "$ANTHROPIC_API_KEY" ]]; then
        print_warning "检测到环境变量 ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
        print_info "账户登录模式下，保留配置文件中的环境变量设置"
    else
        print_info "环境变量 ANTHROPIC_API_KEY 不存在"
    fi
    
    if [[ -n "$ANTHROPIC_BASE_URL" ]]; then
        print_warning "检测到环境变量 ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
        print_info "账户登录模式下，保留配置文件中的环境变量设置"
    else
        print_info "环境变量 ANTHROPIC_BASE_URL 不存在"
    fi
    
    # 在账户登录模式下，只清除当前会话的环境变量，不影响配置文件
    # 这样 Claude Code 可以使用账户登录，但配置文件中的设置得以保留
    unset ANTHROPIC_API_KEY
    unset ANTHROPIC_BASE_URL
    
    print_info "已清除当前会话的 API 环境变量，保留配置文件设置"
    print_success "可以使用账户登录模式"
    ACCESS_MODE="account"
else
    ACCESS_MODE="api"
fi

# API 接入模式
if [[ "$choice" == "1" ]]; then
    print_info "使用 API 接入模式"
    
    # 步骤 3.1：环境变量配置方式选择
    echo ""
    echo "请选择环境变量的配置方式："
    echo "1. 使用临时环境变量（本次会话有效）"
    echo "2. 使用全局配置文件（永久保存）"
    
    # 如果检测到现有的环境变量，显示第三个选项
    if [[ -n "$ANTHROPIC_API_KEY" && -n "$ANTHROPIC_BASE_URL" ]]; then
        echo "3. 使用现有的环境变量（已检测到配置）"
        echo ""
        config_choice=$(read_valid_option "请输入选项" "3" "123")
        config_choice=${config_choice:-3}
    else
        echo ""
        config_choice=$(read_valid_option "请输入选项" "2" "12")
        config_choice=${config_choice:-2}
    fi
    
    # 步骤 3.2：配置 API 环境变量
    if [[ "$config_choice" == "3" ]]; then
        # 使用现有的环境变量
        print_info "使用现有环境变量模式"
        print_info "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..."
        print_info "ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
        
        # 验证现有的 API 密钥
        if test_api_key "$ANTHROPIC_API_KEY"; then
            print_success "现有环境变量验证成功！"
        else
            print_error "现有环境变量验证失败，请检查配置"
            exit 1
        fi
        
    elif [[ "$config_choice" == "1" ]]; then
        # 临时环境变量配置
        print_info "使用临时环境变量配置模式"
        
        # 设置临时 BASE_URL
        export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_DEFAULT"
        print_info "已设置临时 ANTHROPIC_BASE_URL"
        
        # 获取 API 密钥
        api_key=""
        if [[ -n "$ANTHROPIC_API_KEY" ]]; then
            api_key="$ANTHROPIC_API_KEY"
            print_info "使用当前环境变量中的 API 密钥"
        elif check_env_in_files "ANTHROPIC_API_KEY"; then
            source_config_files
            api_key="$ANTHROPIC_API_KEY"
            print_info "使用配置文件中的 API 密钥"
        fi
        
        # 验证和设置 API 密钥
        while true; do
            if [[ -z "$api_key" ]]; then
                echo ""
                echo "（打开 https://www.aihubmax.com/console/token 获取API令牌）"
                read -p "请输入您的 API 令牌: " api_key
                if [[ -z "$api_key" ]]; then
                    print_error "API 令牌不能为空！"
                    continue
                fi
            fi
            
            # 测试 API 密钥
            if test_api_key "$api_key"; then
                # 设置临时环境变量
                export ANTHROPIC_API_KEY="$api_key"
                print_success "已设置临时 ANTHROPIC_API_KEY"
                break
            else
                api_key=""
                echo ""
                read -p "是否重新输入 API 令牌？[Y/n]: " retry
                if [[ "$retry" == "n" || "$retry" == "N" ]]; then
                    print_error "无法验证 API 密钥，退出程序"
                    exit 1
                fi
            fi
        done
        
    else
        # 全局配置文件配置
        print_info "使用全局配置文件配置模式"
        
        # 检查并设置 ANTHROPIC_BASE_URL
        if ! check_env_in_files "ANTHROPIC_BASE_URL"; then
            print_info "配置文件中未找到 ANTHROPIC_BASE_URL，正在设置..."
            add_to_config_files "ANTHROPIC_BASE_URL" "$ANTHROPIC_BASE_URL_DEFAULT"
            source_config_files
        else
            # 确保当前环境中有 BASE_URL
            if [[ -z "$ANTHROPIC_BASE_URL" ]]; then
                export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_DEFAULT"
            fi
        fi
        
        # 获取 API 密钥
        api_key=""
        if [[ -n "$ANTHROPIC_API_KEY" ]]; then
            api_key="$ANTHROPIC_API_KEY"
            print_info "使用当前环境变量中的 API 密钥"
        elif check_env_in_files "ANTHROPIC_API_KEY"; then
            source_config_files
            api_key="$ANTHROPIC_API_KEY"
            print_info "使用配置文件中的 API 密钥"
        fi
        
        # 验证和保存 API 密钥
        while true; do
            if [[ -z "$api_key" ]]; then
                echo ""
                echo "（打开 https://www.aihubmax.com/console/token 获取API令牌）"
                read -p "请输入您的 API 令牌: " api_key
                if [[ -z "$api_key" ]]; then
                    print_error "API 令牌不能为空！"
                    continue
                fi
            fi
            
            # 测试 API 密钥
            if test_api_key "$api_key"; then
                # 保存到配置文件
                add_to_config_files "ANTHROPIC_API_KEY" "$api_key"
                source_config_files
                export ANTHROPIC_API_KEY="$api_key"
                break
            else
                api_key=""
                echo ""
                read -p "是否重新输入 API 令牌？[Y/n]: " retry
                if [[ "$retry" == "n" || "$retry" == "N" ]]; then
                    print_error "无法验证 API 密钥，退出程序"
                    exit 1
                fi
            fi
        done
    fi
fi

# 选择启动模式
echo ""
print_info "请选择 Claude Code 启动模式："
echo "1. YOLO 模式 (claude --dangerously-skip-permissions) - 默认"
echo "2. 普通模式 (claude)"
echo "3. 使用自定义模型"
echo "4. 自定义命令"
echo ""
mode=$(read_valid_option "请输入选项" "1" "1234")
mode=${mode:-1}

# 执行相应的命令
case $mode in
    "1"|1)
        print_info "启动 YOLO 模式..."
        claude --dangerously-skip-permissions
        ;;
    "2"|2)
        print_info "启动普通模式..."
        claude
        ;;
    "3"|3)
        # 使用自定义模型
        print_info "使用自定义模型模式..."
        selected_model=""
        
        if [[ "$ACCESS_MODE" == "api" ]]; then
            # API 接入模式：显示API推荐模型 + 手动输入选项
            show_api_models
            echo ""
            model_choice=$(read_single_char "请选择模型" "1")
            model_choice=${model_choice:-1}
            
            if [[ "$model_choice" -le "${#API_RECOMMENDED_MODELS[@]}" ]]; then
                # 选择了推荐模型
                selected_model="${API_RECOMMENDED_MODELS[$((model_choice-1))]}"
                print_info "已选择模型: $selected_model"
                
                # 验证模型
                if test_custom_model "$selected_model" "$ANTHROPIC_API_KEY"; then
                    print_info "启动 Claude Code 使用模型: $selected_model"
                    claude --model "$selected_model"
                else
                    print_error "模型验证失败，使用默认 YOLO 模式..."
                    claude --dangerously-skip-permissions
                fi
            elif [[ "$model_choice" -eq "$((${#API_RECOMMENDED_MODELS[@]}+1))" ]]; then
                # 手动输入模型ID
                echo ""
                print_info "请访问 http://xx.com/ccmodellist 查看支持的模型ID"
                echo ""
                read -p "请输入模型ID: " custom_model_id
                
                if [[ -n "$custom_model_id" ]]; then
                    # 验证自定义模型ID
                    if test_custom_model "$custom_model_id" "$ANTHROPIC_API_KEY"; then
                        print_info "启动 Claude Code 使用模型: $custom_model_id"
                        claude --model "$custom_model_id"
                    else
                        print_error "自定义模型ID验证失败，使用默认 YOLO 模式..."
                        claude --dangerously-skip-permissions
                    fi
                else
                    print_error "模型ID不能为空，使用默认 YOLO 模式..."
                    claude --dangerously-skip-permissions
                fi
            else
                print_error "无效的选项，使用默认 YOLO 模式..."
                claude --dangerously-skip-permissions
            fi
            
        else
            # Claude Code 账户接入模式：仅显示预定义模型，直接执行
            show_claude_code_models
            echo ""
            model_choice=$(read_single_char "请选择模型" "1")
            model_choice=${model_choice:-1}
            
            if [[ "$model_choice" -le "${#CLAUDE_CODE_MODELS[@]}" ]]; then
                selected_model="${CLAUDE_CODE_MODELS[$((model_choice-1))]}"
                print_info "已选择模型: $selected_model"
                print_info "启动 Claude Code 使用模型: $selected_model"
                claude --model "$selected_model"
            else
                print_error "无效的选项，使用默认 YOLO 模式..."
                claude --dangerously-skip-permissions
            fi
        fi
        ;;
    "4"|4)
        # 自定义命令
        print_info "自定义命令模式..."
        show_custom_command_help
        echo ""
        read -p "请输入完整的 Claude Code 启动命令: " custom_command
        
        if [[ -n "$custom_command" ]]; then
            print_info "执行自定义命令: $custom_command"
            eval "$custom_command"
        else
            print_error "命令不能为空，使用默认 YOLO 模式..."
            claude --dangerously-skip-permissions
        fi
        ;;
    *)
        print_error "无效的选项，使用默认 YOLO 模式..."
        claude --dangerously-skip-permissions
        ;;
esac