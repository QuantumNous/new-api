#!/bin/bash

# 检查和清理开发辅助文件脚本
# 用于检查main分支是否包含开发辅助文件，并将其移动到development分支

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 配置文件路径
CONFIG_FILE="dev-files.conf"

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { echo -e "${PURPLE}[HEADER]${NC} $1"; }

# 检查依赖
check_dependencies() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "配置文件 $CONFIG_FILE 不存在"
        exit 1
    fi
}

# 从配置文件读取开发文件模式
load_dev_file_patterns() {
    local patterns=()
    local exceptions=()

    # 读取配置文件
    while IFS= read -r line; do
        # 跳过注释和空行
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        # 处理例外情况（以!开头）
        if [[ "$line" =~ ^! ]]; then
            exceptions+=("${line#!}")
        else
            patterns+=("$line")
        fi
    done < "$CONFIG_FILE"

    echo "PATTERNS:${patterns[*]}"
    echo "EXCEPTIONS:${exceptions[*]}"
}

# 检查文件是否为开发辅助文件
is_dev_file() {
    local file="$1"
    local basename=$(basename "$file")
    local config_data=$(load_dev_file_patterns)

    local patterns=($(echo "$config_data" | grep "PATTERNS:" | cut -d: -f2-))
    local exceptions=($(echo "$config_data" | grep "EXCEPTIONS:" | cut -d: -f2-))

    # 检查例外情况
    for exception in "${exceptions[@]}"; do
        if [[ "$file" == $exception ]] || [[ "$basename" == $exception ]]; then
            return 1  # 不是开发文件（例外）
        fi
        # 检查通配符匹配的例外
        if [[ "$file" == $exception ]] || [[ "$basename" == $exception ]]; then
            return 1
        fi
    done

    # 检查模式匹配
    for pattern in "${patterns[@]}"; do
        # 精确匹配
        if [[ "$file" == "$pattern" ]] || [[ "$basename" == "$pattern" ]]; then
            return 0  # 是开发文件
        fi
        # 通配符匹配
        if [[ "$basename" == $pattern ]] || [[ "$file" == $pattern ]]; then
            return 0  # 是开发文件
        fi
        # 包含匹配（对于复杂模式）
        if [[ "$pattern" == *"*"* ]]; then
            if [[ "$basename" == $pattern ]] || [[ "$file" == $pattern ]]; then
                return 0  # 是开发文件
            fi
        fi
    done

    return 1  # 不是开发文件
}

# 扫描main分支中的开发辅助文件
scan_main_branch() {
    print_header "🔍 扫描main分支中的开发辅助文件..."
    
    # 确保在main分支
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        print_info "切换到main分支..."
        git checkout main
    fi
    
    local dev_files=()
    local all_files=($(git ls-files))
    
    print_info "正在检查 ${#all_files[@]} 个文件..."
    
    for file in "${all_files[@]}"; do
        if is_dev_file "$file"; then
            dev_files+=("$file")
        fi
    done
    
    if [ ${#dev_files[@]} -eq 0 ]; then
        print_success "✅ main分支很干净，没有发现开发辅助文件"
        return 0
    else
        print_warning "⚠️  在main分支中发现 ${#dev_files[@]} 个开发辅助文件："
        echo ""
        for file in "${dev_files[@]}"; do
            echo "  🛠️  $file"
        done
        echo ""
        return 1
    fi
}

# 显示文件分类详情
show_file_details() {
    print_header "📋 开发辅助文件配置详情："
    echo ""

    print_info "配置文件: $CONFIG_FILE"
    echo ""

    local current_category=""
    while IFS= read -r line; do
        # 跳过空行
        [[ -z "${line// }" ]] && continue

        # 处理分类注释
        if [[ "$line" =~ ^#[[:space:]]*===[[:space:]]*(.+)[[:space:]]*===[[:space:]]*$ ]]; then
            current_category="${BASH_REMATCH[1]}"
            echo -e "${BLUE}📂 $current_category${NC}"
            continue
        fi

        # 跳过普通注释
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # 显示模式
        if [[ "$line" =~ ^! ]]; then
            echo "   ✅ 例外: ${line#!}"
        else
            echo "   🚫 模式: $line"
        fi
    done < "$CONFIG_FILE"
    echo ""
}

# 移动开发文件到development分支
move_dev_files_to_development() {
    print_header "🚚 将开发辅助文件移动到development分支..."
    
    # 确保在main分支
    git checkout main
    
    # 获取所有开发文件
    local dev_files=()
    local all_files=($(git ls-files))
    
    for file in "${all_files[@]}"; do
        if is_dev_file "$file"; then
            dev_files+=("$file")
        fi
    done
    
    if [ ${#dev_files[@]} -eq 0 ]; then
        print_success "没有需要移动的文件"
        return 0
    fi
    
    print_info "准备移动 ${#dev_files[@]} 个文件到development分支"
    
    # 检查development分支是否存在
    if ! git show-ref --verify --quiet refs/heads/development; then
        print_error "development分支不存在，请先创建development分支"
        return 1
    fi
    
    # 创建临时提交保存这些文件
    print_info "创建临时提交保存开发文件..."
    git add "${dev_files[@]}"
    git commit -m "temp: 临时保存开发辅助文件，准备移动到development分支"
    
    # 从main分支删除这些文件
    print_info "从main分支删除开发辅助文件..."
    git rm "${dev_files[@]}"
    git commit -m "cleanup: 从main分支移除开发辅助文件

移除的文件:
$(printf '- %s\n' "${dev_files[@]}")

这些文件已移动到development分支。"
    
    # 切换到development分支并合并这些文件
    print_info "切换到development分支..."
    git checkout development
    
    # 从临时提交中恢复文件
    print_info "恢复开发辅助文件到development分支..."
    git cherry-pick HEAD~1^  # 选择临时提交
    
    # 切换回main分支并删除临时提交
    git checkout main
    git reset --hard HEAD~1  # 删除临时提交
    
    print_success "✅ 成功将 ${#dev_files[@]} 个开发辅助文件移动到development分支"
    
    # 显示最终状态
    print_info "当前分支状态："
    git checkout main
    echo "Main分支文件数: $(git ls-files | wc -l)"
    git checkout development  
    echo "Development分支文件数: $(git ls-files | wc -l)"
    git checkout main
}

# 交互式清理
interactive_cleanup() {
    print_header "🧹 交互式清理模式"
    
    if scan_main_branch; then
        return 0
    fi
    
    echo ""
    print_warning "发现main分支中存在开发辅助文件。"
    echo ""
    echo "选择操作："
    echo "1) 查看文件分类详情"
    echo "2) 自动移动到development分支"
    echo "3) 手动处理"
    echo "4) 取消操作"
    echo ""
    
    read -p "请选择 (1-4): " choice
    
    case $choice in
        1)
            show_file_details
            echo ""
            read -p "按回车键继续..."
            interactive_cleanup
            ;;
        2)
            echo ""
            read -p "确认自动移动开发文件到development分支? (y/n): " confirm
            if [[ $confirm =~ ^[Yy] ]]; then
                move_dev_files_to_development
            else
                print_info "操作已取消"
            fi
            ;;
        3)
            print_info "请手动处理这些文件，然后重新运行此脚本"
            ;;
        4)
            print_info "操作已取消"
            ;;
        *)
            print_error "无效选择"
            interactive_cleanup
            ;;
    esac
}

# 显示帮助信息
show_help() {
    echo "开发辅助文件检查和清理脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  scan        扫描main分支中的开发辅助文件"
    echo "  clean       自动清理（移动到development分支）"
    echo "  interactive 交互式清理模式"
    echo "  config      显示配置文件内容"
    echo "  help        显示帮助信息"
    echo ""
    echo "配置文件: $CONFIG_FILE"
    echo ""
    echo "功能:"
    echo "  - 基于配置文件检测开发辅助文件"
    echo "  - 自动将开发文件从main分支移动到development分支"
    echo "  - 保持main分支干净，适合生产环境"
    echo "  - 支持自定义文件模式和例外规则"
}

# 显示配置
show_config() {
    print_header "📄 当前配置文件内容："
    echo ""
    cat "$CONFIG_FILE"
}

# 主函数
main() {
    # 检查依赖
    check_dependencies
    
    case "${1:-interactive}" in
        scan)
            scan_main_branch
            ;;
        clean)
            if scan_main_branch; then
                print_success "main分支已经很干净"
            else
                echo ""
                read -p "确认自动清理? (y/n): " confirm
                if [[ $confirm =~ ^[Yy] ]]; then
                    move_dev_files_to_development
                else
                    print_info "操作已取消"
                fi
            fi
            ;;
        interactive)
            interactive_cleanup
            ;;
        config)
            show_config
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
