#!/bin/bash

# Claude Code Launcher Script
# Version: 2.2.16

# 版本信息
VERSION="2.2.16"
REMOTE_SCRIPT_URL="http://tfs.sthnext.com/cc/cc_launcher.sh"

# 版本管理函数
# 获取本地版本号
get_local_version() {
    echo "$VERSION"
}

# 获取线上版本号
get_remote_version() {
    local remote_url="$REMOTE_SCRIPT_URL"
    
    # 尝试获取线上文件内容
    local response=$(curl -s --connect-timeout 10 --max-time 30 "$remote_url")
    local curl_exit_code=$?
    
    if [ $curl_exit_code -eq 0 ] && [ -n "$response" ]; then
        # 从响应中提取版本号（支持两种格式）
        # 格式1: # Version: x.x.x
        local version=$(echo "$response" | grep '^# Version:' | head -1 | sed 's/# Version: //')
        # 格式2: VERSION="x.x.x"
        if [ -z "$version" ]; then
            version=$(echo "$response" | grep '^VERSION=' | head -1 | cut -d'"' -f2)
        fi
        echo "$version"
    else
        echo ""
    fi
}

# 比较版本号
compare_versions() {
    local version1="$1"
    local version2="$2"
    
    # 移除可能的前缀字符（如 v）
    version1=$(echo "$version1" | sed 's/^[vV]//')
    version2=$(echo "$version2" | sed 's/^[vV]//')
    
    # 如果版本号相同，直接返回
    if [ "$version1" = "$version2" ]; then
        return 0
    fi
    
    # 分割版本号并比较
    local major1=$(echo "$version1" | cut -d. -f1)
    local minor1=$(echo "$version1" | cut -d. -f2)
    local patch1=$(echo "$version1" | cut -d. -f3)
    
    local major2=$(echo "$version2" | cut -d. -f1)
    local minor2=$(echo "$version2" | cut -d. -f2)
    local patch2=$(echo "$version2" | cut -d. -f3)
    
    # 默认值为0
    major1=${major1:-0}
    minor1=${minor1:-0}
    patch1=${patch1:-0}
    major2=${major2:-0}
    minor2=${minor2:-0}
    patch2=${patch2:-0}
    
    # 比较主版本号
    if [ "$major1" -gt "$major2" ]; then
        return 1  # version1 > version2
    elif [ "$major1" -lt "$major2" ]; then
        return 2  # version1 < version2
    fi
    
    # 比较次版本号
    if [ "$minor1" -gt "$minor2" ]; then
        return 1  # version1 > version2
    elif [ "$minor1" -lt "$minor2" ]; then
        return 2  # version1 < version2
    fi
    
    # 比较补丁版本号
    if [ "$patch1" -gt "$patch2" ]; then
        return 1  # version1 > version2
    elif [ "$patch1" -lt "$patch2" ]; then
        return 2  # version1 < version2
    fi
    
    return 0  # version1 == version2
}

# 递增版本号
increment_version() {
    local version="$1"
    local part="${2:-patch}"  # major, minor, patch
    
    # 分割版本号
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    local patch=$(echo "$version" | cut -d. -f3)
    
    # 默认值为0
    major=${major:-0}
    minor=${minor:-0}
    patch=${patch:-0}
    
    case "$part" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# 更新脚本中的版本号
update_version_in_script() {
    local new_version="$1"
    local script_file="$2"
    
    # 更新两个地方的版本号
    sed -i.bak "s/^# Version: .*/# Version: $new_version/" "$script_file"
    sed -i.bak "s/^VERSION=.*/VERSION=\"$new_version\"/" "$script_file"
    
    # 删除备份文件
    rm -f "${script_file}.bak"
    
    echo "✅ 已更新脚本版本号为: $new_version"
}

# 检查是否有 -u 参数
if [[ "$1" == "-u" ]]; then
    # 执行上传功能
    echo "🚀 准备上传 cc_launcher.sh 到 FTP 服务器..."
    
    # 加载环境变量
    ENV_FILE=""
    if [ -f ".env" ]; then
        ENV_FILE=".env"
    elif [ -f "../.env" ]; then
        ENV_FILE="../.env"
    fi
    
    # 如果找到 .env 文件，加载 FTP 配置
    CC_LAUNCHER_FTP_HOST=""
    CC_LAUNCHER_FTP_USER=""
    CC_LAUNCHER_FTP_PASS=""
    CC_LAUNCHER_FTP_PATH=""
    CC_LAUNCHER_FTP_URL=""
    
    if [ -n "$ENV_FILE" ]; then
        # 尝试从 .env 文件读取 FTP 配置
        if [ -f "$ENV_FILE" ]; then
            source "$ENV_FILE"
        fi
    fi
    
    # 如果设置了完整的 FTP URL，解析各个组件
    if [ -n "$CC_LAUNCHER_FTP_URL" ]; then
        echo "✅ 检测到完整的 FTP URL 配置"
        
        # 解析 FTP URL: ftp://user:pass@host:port/path
        if [[ "$CC_LAUNCHER_FTP_URL" =~ ^ftp://([^:]+):([^@]+)@([^:/]+):?([0-9]*)(/.*)? ]]; then
            CC_LAUNCHER_FTP_USER="${BASH_REMATCH[1]}"
            CC_LAUNCHER_FTP_PASS="${BASH_REMATCH[2]}"
            CC_LAUNCHER_FTP_HOST="${BASH_REMATCH[3]}"
            FTP_PORT="${BASH_REMATCH[4]}"
            CC_LAUNCHER_FTP_PATH="${BASH_REMATCH[5]}"
            
            # 如果有端口号，添加到主机地址
            if [ -n "$FTP_PORT" ]; then
                CC_LAUNCHER_FTP_HOST="$CC_LAUNCHER_FTP_HOST:$FTP_PORT"
            fi
            
            # 如果没有路径，使用默认路径
            if [ -z "$CC_LAUNCHER_FTP_PATH" ]; then
                CC_LAUNCHER_FTP_PATH="/cc_launcher.sh"
            fi
            
            echo "   用户: $CC_LAUNCHER_FTP_USER"
            echo "   主机: $CC_LAUNCHER_FTP_HOST"
            echo "   路径: $CC_LAUNCHER_FTP_PATH"
        else
            echo "❌ FTP URL 格式错误，应为: ftp://user:pass@host:port/path"
            echo "   示例: ftp://tmp_file_service:NJeQBs92bkda@110.40.77.94:21/cc_launcher.sh"
            exit 1
        fi
    fi
    
    # 检查 FTP 配置，如果没有则提示用户输入
    if [ -z "$CC_LAUNCHER_FTP_HOST" ]; then
        echo "📝 未找到 CC_LAUNCHER_FTP_HOST 配置"
        CC_LAUNCHER_FTP_HOST=$(safe_read_input "请输入 FTP 服务器地址")
        if [ -z "$CC_LAUNCHER_FTP_HOST" ]; then
            echo "❌ FTP 服务器地址不能为空"
            exit 1
        fi
    else
        # 显示时去掉协议部分，只显示主机地址
        FTP_HOST_DISPLAY=$(echo "$CC_LAUNCHER_FTP_HOST" | sed 's|^ftp://||')
        echo "✅ 使用配置的 FTP 服务器: $FTP_HOST_DISPLAY"
    fi
    
    if [ -z "$CC_LAUNCHER_FTP_USER" ]; then
        echo "📝 未找到 CC_LAUNCHER_FTP_USER 配置"
        CC_LAUNCHER_FTP_USER=$(safe_read_input "请输入 FTP 用户名")
        if [ -z "$CC_LAUNCHER_FTP_USER" ]; then
            echo "❌ FTP 用户名不能为空"
            exit 1
        fi
    else
        echo "✅ 使用配置的 FTP 用户: $CC_LAUNCHER_FTP_USER"
    fi
    
    if [ -z "$CC_LAUNCHER_FTP_PASS" ]; then
        echo "📝 未找到 CC_LAUNCHER_FTP_PASS 配置"
        CC_LAUNCHER_FTP_PASS=$(safe_read_input "请输入 FTP 密码" "" "true")
        echo ""  # 换行
        if [ -z "$CC_LAUNCHER_FTP_PASS" ]; then
            echo "❌ FTP 密码不能为空"
            exit 1
        fi
    else
        echo "✅ 使用配置的 FTP 密码"
    fi
    
    if [ -z "$CC_LAUNCHER_FTP_PATH" ]; then
        echo "📝 未找到 CC_LAUNCHER_FTP_PATH 配置"
        CC_LAUNCHER_FTP_PATH=$(safe_read_input "请输入 FTP 上传路径 (默认: /cc_launcher.sh)" "/cc_launcher.sh")
    fi
    echo "📁 上传路径: $CC_LAUNCHER_FTP_PATH"
    
    # 检查当前脚本文件
    SCRIPT_FILE="$0"
    if [ ! -f "$SCRIPT_FILE" ]; then
        echo "❌ 错误: 无法找到脚本文件 $SCRIPT_FILE"
        exit 1
    fi
    
    # 获取文件大小
    FILE_SIZE=$(stat -f%z "$SCRIPT_FILE" 2>/dev/null || stat -c%s "$SCRIPT_FILE" 2>/dev/null)
    echo "📄 文件信息: $(basename "$SCRIPT_FILE") ($FILE_SIZE 字节)"
    
    # 版本检查
    echo ""
    echo "🔍 正在进行版本检查..."
    local_version=$(get_local_version)
    remote_version=$(get_remote_version)
    
    echo "   本地版本: $local_version"
    echo "   线上版本: $remote_version"
    
    if [ -z "$local_version" ]; then
        echo "❌ 错误: 无法获取本地版本号"
        exit 1
    fi
    
    if [ -z "$remote_version" ]; then
        echo "ℹ️  线上文件不存在，可以直接上传"
    else
        # 比较版本号
        compare_versions "$local_version" "$remote_version"
        comparison_result=$?
        
        if [ $comparison_result -eq 0 ]; then
            # 版本号相同，检查文件内容是否不同
            echo "⚠️  版本号相同，检查文件内容..."
            
            # 获取本地文件哈希
            local_hash=$(openssl dgst -sha256 -hex "$SCRIPT_FILE" | cut -d' ' -f2)
            
            # 获取线上文件的哈希
            remote_content=$(curl -s --connect-timeout 10 --max-time 30 "$REMOTE_SCRIPT_URL")
            if [ -n "$remote_content" ]; then
                remote_hash=$(echo "$remote_content" | openssl dgst -sha256 -hex | cut -d' ' -f2)
            else
                remote_hash=""
            fi
            
            if [ "$local_hash" != "$remote_hash" ]; then
                echo "❌ 文件内容不同但版本号相同！"
                echo "   本地文件哈希: $local_hash"
                echo "   线上文件哈希: $remote_hash"
                echo ""
                echo "需要更新版本号，请选择:"
                echo "1. 自动递增补丁版本号 (默认)"
                echo "2. 手动输入新版本号"
                echo ""
                
                choice=$(safe_read_input "请选择 [1]" "1")
                choice=${choice:-1}
                
                case $choice in
                    1)
                        new_version=$(increment_version "$local_version" "patch")
                        ;;
                    2)
                        while true; do
                            new_version=$(safe_read_input "请输入新版本号")
                            if [ -n "$new_version" ]; then
                                # 验证新版本号大于线上版本号
                                compare_versions "$new_version" "$remote_version"
                                if [ $? -eq 1 ]; then
                                    break
                                else
                                    echo "❌ 新版本号必须大于线上版本号 ($remote_version)"
                                fi
                            else
                                echo "❌ 版本号不能为空"
                            fi
                        done
                        ;;
                    *)
                        echo "❌ 无效选择"
                        exit 1
                        ;;
                esac
                
                echo "🔄 更新版本号: $local_version -> $new_version"
                update_version_in_script "$new_version" "$SCRIPT_FILE"
                
                # 重新加载VERSION变量
                VERSION="$new_version"
            else
                echo "✅ 文件内容相同，无需上传"
                exit 0
            fi
        elif [ $comparison_result -eq 2 ]; then
            # 本地版本 < 线上版本
            echo "❌ 本地版本 ($local_version) 低于线上版本 ($remote_version)"
            echo "请更新本地版本号后再上传"
            exit 1
        else
            # 本地版本 > 线上版本
            echo "✅ 本地版本较新，可以上传"
        fi
    fi
    
    echo ""
    
    # 使用 curl 上传文件到 FTP
    echo "🔄 正在上传..."
    
    # 构建 FTP URL
    # 检查 CC_LAUNCHER_FTP_HOST 是否已经包含协议
    if [[ "$CC_LAUNCHER_FTP_HOST" =~ ^ftp:// ]]; then
        # 已经包含协议，直接使用
        FTP_URL="${CC_LAUNCHER_FTP_HOST%/}${CC_LAUNCHER_FTP_PATH}"
    else
        # 不包含协议，添加 ftp://
        FTP_URL="ftp://$CC_LAUNCHER_FTP_HOST$CC_LAUNCHER_FTP_PATH"
    fi
    
    # 执行上传
    curl -T "$SCRIPT_FILE" \
         --user "$CC_LAUNCHER_FTP_USER:$CC_LAUNCHER_FTP_PASS" \
         --ftp-create-dirs \
         --progress-bar \
         "$FTP_URL" 2>&1 | tee /tmp/ftp_upload.log
    
    UPLOAD_RESULT=${PIPESTATUS[0]}
    
    if [ $UPLOAD_RESULT -eq 0 ]; then
        echo ""
        echo "✅ 上传成功！"
        # 显示时去掉协议部分
        FTP_HOST_DISPLAY=$(echo "$CC_LAUNCHER_FTP_HOST" | sed 's|^ftp://||')
        echo "   服务器: $FTP_HOST_DISPLAY"
        echo "   路径: $CC_LAUNCHER_FTP_PATH"
        echo "   文件大小: $FILE_SIZE 字节"
        
        # 可选：将 FTP 配置保存到 .env 文件
        if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
            echo ""
            echo "请选择配置保存格式："
            echo "1. 保存为完整 FTP URL (推荐)"
            echo "2. 保存为分离的配置项"
            echo "3. 不保存"
            echo ""
            save_choice=$(read_valid_option "请选择" "1" "123")
            check_user_cancel "$save_choice"
            
            if [[ "$save_choice" == "1" ]]; then
                ENV_FILE=".env"
                
                # 构建完整的 FTP URL
                # 移除 CC_LAUNCHER_FTP_HOST 中可能的 ftp:// 前缀
                FTP_HOST_CLEAN=$(echo "$CC_LAUNCHER_FTP_HOST" | sed 's|^ftp://||')
                
                # 构建完整 URL
                COMPLETE_FTP_URL="ftp://$CC_LAUNCHER_FTP_USER:$CC_LAUNCHER_FTP_PASS@$FTP_HOST_CLEAN$CC_LAUNCHER_FTP_PATH"
                
                echo "" >> "$ENV_FILE"
                echo "# cc_launcher FTP 配置 (完整URL格式)" >> "$ENV_FILE"
                echo "CC_LAUNCHER_FTP_URL=$COMPLETE_FTP_URL" >> "$ENV_FILE"
                echo "✅ FTP 配置已保存到 $ENV_FILE (完整URL格式)"
                echo "   配置: $COMPLETE_FTP_URL"
                
            elif [[ "$save_choice" == "2" ]]; then
                ENV_FILE=".env"
                echo "" >> "$ENV_FILE"
                echo "# cc_launcher FTP 配置 (分离格式)" >> "$ENV_FILE"
                echo "CC_LAUNCHER_FTP_HOST=$CC_LAUNCHER_FTP_HOST" >> "$ENV_FILE"
                echo "CC_LAUNCHER_FTP_USER=$CC_LAUNCHER_FTP_USER" >> "$ENV_FILE"
                echo "CC_LAUNCHER_FTP_PASS=$CC_LAUNCHER_FTP_PASS" >> "$ENV_FILE"
                echo "CC_LAUNCHER_FTP_PATH=$CC_LAUNCHER_FTP_PATH" >> "$ENV_FILE"
                echo "✅ FTP 配置已保存到 $ENV_FILE (分离格式)"
            else
                echo "ℹ️  未保存配置"
            fi
        fi
    else
        echo ""
        echo "❌ 上传失败"
        echo "错误日志:"
        cat /tmp/ftp_upload.log
        echo ""
        echo "💡 可能的原因:"
        echo "   1. FTP 服务器地址或端口不正确"
        echo "   2. 用户名或密码错误"
        echo "   3. 没有上传权限"
        echo "   4. 网络连接问题"
        exit 1
    fi
    
    # 清理临时文件
    rm -f /tmp/ftp_upload.log
    
    exit 0
fi

# 检测是否在交互模式下运行
IS_INTERACTIVE=true
if [ ! -t 0 ] || [ ! -t 1 ]; then
    IS_INTERACTIVE=false
    print_warning() { echo "[WARNING] $1"; }
    print_info() { echo "[INFO] $1"; }
    print_success() { echo "[SUCCESS] $1"; }
    print_error() { echo "[ERROR] $1"; }
fi

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

# 安全的字符串输入（支持Ctrl+C退出）
safe_read_input() {
    local prompt="$1"
    local default="$2"
    local is_password="${3:-false}"
    local input=""
    
    # 非交互模式下直接返回默认值
    if [[ "$IS_INTERACTIVE" == "false" ]]; then
        echo "$default"
        return 0
    fi
    
    # 设置 Ctrl+C 信号处理
    trap 'echo "" >&2; print_info "用户取消操作，退出脚本" >&2; exit 0' INT
    
    # 显示提示信息
    if [[ -n "$prompt" ]]; then
        if [[ -n "$default" ]]; then
            echo -n "$prompt [$default]: "
        else
            echo -n "$prompt: "
        fi
    fi
    
    # 根据是否是密码字段选择读取方式
    if [[ "$is_password" == "true" ]]; then
        read -s input || { echo ""; exit 0; }
    else
        read input || { echo ""; exit 0; }
    fi
    
    # 如果输入为空且有默认值，使用默认值
    if [[ -z "$input" && -n "$default" ]]; then
        input="$default"
    fi
    
    # 清除信号处理
    trap - INT
    
    echo "$input"
}

# 检查用户是否取消操作
check_user_cancel() {
    local value="$1"
    if [[ "$value" == "CTRL_C_PRESSED" ]]; then
        exit 0
    fi
}

# 读取有效选项的单个字符输入
read_valid_option() {
    local prompt="$1"
    local default="$2"
    local valid_options="$3"  # 有效选项，如 "1234"
    local char=""
    
    # 非交互模式下直接返回默认值
    if [[ "$IS_INTERACTIVE" == "false" ]]; then
        echo "$default"
        return 0
    fi
    
    # 设置 Ctrl+C 信号处理
    trap 'echo "" >&2; print_info "用户取消操作，退出脚本" >&2; exit 0' INT
    
    while true; do
        # 显示提示信息
        if [[ -n "$prompt" ]]; then
            if [[ -n "$default" ]]; then
                echo -n "$prompt [$default]: " >&2
            else
                echo -n "$prompt: " >&2
            fi
        fi
        
        # 尝试使用read命令而不是stty，更兼容
        if command -v stty >/dev/null 2>&1; then
            # 保存当前终端设置
            local old_stty=$(stty -g 2>/dev/null)
            
            # 检查stty是否工作正常
            if [[ -n "$old_stty" ]]; then
                # 设置终端为原始模式，关闭回显
                if stty raw -echo 2>/dev/null; then
                    # 读取单个字符
                    char=$(dd bs=1 count=1 2>/dev/null)
                    
                    # 恢复终端设置
                    stty "$old_stty" 2>/dev/null
                else
                    # stty设置失败，使用普通read
                    echo "" >&2
                    read -n 1 char
                fi
            else
                # 无法获取终端设置，使用普通read
                echo "" >&2
                read -n 1 char
            fi
        else
            # 没有stty命令，使用普通read
            echo "" >&2
            read -n 1 char
        fi
        
        # 检查是否是 Ctrl+C (ASCII 3)
        if [[ -n "$char" && $(printf "%d" "'$char" 2>/dev/null) -eq 3 ]]; then
            # 清除信号处理
            trap - INT
            echo "" >&2
            print_info "用户取消操作，退出脚本" >&2
            # 返回特殊值表示用户取消
            echo "CTRL_C_PRESSED"
            return 130  # 130 是 Ctrl+C 的标准退出码
        fi
        
        # 处理回车键（ASCII 13 或 10）或空输入
        if [[ -z "$char" ]] || [[ "$char" == $'\r' ]] || [[ "$char" == $'\n' ]]; then
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
            # 无效输入，显示错误信息并重新提示
            echo "" >&2
            echo "无效选项，请输入 $valid_options 中的一个选项" >&2
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

# 带loading的curl请求（支持按回车跳过，Ctrl+C退出）
curl_with_loading() {
    local url="$1"
    local message="$2"
    local timeout="$3"
    local max_time="$4"
    local allow_skip="${5:-true}"  # 第5个参数控制是否允许跳过，默认允许
    
    # 非交互模式下直接执行curl
    if [[ "$IS_INTERACTIVE" == "false" ]]; then
        print_info "$message"
        curl -s --connect-timeout "$timeout" --max-time "$max_time" "$url"
        return $?
    fi
    
    # 设置 Ctrl+C 信号处理
    trap 'echo "" >&2; print_info "用户取消操作，退出脚本" >&2; exit 0' INT
    
    # 启动后台curl进程
    local temp_file=$(mktemp)
    curl -s --connect-timeout "$timeout" --max-time "$max_time" "$url" > "$temp_file" 2>/dev/null &
    local curl_pid=$!
    
    # 显示loading动画
    local spinner="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    local i=0
    local skip_requested=false
    
    # 隐藏光标
    echo -ne "\033[?25l"
    
    # 显示第一个loading状态和提示信息
    if [[ "$allow_skip" == "true" ]]; then
        echo -ne "\r${BLUE}[INFO]${NC} $message ⠋ ${YELLOW}(按回车跳过，Ctrl+C退出)${NC}"
    else
        echo -ne "\r${BLUE}[INFO]${NC} $message ⠋ ${YELLOW}(Ctrl+C退出)${NC}"
    fi
    
    # 设置非阻塞读取
    if [[ "$allow_skip" == "true" ]] && [[ "$IS_INTERACTIVE" == "true" ]]; then
        # 保存当前终端设置
        local old_stty=$(stty -g 2>/dev/null)
        stty -icanon -echo min 0 time 0 2>/dev/null
    fi
    
    while kill -0 "$curl_pid" 2>/dev/null && [[ "$skip_requested" == "false" ]]; do
        local spin_char=${spinner:$i:1}
        if [[ "$allow_skip" == "true" ]]; then
            echo -ne "\r${BLUE}[INFO]${NC} $message $spin_char ${YELLOW}(按回车跳过，Ctrl+C退出)${NC}"
            
            # 检查是否有按键输入
            local key=""
            read -t 0 key
            if [[ $? -eq 0 ]]; then
                # 检查是否是回车键
                if [[ "$key" == "" ]] || [[ "$key" == $'\n' ]] || [[ "$key" == $'\r' ]]; then
                    skip_requested=true
                    # 终止curl进程
                    kill "$curl_pid" 2>/dev/null
                    break
                fi
            fi
        else
            echo -ne "\r${BLUE}[INFO]${NC} $message $spin_char ${YELLOW}(Ctrl+C退出)${NC}"
        fi
        sleep 0.1
        i=$(( (i + 1) % ${#spinner} ))
    done
    
    # 恢复终端设置
    if [[ "$allow_skip" == "true" ]] && [[ "$IS_INTERACTIVE" == "true" ]]; then
        stty "$old_stty" 2>/dev/null
    fi
    
    # 等待curl完成（如果还在运行）
    if kill -0 "$curl_pid" 2>/dev/null; then
        wait "$curl_pid"
    fi
    local exit_code=$?
    
    # 恢复光标并清除loading行
    echo -ne "\033[?25h"
    echo -ne "\r\033[K"
    
    # 清除信号处理
    trap - INT
    
    # 显示完成状态（输出到stderr避免混入下载内容）
    if [[ "$skip_requested" == "true" ]]; then
        print_warning "${message%...}已跳过" >&2
        rm -f "$temp_file"
        return 2  # 返回特殊代码表示用户跳过
    elif [[ $exit_code -eq 0 ]]; then
        print_info "${message%...}完成" >&2
    else
        print_error "${message%...}失败" >&2
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
        local curl_exit_code
        if [[ $retry_count -eq 0 ]]; then
            curl_result=$(curl_with_loading "$REMOTE_SCRIPT_URL" "正在检查最新版本..." 5 10 true)
            curl_exit_code=$?
            
            # 如果用户选择跳过网络检测
            if [[ $curl_exit_code -eq 2 ]]; then
                print_info "跳过网络检测，使用本地版本"
                return 2  # 返回特殊代码表示跳过
            fi
        else
            print_info "重试获取版本信息..."
            curl_result=$(curl -s --connect-timeout 5 --max-time 10 "$REMOTE_SCRIPT_URL")
            curl_exit_code=$?
        fi
        
        if [[ $curl_exit_code -eq 0 && -n "$curl_result" ]]; then
            # 从响应中提取版本号（支持两种格式）
            # 格式1: # Version: x.x.x
            remote_version=$(echo "$curl_result" | grep '^# Version:' | head -1 | sed 's/# Version: //')
            # 格式2: VERSION="x.x.x"
            if [ -z "$remote_version" ]; then
                remote_version=$(echo "$curl_result" | grep '^VERSION=' | head -1 | cut -d'"' -f2)
            fi
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
    
    # 下载最新版本到临时文件（带loading动画，不允许跳过）
    local download_result=$(curl_with_loading "$REMOTE_SCRIPT_URL" "正在下载最新版本..." 10 30 false)
    local download_exit_code=$?
    
    if [[ $download_exit_code -eq 0 && -n "$download_result" ]]; then
        echo "$download_result" > "$temp_file"
        
        # 验证下载的文件
        # 1. 检查文件大小
        local file_size=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null)
        if [[ $file_size -lt 1000 ]]; then
            print_error "更新失败：下载的文件太小（$file_size 字节）"
            rm -f "$temp_file"
            return 1
        fi
        
        # 2. 检查是否包含版本信息
        if ! grep -q "^VERSION=" "$temp_file" || ! grep -q "^# Version:" "$temp_file"; then
            print_error "更新失败：下载的文件不包含版本信息"
            rm -f "$temp_file"
            return 1
        fi
        
        # 3. 验证是否是有效的 bash 脚本
        local syntax_check=$(bash -n "$temp_file" 2>&1)
        if [[ $? -eq 0 ]]; then
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
            print_error "更新失败：下载的文件不是有效的bash脚本"
            # 显示语法错误详情
            echo "语法错误详情："
            echo "$syntax_check" | head -5
            # 显示文件前几行内容以便调试
            echo ""
            echo "文件前5行内容："
            head -5 "$temp_file" | sed 's/^/  /'
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
    
    # 获取线上版本
    local remote_version=$(get_remote_version)
    local get_version_result=$?
    
    if [[ $get_version_result -eq 2 ]]; then
        # 用户选择跳过网络检测
        print_success "使用本地版本: $VERSION"
    elif [[ $get_version_result -eq 0 && -n "$remote_version" ]]; then
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

# 全局 Ctrl+C 信号处理
trap 'echo "" >&2; print_info "用户取消操作，退出脚本" >&2; exit 0' INT

# Claude Code账户管理函数

# 检测Claude Code配置文件
detect_claude_code_configs() {
    local config_dir="$HOME/.claudecode"
    local has_config=false
    local has_backup=false
    
    if [[ -f "$config_dir/config" ]]; then
        has_config=true
    fi
    
    if ls "$config_dir/config-"* 1> /dev/null 2>&1; then
        has_backup=true
    fi
    
    echo "$has_config,$has_backup"
}

# 从配置文件中获取email
get_email_from_config() {
    local config_file="$1"
    if [[ -f "$config_file" ]]; then
        # 使用jq如果可用，否则使用改进的Python方法
        if command -v jq &> /dev/null; then
            jq -r '.email // empty' "$config_file" 2>/dev/null || echo ""
        else
            python3 -c "
import json
import sys
try:
    with open('$config_file', 'r', encoding='utf-8') as f:
        data = json.load(f)
        email = data.get('email', '')
        print(email)
except Exception as e:
    print('', file=sys.stderr)
" 2>/dev/null || echo ""
        fi
    fi
}

# 添加新Claude Code账号
add_new_claude_account() {
    local config_dir="$HOME/.claudecode"
    local config_file="$config_dir/config"
    
    if [[ -f "$config_file" ]]; then
        local email=$(get_email_from_config "$config_file")
        if [[ -n "$email" ]]; then
            mv "$config_file" "$config_dir/config-$email"
            print_success "当前账号已备份为 config-$email，请重新登录配置新账号"
        else
            mv "$config_file" "$config_dir/config-backup-$(date +%s)"
            print_success "当前账号已备份，请重新登录配置新账号"
        fi
    else
        print_info "请重新登录配置新账号"
    fi
}

# 切换账户
switch_claude_account() {
    local config_dir="$HOME/.claudecode"
    local config_file="$config_dir/config"
    
    # 扫描所有config-*文件
    local backup_files=()
    for file in "$config_dir"/config-*; do
        if [[ -f "$file" ]]; then
            backup_files+=("$(basename "$file")")
        fi
    done
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        print_error "没有找到可切换的账户"
        return 1
    fi
    
    echo ""
    echo "可切换的账户列表："
    for i in "${!backup_files[@]}"; do
        local account_name="${backup_files[$i]#config-}"
        echo "$((i+1)). $account_name"
    done
    echo ""
    
    local choice=$(read_valid_option "请选择要切换的账户" "1" "$(seq -s '' 1 ${#backup_files[@]})")
    check_user_cancel "$choice"
    local selected_file="${backup_files[$((choice-1))]}"
    
    # 如果当前存在config文件，备份它
    if [[ -f "$config_file" ]]; then
        local current_email=$(get_email_from_config "$config_file")
        if [[ -n "$current_email" ]]; then
            mv "$config_file" "$config_dir/config-$current_email"
        else
            mv "$config_file" "$config_dir/config-backup-$(date +%s)"
        fi
    fi
    
    # 将选择的文件重命名为config
    mv "$config_dir/$selected_file" "$config_file"
    
    local new_account="${selected_file#config-}"
    print_success "已切换到账户: $new_account"
}

# 删除账户
delete_claude_account() {
    local config_dir="$HOME/.claudecode"
    local config_file="$config_dir/config"
    
    while true; do
        # 扫描所有config-*文件
        local backup_files=()
        for file in "$config_dir"/config-*; do
            if [[ -f "$file" ]]; then
                backup_files+=("$(basename "$file")")
            fi
        done
        
        if [[ ${#backup_files[@]} -eq 0 ]]; then
            # 没有config-*文件，检查是否有config文件
            if [[ -f "$config_file" ]]; then
                local email=$(get_email_from_config "$config_file")
                echo ""
                local delete_default=$(safe_read_input "是否删除默认账户 $email？[y/N]" "N")
                if [[ "$delete_default" == "y" || "$delete_default" == "Y" ]]; then
                    rm -f "$config_file"
                    print_success "已删除默认账户"
                fi
            fi
            
            print_info "所有账户都已删除"
            echo ""
            echo "请选择："
            echo "1. 退出程序"
            echo "2. 进入Claude Code"
            echo ""
            local final_choice=$(read_valid_option "请选择" "1" "12")
            check_user_cancel "$final_choice"
            
            if [[ "$final_choice" == "1" ]]; then
                exit 0
            else
                clear_api_env_vars
                return 0  # 返回到启动模式选择
            fi
        fi
        
        echo ""
        echo "可删除的账户列表："
        for i in "${!backup_files[@]}"; do
            local account_name="${backup_files[$i]#config-}"
            echo "$((i+1)). $account_name"
        done
        echo "$((${#backup_files[@]}+1)). 完成删除，退出"
        echo "$((${#backup_files[@]}+2)). 完成删除，进入Claude Code"
        echo ""
        
        local total_options=$((${#backup_files[@]}+2))
        local choice=$(read_valid_option "请选择要删除的账户或其他操作" "1" "$(seq -s '' 1 $total_options)")
        check_user_cancel "$choice"
        
        if [[ "$choice" -le "${#backup_files[@]}" ]]; then
            # 删除选择的账户
            local selected_file="${backup_files[$((choice-1))]}"
            local account_name="${selected_file#config-}"
            
            echo ""
            local confirm=$(safe_read_input "确认删除账户 $account_name？[y/N]" "N")
            if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
                rm -f "$config_dir/$selected_file"
                print_success "已删除账户: $account_name"
            else
                print_info "取消删除"
            fi
        elif [[ "$choice" -eq "$((${#backup_files[@]}+1))" ]]; then
            # 完成删除，退出
            exit 0
        else
            # 完成删除，进入Claude Code
            switch_claude_account
            clear_api_env_vars
            return 0
        fi
    done
}

# 清除API环境变量
clear_api_env_vars() {
    unset ANTHROPIC_API_KEY
    unset ANTHROPIC_BASE_URL
    print_info "已清除当前会话的 API 环境变量"
}

# 检查是否以root权限运行
check_root_permission() {
    if [[ $EUID -eq 0 ]] || [[ -n "$SUDO_USER" ]]; then
        print_warning "检测到脚本以root/sudo权限运行"
        print_info "Claude Code不建议使用root权限运行"
        return 0  # 是root
    else
        return 1  # 不是root
    fi
}

# 检测操作系统类型
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        return 0  # Linux
    else
        return 1  # 非Linux
    fi
}

# Claude命令包装函数 - 在Linux下自动添加sudo
run_claude() {
    local claude_args="$*"
    
    if detect_os; then
        # Linux系统，检查sudo是否可用
        if command -v sudo >/dev/null 2>&1; then
            print_info "检测到Linux系统，使用sudo执行Claude Code"
            sudo claude $claude_args
        else
            print_warning "检测到Linux系统，但sudo不可用，直接执行Claude Code"
            claude $claude_args
        fi
    else
        # 非Linux系统，直接执行
        claude $claude_args
    fi
}

# 显示欢迎信息
show_welcome_banner() {
    local cyan='\033[0;36m'
    local yellow='\033[1;33m'
    local green='\033[0;32m'
    local blue='\033[0;34m'
    local reset='\033[0m'
    
    echo ""
    echo -e "${cyan}╔═══════════════════════════════════════════════════════════╗${reset}"
    echo -e "${cyan}║${reset}                                                           ${cyan}║${reset}"
    echo -e "${cyan}║${reset}   ${yellow}◆ CC Launcher${reset} : 一站式安装·启动·管理 ${green}Claude Code${reset}        ${cyan}║${reset}"
    echo -e "${cyan}║${reset}                                                           ${cyan}║${reset}"
    echo -e "${cyan}╠═══════════════════════════════════════════════════════════╣${reset}"
    echo -e "${cyan}║${reset}                                                           ${cyan}║${reset}"
    echo -e "${cyan}║${reset}   ${blue}📚${reset} Claude Code 完全指南: ${green}https://s.sthnext.com/ggq0ib${reset}   ${cyan}║${reset}"
    echo -e "${cyan}║${reset}   ${blue}💰${reset} Claude Code 优惠购买: ${green}https://store.cookai.cc/${reset}       ${cyan}║${reset}"
    echo -e "${cyan}║${reset}                                                           ${cyan}║${reset}"
    echo -e "${cyan}╚═══════════════════════════════════════════════════════════╝${reset}"
    echo ""
}

# 主程序开始
show_welcome_banner
print_info "Claude Code Launcher v$VERSION 启动中..."

# 检查权限
IS_ROOT=false
if check_root_permission; then
    IS_ROOT=true
fi

# 版本检查（如果不是在更新过程中）
if [[ "$1" != "--skip-update" ]]; then
    check_and_update "$@"
fi

# Node.js环境检测
check_nodejs() {
    print_info "检测Node.js环境..."
    
    # 检测是否安装了Node.js
    if ! command -v node &> /dev/null; then
        print_warning "未检测到Node.js"
        echo ""
        echo "Claude Code需要Node.js环境才能运行"
        echo "请选择："
        echo "1. 自动安装Node.js"
        echo "2. 退出后手动安装"
        echo ""
        
        local install_choice=$(read_valid_option "请选择" "1" "12")
        check_user_cancel "$install_choice"
        
        if [[ "$install_choice" == "1" ]]; then
            install_nodejs
        else
            print_info "请手动安装Node.js后再运行此脚本"
            echo ""
            if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
                echo "推荐使用nvm安装Node.js："
                echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"
                echo "nvm install 22"
            elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
                echo "Windows系统推荐使用Chocolatey安装："
                echo "powershell -c \"irm https://community.chocolatey.org/install.ps1|iex\""
                echo "choco install nodejs --version=\"22.17.1\""
            fi
            exit 0
        fi
    else
        # 检查Node.js版本
        local node_version=$(node -v | sed 's/v//')
        print_info "检测到Node.js版本: v$node_version"
        
        # 检查版本是否满足要求（需要v22.x）
        local major_version=$(echo "$node_version" | cut -d. -f1)
        if [[ "$major_version" -lt 22 ]]; then
            print_warning "Node.js版本不满足要求（需要v22.x或更高）"
            
            # 检测是否有nvm
            if command -v nvm &> /dev/null || [[ -f "$HOME/.nvm/nvm.sh" ]]; then
                print_info "检测到nvm，尝试切换到Node.js v22..."
                
                # 加载nvm
                if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
                    source "$HOME/.nvm/nvm.sh"
                fi
                
                # 切换到v22
                if nvm install 22 && nvm use 22; then
                    print_success "已切换到Node.js v22"
                else
                    print_warning "nvm切换版本失败"
                    version_not_satisfied
                fi
            else
                version_not_satisfied
            fi
        else
            print_success "Node.js版本满足要求"
        fi
        
        # 检查npm版本
        if command -v npm &> /dev/null; then
            local npm_version=$(npm -v)
            print_info "检测到npm版本: v$npm_version"
            
            # 检查npm版本是否满足要求（需要v10.x）
            local npm_major=$(echo "$npm_version" | cut -d. -f1)
            if [[ "$npm_major" -lt 10 ]]; then
                print_warning "npm版本不满足要求（需要v10.x或更高）"
                
                # 如果Node.js版本正确但npm版本不对，尝试使用nvm重新安装
                if command -v nvm &> /dev/null || [[ -f "$HOME/.nvm/nvm.sh" ]]; then
                    print_info "尝试使用nvm重新安装Node.js v22..."
                    if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
                        source "$HOME/.nvm/nvm.sh"
                    fi
                    if nvm install 22 && nvm use 22; then
                        print_success "已重新安装Node.js v22"
                    else
                        version_not_satisfied
                    fi
                else
                    version_not_satisfied
                fi
            else
                print_success "npm版本满足要求"
            fi
        else
            print_error "未检测到npm"
            version_not_satisfied
        fi
    fi
}

# 版本不满足要求时的处理
version_not_satisfied() {
    echo ""
    print_warning "当前环境不完全满足Claude Code的运行要求"
    echo "推荐的版本："
    echo "- Node.js: v22.x"
    echo "- npm: v10.x"
    echo ""
    echo "当前版本："
    if command -v node &> /dev/null; then
        echo "- Node.js: $(node -v)"
    else
        echo "- Node.js: 未安装"
    fi
    if command -v npm &> /dev/null; then
        echo "- npm: v$(npm -v)"
    else
        echo "- npm: 未安装"
    fi
    echo ""
    echo "请选择："
    echo "1. 继续运行（可能会遇到问题）"
    echo "2. 退出"
    echo ""
    
    local continue_choice=$(read_valid_option "请选择" "2" "12")
    check_user_cancel "$continue_choice"
    
    if [[ "$continue_choice" == "2" ]]; then
        exit 0
    else
        print_warning "继续运行，但可能会遇到兼容性问题"
    fi
}

# 安装Node.js
install_nodejs() {
    print_info "开始安装Node.js..."
    
    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # macOS/Linux - 安装nvm和Node.js
        print_info "正在安装nvm..."
        
        # 下载并安装nvm
        if curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash; then
            print_success "nvm安装成功"
            
            # 加载nvm
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            
            # 安装Node.js v22
            print_info "正在安装Node.js v22..."
            if nvm install 22; then
                print_success "Node.js v22安装成功"
                
                # 验证安装
                node_version=$(node -v)
                npm_version=$(npm -v)
                print_success "安装完成："
                echo "- Node.js: $node_version"
                echo "- npm: v$npm_version"
            else
                print_error "Node.js安装失败"
                exit 1
            fi
        else
            print_error "nvm安装失败"
            exit 1
        fi
        
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows - 使用Chocolatey
        print_info "Windows系统检测"
        
        # 检查是否有管理员权限
        if ! net session &> /dev/null; then
            print_error "需要管理员权限来安装Chocolatey和Node.js"
            print_info "请以管理员身份运行此脚本"
            exit 1
        fi
        
        # 检查是否已安装Chocolatey
        if ! command -v choco &> /dev/null; then
            print_info "正在安装Chocolatey包管理器..."
            if powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"; then
                print_success "Chocolatey安装成功"
            else
                print_error "Chocolatey安装失败"
                exit 1
            fi
        fi
        
        # 使用Chocolatey安装Node.js
        print_info "正在安装Node.js v22.17.1..."
        if choco install nodejs --version="22.17.1" -y; then
            print_success "Node.js安装成功"
            
            # 刷新环境变量
            refreshenv
            
            # 验证安装
            if command -v node &> /dev/null; then
                node_version=$(node -v)
                npm_version=$(npm -v)
                print_success "安装完成："
                echo "- Node.js: $node_version"
                echo "- npm: v$npm_version"
            else
                print_error "Node.js安装后验证失败，可能需要重启终端"
                exit 1
            fi
        else
            print_error "Node.js安装失败"
            exit 1
        fi
    else
        print_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
}

# 在版本检查后执行Node.js检测
check_nodejs

# Claude Code安装检测
check_claude_code() {
    print_info "检测Claude Code CLI..."
    
    # 检测是否安装了claude命令
    if ! command -v claude &> /dev/null; then
        print_warning "未检测到Claude Code CLI"
        echo ""
        echo "正在安装Claude Code..."
        echo ""
        
        # 使用npm安装Claude Code（非交互式）
        print_info "执行安装命令：npm install -g https://gaccode.com/claudecode/install --registry=https://registry.npmmirror.com"
        
        # 设置npm为非交互模式，避免任何提示
        export npm_config_yes=true
        export npm_config_force=true
        
        if npm install -g https://gaccode.com/claudecode/install --registry=https://registry.npmmirror.com --no-interactive --silent 2>&1 | grep -v "^npm"; then
            print_success "Claude Code安装成功"
            
            # 验证安装
            if command -v claude &> /dev/null; then
                print_success "Claude Code已安装成功！"
            else
                print_error "Claude Code安装后验证失败"
                print_info "可能需要重新加载环境变量或重启终端"
                
                # 尝试重新加载PATH
                if [[ -f "$HOME/.bashrc" ]]; then
                    source "$HOME/.bashrc"
                fi
                if [[ -f "$HOME/.zshrc" ]]; then
                    source "$HOME/.zshrc"
                fi
                
                # 再次检查
                if command -v claude &> /dev/null; then
                    print_success "重新加载后检测到Claude Code"
                else
                    print_error "请重启终端后再运行此脚本"
                    exit 1
                fi
            fi
        else
            print_error "Claude Code安装失败"
            echo ""
            echo "可能的原因："
            echo "1. 网络连接问题"
            echo "2. npm权限问题（可能需要使用sudo）"
            echo "3. 安装源不可用"
            echo ""
            echo "您可以手动执行以下命令安装："
            echo "npm install -g https://gaccode.com/claudecode/install --registry=https://registry.npmmirror.com"
            echo ""
            echo "或者使用sudo："
            echo "sudo npm install -g https://gaccode.com/claudecode/install --registry=https://registry.npmmirror.com"
            exit 1
        fi
    else
        # 已安装，显示版本信息
        print_success "检测到Claude Code CLI"
    fi
}

# 执行Claude Code检测
check_claude_code

# 环境检测阶段
print_info "进行环境检测..."

# 设置默认的 ANTHROPIC_BASE_URL
export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_DEFAULT"

# 先加载配置文件以确保环境变量可用
source_config_files

# 检测当前环境中是否存在 ANTHROPIC_API_KEY
if [[ -n "$ANTHROPIC_API_KEY" ]]; then
    print_info "检测到环境变量中的 ANTHROPIC_API_KEY"
else
    print_info "未检测到环境变量中的 ANTHROPIC_API_KEY"
fi

# Claude Code账户管理 - 检测配置文件
config_status=$(detect_claude_code_configs)
has_config=$(echo "$config_status" | cut -d',' -f1)
has_backup=$(echo "$config_status" | cut -d',' -f2)

# 显示选项菜单
echo ""
echo "请选择接入方式："

if [[ "$has_config" == "false" ]]; then
    # 基础选项（当无config文件时）
    echo "1. API接入"
    echo "2. Claude Code账户登录（默认）"
    echo ""
    choice=$(read_valid_option "请输入选项" "2" "12")
    check_user_cancel "$choice"
elif [[ "$has_backup" == "false" ]]; then
    # 扩展选项（当有config但无backup时）
    echo "1. API接入"
    echo "2. Claude Code账户登录（默认）"
    echo "3. 添加新Claude Code账号"
    echo ""
    choice=$(read_valid_option "请输入选项" "2" "123")
    check_user_cancel "$choice"
else
    # 完整选项（当有config和backup时）
    echo "1. API接入"
    echo "2. Claude Code账户登录（默认）"
    echo "3. 添加新Claude Code账号"
    echo "4. 切换账户"
    echo "5. 删除账户"
    echo ""
    choice=$(read_valid_option "请输入选项" "2" "12345")
    check_user_cancel "$choice"
fi

choice=${choice:-2}
print_info "用户选择: '$choice'"

# 记录接入方式用于后续的自定义模型选择
ACCESS_MODE=""

# 处理用户选择
case "$choice" in
    "1"|1)
        # API接入
        ACCESS_MODE="api"
        # 继续到API接入流程
        ;;
    "2"|2)
        # Claude Code账户登录
        ACCESS_MODE="account"
        clear_api_env_vars
        # 跳转到启动模式选择
        ;;
    "3"|3)
        # 添加新Claude Code账号
        add_new_claude_account
        ACCESS_MODE="account"
        clear_api_env_vars
        # 跳转到启动模式选择
        ;;
    "4"|4)
        # 切换账户
        switch_claude_account
        ACCESS_MODE="account"
        clear_api_env_vars
        # 跳转到启动模式选择
        ;;
    "5"|5)
        # 删除账户
        delete_claude_account
        ACCESS_MODE="account"
        # delete_claude_account函数会处理后续流程
        ;;
esac

# API 接入流程（仅在选择 API 接入时执行）
if [[ "$choice" == "1" ]]; then
    print_info "使用 API 接入模式"
    
    # 步骤 6.1：API密钥检查和配置方式选择
    
    # 检查环境变量和配置文件中的API密钥
    env_api_key="$ANTHROPIC_API_KEY"
    file_api_key=""
    
    # 检查配置文件中的API密钥
    if check_env_in_files "ANTHROPIC_API_KEY"; then
        source_config_files
        file_api_key="$ANTHROPIC_API_KEY"
    fi
    
    # 根据检查结果显示不同的配置选项
    echo ""
    
    if [[ -n "$env_api_key" && -n "$file_api_key" && "$env_api_key" == "$file_api_key" ]]; then
        # 情况1：环境变量和配置文件中的API密钥相同
        echo "请选择配置方式："
        echo "1. 使用临时环境变量（本次会话有效）"
        echo "2. 使用全局配置文件（永久保存）"
        echo "3. 修改API令牌（当前: ${env_api_key:0:10}...${env_api_key: -4}）"
        echo ""
        config_choice=$(read_valid_option "请输入选项" "2" "123")
        check_user_cancel "$config_choice"
    elif [[ -n "$env_api_key" || -n "$file_api_key" ]]; then
        # 情况2：仅存在环境变量或配置文件中的API密钥
        echo "请选择配置方式："
        echo "1. 使用临时环境变量（本次会话有效）"
        echo "2. 使用全局配置文件（永久保存）"
        echo ""
        config_choice=$(read_valid_option "请输入选项" "2" "12")
        check_user_cancel "$config_choice"
    else
        # 情况3：两者都不存在
        echo "请选择配置方式："
        echo "1. 使用临时环境变量（本次会话有效）"
        echo "2. 使用全局配置文件（永久保存）"
        echo ""
        config_choice=$(read_valid_option "请输入选项" "2" "12")
        check_user_cancel "$config_choice"
    fi
    
    # 步骤 6.2：配置 API 环境变量
    case "$config_choice" in
        "1"|1)
            # 临时环境变量配置
            print_info "使用临时环境变量配置模式"
            
            # 设置临时BASE_URL
            export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL_DEFAULT"
            
            # 获取API密钥
            api_key=""
            if [[ -n "$env_api_key" ]]; then
                api_key="$env_api_key"
            elif [[ -n "$file_api_key" ]]; then
                api_key="$file_api_key"
            fi
            
            # 如果没有API密钥，提示用户输入
            if [[ -z "$api_key" ]]; then
                echo ""
                echo "（打开 https://www.aihubmax.com/console/token 获取API令牌）"
                api_key=$(safe_read_input "请输入您的 API 令牌")
            fi
            
            # 验证API密钥
            if test_api_key "$api_key"; then
                export ANTHROPIC_API_KEY="$api_key"
                print_success "API 密钥验证成功！已设置临时环境变量"
            else
                print_error "API 密钥验证失败，退出程序"
                exit 1
            fi
            ;;
        "2"|2)
            # 全局配置文件配置
            print_info "使用全局配置文件配置模式"
            
            # 直接更新BASE_URL到所有配置文件
            add_to_config_files "ANTHROPIC_BASE_URL" "$ANTHROPIC_BASE_URL_DEFAULT"
            source_config_files
            
            # 获取API密钥
            api_key=""
            if [[ -n "$env_api_key" ]]; then
                api_key="$env_api_key"
            elif [[ -n "$file_api_key" ]]; then
                api_key="$file_api_key"
            fi
            
            # 如果没有API密钥，提示用户输入
            if [[ -z "$api_key" ]]; then
                echo ""
                echo "（打开 https://www.aihubmax.com/console/token 获取API令牌）"
                api_key=$(safe_read_input "请输入您的 API 令牌")
            fi
            
            # 验证API密钥
            if test_api_key "$api_key"; then
                # 保存API密钥到配置文件
                add_to_config_files "ANTHROPIC_API_KEY" "$api_key"
                source_config_files
                export ANTHROPIC_API_KEY="$api_key"
                print_success "API 密钥验证成功！已保存到全局配置文件"
            else
                print_error "API 密钥验证失败，退出程序"
                exit 1
            fi
            ;;
        "3"|3)
            # 修改API令牌
            print_info "修改API令牌模式"
            
            # 显示脱敏的API令牌
            print_info "当前API令牌: ${env_api_key:0:10}...${env_api_key: -4}"
            echo ""
            echo "（打开 https://www.aihubmax.com/console/token 获取API令牌）"
            new_api_key=$(safe_read_input "请输入新的 API 令牌")
            
            # 验证新的API令牌
            if test_api_key "$new_api_key"; then
                # 更新配置文件中的API令牌
                add_to_config_files "ANTHROPIC_API_KEY" "$new_api_key"
                source_config_files
                export ANTHROPIC_API_KEY="$new_api_key"
                print_success "新API令牌验证成功！已更新配置文件"
            else
                print_error "新API令牌验证失败，退出程序"
                exit 1
            fi
            ;;
    esac
fi

# 启动模式选择
echo ""
print_info "请选择 Claude Code 启动模式："

# 根据权限情况调整默认选项
if [[ "$IS_ROOT" == "true" ]]; then
    echo "1. 普通模式 (claude) - 默认"
    echo "2. 使用自定义模型"
    echo "3. 自定义命令"
    echo ""
    print_warning "⚠️  警告：您正在以 root/sudo 权限运行"
    print_warning "⚠️  Claude Code 不允许在 root 权限下使用 YOLO 模式"
    print_warning "⚠️  建议切换到普通用户运行"
    echo ""
    mode=$(read_valid_option "请输入选项" "1" "123")
    check_user_cancel "$mode"
    mode=${mode:-1}
else
    echo "1. YOLO 模式 (claude --dangerously-skip-permissions) - 默认"
    echo "2. 普通模式 (claude)"
    echo "3. 使用自定义模型"
    echo "4. 自定义命令"
    echo ""
    mode=$(read_valid_option "请输入选项" "1" "1234")
    check_user_cancel "$mode"
    mode=${mode:-1}
fi

# 执行相应的命令
case $mode in
    "1"|1)
        if [[ "$IS_ROOT" == "true" ]]; then
            print_info "启动普通模式..."
            run_claude
        else
            print_info "启动 YOLO 模式..."
            run_claude --dangerously-skip-permissions
        fi
        ;;
    "2"|2)
        if [[ "$IS_ROOT" == "true" ]]; then
            # root权限下，选项2是自定义模型
            print_info "使用自定义模型模式..."
            selected_model=""
            
            if [[ "$ACCESS_MODE" == "api" ]]; then
                # API 接入模式：显示API推荐模型 + 手动输入选项
                show_api_models
                echo ""
                model_choice=$(read_valid_option "请选择模型" "1" "$(seq -s '' 1 $((${#API_RECOMMENDED_MODELS[@]}+1)))")
                check_user_cancel "$model_choice"
                model_choice=${model_choice:-1}
                
                if [[ "$model_choice" -le "${#API_RECOMMENDED_MODELS[@]}" ]]; then
                    # 选择了推荐模型
                    selected_model="${API_RECOMMENDED_MODELS[$((model_choice-1))]}"
                    print_info "已选择模型: $selected_model"
                    print_info "启动 Claude Code 使用模型: $selected_model"
                    run_claude --model "$selected_model"
                elif [[ "$model_choice" -eq "$((${#API_RECOMMENDED_MODELS[@]}+1))" ]]; then
                    # 手动输入模型ID
                    echo ""
                    print_info "请访问 http://xx.com/ccmodellist 查看支持的模型ID"
                    echo ""
                    custom_model_id=$(safe_read_input "请输入模型ID")
                    
                    if [[ -n "$custom_model_id" ]]; then
                        print_info "启动 Claude Code 使用模型: $custom_model_id"
                        run_claude --model "$custom_model_id"
                    else
                        print_error "模型ID不能为空，使用默认模式..."
                        run_claude
                    fi
                else
                    print_error "无效的选项，使用默认模式..."
                    run_claude
                fi
            else
                # Claude Code 账户接入模式：仅显示预定义模型，选择后直接执行
                show_claude_code_models
                echo ""
                model_choice=$(read_valid_option "请选择模型" "1" "$(seq -s '' 1 ${#CLAUDE_CODE_MODELS[@]})")
                check_user_cancel "$model_choice"
                model_choice=${model_choice:-1}
                
                if [[ "$model_choice" -le "${#CLAUDE_CODE_MODELS[@]}" ]]; then
                    selected_model="${CLAUDE_CODE_MODELS[$((model_choice-1))]}"
                    print_info "已选择模型: $selected_model"
                    print_info "启动 Claude Code 使用模型: $selected_model"
                    run_claude --model "$selected_model"
                else
                    print_error "无效的选项，使用默认模式..."
                    run_claude
                fi
            fi
        else
            print_info "启动普通模式..."
            run_claude
        fi
        ;;
    "3"|3)
        if [[ "$IS_ROOT" == "true" ]]; then
            # root权限下，选项3是自定义命令
            print_info "自定义命令模式..."
            show_custom_command_help
            echo ""
            custom_command=$(safe_read_input "请输入完整的 Claude Code 启动命令")
            
            if [[ -n "$custom_command" ]]; then
                # 检查命令中是否包含危险参数，如果包含则拒绝执行
                if [[ "$custom_command" =~ --dangerously-skip-permissions ]]; then
                    print_error "⚠️  错误：不能在 root 权限下使用 --dangerously-skip-permissions 参数"
                    print_info "使用默认普通模式..."
                    run_claude
                else
                    print_info "执行自定义命令: $custom_command"
                    eval "$custom_command"
                fi
            else
                print_error "命令不能为空，使用默认模式..."
                run_claude
            fi
        else
            # 非root权限，选项3是自定义模型
            print_info "使用自定义模型模式..."
            selected_model=""
        
            if [[ "$ACCESS_MODE" == "api" ]]; then
                # API 接入模式：显示API推荐模型 + 手动输入选项
                show_api_models
                echo ""
                model_choice=$(read_valid_option "请选择模型" "1" "$(seq -s '' 1 $((${#API_RECOMMENDED_MODELS[@]}+1)))")
                check_user_cancel "$model_choice"
                model_choice=${model_choice:-1}
                
                if [[ "$model_choice" -le "${#API_RECOMMENDED_MODELS[@]}" ]]; then
                    # 选择了推荐模型
                    selected_model="${API_RECOMMENDED_MODELS[$((model_choice-1))]}"
                    print_info "已选择模型: $selected_model"
                    
                    # 运行检测流程
                    if test_custom_model "$selected_model" "$ANTHROPIC_API_KEY"; then
                        print_info "启动 Claude Code 使用模型: $selected_model"
                        run_claude --model "$selected_model"
                    else
                        print_error "模型验证失败，使用默认 YOLO 模式..."
                        run_claude --dangerously-skip-permissions
                    fi
                elif [[ "$model_choice" -eq "$((${#API_RECOMMENDED_MODELS[@]}+1))" ]]; then
                    # 手动输入模型ID
                    echo ""
                    print_info "请访问 http://xx.com/ccmodellist 查看支持的模型ID"
                    echo ""
                    custom_model_id=$(safe_read_input "请输入模型ID")
                    
                    if [[ -n "$custom_model_id" ]]; then
                        # 运行模型ID检测流程
                        if test_custom_model "$custom_model_id" "$ANTHROPIC_API_KEY"; then
                            print_info "启动 Claude Code 使用模型: $custom_model_id"
                            run_claude --model "$custom_model_id"
                        else
                            print_error "自定义模型ID验证失败，使用默认 YOLO 模式..."
                            run_claude --dangerously-skip-permissions
                        fi
                    else
                        print_error "模型ID不能为空，使用默认 YOLO 模式..."
                        run_claude --dangerously-skip-permissions
                    fi
                else
                    print_error "无效的选项，使用默认 YOLO 模式..."
                    run_claude --dangerously-skip-permissions
                fi
            else
                # Claude Code 账户接入模式：仅显示预定义模型，选择后直接执行
                show_claude_code_models
                echo ""
                model_choice=$(read_valid_option "请选择模型" "1" "$(seq -s '' 1 ${#CLAUDE_CODE_MODELS[@]})")
                check_user_cancel "$model_choice"
                model_choice=${model_choice:-1}
                
                if [[ "$model_choice" -le "${#CLAUDE_CODE_MODELS[@]}" ]]; then
                    selected_model="${CLAUDE_CODE_MODELS[$((model_choice-1))]}"
                    print_info "已选择模型: $selected_model"
                    print_info "启动 Claude Code 使用模型: $selected_model"
                    # 选择后直接执行（无需检测流程，因为模型已知可用）
                    run_claude --model "$selected_model"
                else
                    print_error "无效的选项，使用默认 YOLO 模式..."
                    run_claude --dangerously-skip-permissions
                fi
            fi
        fi
        ;;
    "4"|4)
        # 非root权限，选项4是自定义命令
        print_info "自定义命令模式..."
        show_custom_command_help
        echo ""
        custom_command=$(safe_read_input "请输入完整的 Claude Code 启动命令")
        
        if [[ -n "$custom_command" ]]; then
            print_info "执行自定义命令: $custom_command"
            eval "$custom_command"
        else
            print_error "命令不能为空，使用默认 YOLO 模式..."
            run_claude --dangerously-skip-permissions
        fi
        ;;
    *)
        if [[ "$IS_ROOT" == "true" ]]; then
            print_error "无效的选项，使用默认普通模式..."
            run_claude
        else
            print_error "无效的选项，使用默认 YOLO 模式..."
            run_claude --dangerously-skip-permissions
        fi
        ;;
esac

# 脚本结束，控制权交给 Claude Code