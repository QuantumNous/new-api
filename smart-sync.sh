#!/bin/bash

# 智能同步脚本 - 从development分支选择性同步功能代码到main分支
# 自动过滤开发辅助文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 定义开发辅助文件模式（这些文件不会同步到main分支）
DEV_FILE_PATTERNS=(
    "*.local"           # .env.local 等本地配置
    "dev.sh"           # 开发脚本
    "simple-dev.sh"
    "build-and-run.sh"
    "compose-run.sh"
    "dev-manager.sh"
    "check-env.sh"
    "fix-network.sh"
    "offline-setup.sh"
    ".air.toml"        # 热重载配置
    "Dockerfile.dev"   # 开发Docker文件
    "docker-compose.dev.yml"
    "docker-compose.local.yml"
    "DEV_README.md"    # 开发文档
    "LOCAL_BUILD_README.md"
    "test_*.md"        # 测试文档
    "new-api"          # 编译后的二进制文件
    "makefile"         # 如果是开发用的makefile
)

# 定义功能代码文件模式（这些文件会同步到main分支）
FEATURE_FILE_PATTERNS=(
    "*.go"             # Go源代码
    "*.js"             # JavaScript文件
    "*.json"           # 配置文件（非本地）
    "*.md"             # 文档（非开发文档）
    "*.sql"            # 数据库文件
    "*.yaml"           # 配置文件
    "*.yml"            # 配置文件（非开发用）
)

# 检查文件是否为开发辅助文件
is_dev_file() {
    local file="$1"
    local basename=$(basename "$file")
    
    for pattern in "${DEV_FILE_PATTERNS[@]}"; do
        if [[ "$basename" == $pattern ]] || [[ "$file" == *"$pattern"* ]]; then
            return 0  # 是开发文件
        fi
    done
    
    # 检查特殊路径
    if [[ "$file" == *"/dev/"* ]] || [[ "$file" == *".dev."* ]]; then
        return 0  # 是开发文件
    fi
    
    return 1  # 不是开发文件
}

# 获取所有变更的文件
get_changed_files() {
    # 使用 -z 选项和 null 分隔符来安全处理包含特殊字符的文件名
    git diff --name-only -z main development
}

# 获取功能文件列表
get_feature_files() {
    local feature_files=()

    while IFS= read -r -d '' file; do
        # 跳过空文件名和包含 ANSI 转义序列的文件名
        if [[ -z "$file" ]] || [[ "$file" =~ \033 ]] || [[ "$file" =~ \\033 ]] || [[ "$file" =~ \[(SUCCESS|WARNING|INFO|ERROR)\] ]]; then
            continue
        fi

        if ! is_dev_file "$file" && [[ "$file" =~ \.(go|js|json|sql|yaml|yml)$ ]] && [[ ! "$file" =~ (test_|dev|local) ]]; then
            feature_files+=("$file")
        fi
    done < <(get_changed_files)

    printf '%s\n' "${feature_files[@]}"
}

# 获取开发文件列表
get_dev_files() {
    local dev_files=()

    while IFS= read -r -d '' file; do
        # 跳过空文件名和包含 ANSI 转义序列的文件名
        if [[ -z "$file" ]] || [[ "$file" =~ \033 ]] || [[ "$file" =~ \\033 ]] || [[ "$file" =~ \[(SUCCESS|WARNING|INFO|ERROR)\] ]]; then
            continue
        fi

        if is_dev_file "$file"; then
            dev_files+=("$file")
        fi
    done < <(get_changed_files)

    printf '%s\n' "${dev_files[@]}"
}

# 获取不确定文件列表
get_uncertain_files() {
    local uncertain_files=()

    while IFS= read -r -d '' file; do
        # 跳过空文件名和包含 ANSI 转义序列的文件名
        if [[ -z "$file" ]] || [[ "$file" =~ \033 ]] || [[ "$file" =~ \\033 ]] || [[ "$file" =~ \[(SUCCESS|WARNING|INFO|ERROR)\] ]]; then
            continue
        fi

        if ! is_dev_file "$file" && ! ([[ "$file" =~ \.(go|js|json|sql|yaml|yml)$ ]] && [[ ! "$file" =~ (test_|dev|local) ]]); then
            uncertain_files+=("$file")
        fi
    done < <(get_changed_files)

    printf '%s\n' "${uncertain_files[@]}"
}

# 显示文件分类结果
show_file_classification() {
    local feature_files
    local dev_files
    local uncertain_files

    # 使用新的函数获取文件列表
    readarray -t feature_files < <(get_feature_files)
    readarray -t dev_files < <(get_dev_files)
    readarray -t uncertain_files < <(get_uncertain_files)
    
    print_info "文件分类结果："
    echo ""
    
    if [ ${#feature_files[@]} -gt 0 ]; then
        print_success "✅ 功能代码文件（将同步到main分支）："
        for file in "${feature_files[@]}"; do
            echo "  📄 $file"
        done
        echo ""
    fi
    
    if [ ${#dev_files[@]} -gt 0 ]; then
        print_warning "🚫 开发辅助文件（不会同步）："
        for file in "${dev_files[@]}"; do
            echo "  🛠️  $file"
        done
        echo ""
    fi
    
    if [ ${#uncertain_files[@]} -gt 0 ]; then
        print_warning "❓ 需要确认的文件："
        for file in "${uncertain_files[@]}"; do
            echo "  ❓ $file"
        done
        echo ""
    fi
}

# 交互式确认不确定的文件
confirm_uncertain_files() {
    local uncertain_files
    local confirmed_feature_files=()

    # 获取不确定的文件列表
    readarray -t uncertain_files < <(get_uncertain_files)
    
    if [ ${#uncertain_files[@]} -gt 0 ]; then
        print_warning "以下文件需要您确认是否同步到main分支：" >&2
        echo "" >&2

        for file in "${uncertain_files[@]}"; do
            echo "文件: $file" >&2
            # 显示文件内容预览
            if [ -f "$file" ]; then
                echo "内容预览:" >&2
                head -5 "$file" 2>/dev/null | sed 's/^/  | /' >&2
                echo "" >&2
            fi

            read -p "是否同步文件 '$file' 到main分支? (y/n): " choice >&2
            case $choice in
                [Yy]*)
                    confirmed_feature_files+=("$file")
                    print_success "✅ 已标记为功能文件: $file" >&2
                    ;;
                *)
                    print_info "🚫 跳过文件: $file" >&2
                    ;;
            esac
            echo "" >&2
        done
    fi
    
    printf '%s\n' "${confirmed_feature_files[@]}"
}

# 执行选择性同步
perform_selective_sync() {
    print_info "开始执行选择性同步..."
    
    # 检查当前状态
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "当前有未提交的更改，请先提交或暂存"
        exit 1
    fi
    
    # 确保在development分支
    git checkout development
    
    # 获取功能文件列表
    local feature_files
    readarray -t feature_files < <(get_feature_files)

    # 确认不确定的文件
    local confirmed_files
    readarray -t confirmed_files < <(confirm_uncertain_files)

    # 合并所有要同步的文件
    local all_sync_files=("${feature_files[@]}" "${confirmed_files[@]}")
    
    if [ ${#all_sync_files[@]} -eq 0 ]; then
        print_warning "没有文件需要同步"
        exit 0
    fi
    
    print_info "准备同步 ${#all_sync_files[@]} 个文件到main分支"
    
    # 创建临时功能分支
    git checkout main
    local temp_branch="feature-sync-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$temp_branch"
    
    print_info "创建临时分支: $temp_branch"
    
    # 逐个同步文件
    for file in "${all_sync_files[@]}"; do
        if [ -f "../development/$file" ] || git show "development:$file" >/dev/null 2>&1; then
            print_info "同步文件: $file"
            
            # 确保目录存在
            mkdir -p "$(dirname "$file")"
            
            # 从development分支复制文件
            git show "development:$file" > "$file"
            git add "$file"
        else
            print_warning "文件不存在，跳过: $file"
        fi
    done
    
    # 提交更改
    if ! git diff --cached --quiet; then
        git commit -m "feat: 从development分支同步功能代码

同步的文件:
$(printf '- %s\n' "${all_sync_files[@]}")

自动过滤了开发辅助文件，只同步功能代码。"
        
        # 合并到main分支
        git checkout main
        git merge "$temp_branch" --no-ff -m "merge: 合并功能代码更新"
        
        # 删除临时分支
        git branch -D "$temp_branch"
        
        print_success "✅ 功能代码已成功同步到main分支"
        print_info "同步的文件数量: ${#all_sync_files[@]}"
    else
        print_warning "没有文件需要提交"
        git checkout main
        git branch -D "$temp_branch"
    fi
}

# 显示帮助信息
show_help() {
    echo "智能同步脚本 - 从development分支选择性同步到main分支"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  sync      执行智能同步"
    echo "  preview   预览将要同步的文件"
    echo "  help      显示帮助信息"
    echo ""
    echo "功能:"
    echo "  - 自动识别和过滤开发辅助文件"
    echo "  - 只同步功能代码到main分支"
    echo "  - 交互式确认不确定的文件"
    echo "  - 保持main分支干净"
}

# 主函数
main() {
    case "${1:-help}" in
        sync)
            show_file_classification
            read -p "确认执行同步? (y/n): " confirm
            if [[ $confirm =~ ^[Yy] ]]; then
                perform_selective_sync
            else
                print_info "同步已取消"
            fi
            ;;
        preview)
            show_file_classification
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
