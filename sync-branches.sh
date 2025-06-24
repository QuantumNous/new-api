#!/bin/bash

# 分支同步脚本
# 用于在三个分支之间进行选择性同步

set -e

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查当前分支
check_current_branch() {
    git branch --show-current
}

# 显示帮助信息
show_help() {
    echo "分支同步脚本使用说明："
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  dev-to-main     从development分支同步功能代码到main分支"
    echo "  main-to-custom  从main分支同步更新到custom分支"
    echo "  status          显示所有分支状态"
    echo "  diff            显示分支差异"
    echo "  help            显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev-to-main     # 同步开发功能到主分支"
    echo "  $0 main-to-custom  # 同步主分支更新到定制分支"
    echo "  $0 status          # 查看分支状态"
}

# 显示分支状态
show_status() {
    print_info "当前分支状态："
    echo ""
    git branch -v
    echo ""
    print_info "最近的提交："
    git log --oneline --graph --all -10
}

# 显示分支差异
show_diff() {
    print_info "main vs development 差异："
    git diff --name-only main development || true
    echo ""
    print_info "main vs custom 差异："
    git diff --name-only main custom || true
}

# 从development同步功能代码到main分支
sync_dev_to_main() {
    print_info "开始从development分支同步功能代码到main分支..."
    
    # 检查当前是否有未提交的更改
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "当前有未提交的更改，请先提交或暂存"
        exit 1
    fi
    
    # 切换到development分支
    print_info "切换到development分支..."
    git checkout development
    
    # 显示development分支的新提交
    print_info "development分支相对于main分支的新提交："
    git log --oneline main..development
    
    echo ""
    print_warning "请选择要同步到main分支的提交方式："
    echo "1) 创建功能分支进行选择性同步（推荐）"
    echo "2) 使用cherry-pick选择特定提交"
    echo "3) 取消操作"
    
    read -p "请选择 (1-3): " choice
    
    case $choice in
        1)
            sync_via_feature_branch
            ;;
        2)
            sync_via_cherry_pick
            ;;
        3)
            print_info "操作已取消"
            exit 0
            ;;
        *)
            print_error "无效选择"
            exit 1
            ;;
    esac
}

# 通过功能分支进行同步
sync_via_feature_branch() {
    print_info "创建临时功能分支进行选择性同步..."
    
    # 基于main分支创建临时功能分支
    git checkout main
    FEATURE_BRANCH="feature-sync-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$FEATURE_BRANCH"
    
    print_info "创建了临时分支: $FEATURE_BRANCH"
    print_warning "现在您需要手动将development分支的功能代码复制到此分支"
    print_warning "请在另一个终端中进行以下操作："
    echo ""
    echo "1. 比较文件差异: git diff main development"
    echo "2. 手动复制需要的功能代码文件"
    echo "3. 避免复制开发辅助文件（如 .env.local, dev.sh 等）"
    echo ""
    
    read -p "完成功能代码复制后，按回车继续..."
    
    # 检查是否有更改
    if git diff --quiet && git diff --cached --quiet; then
        print_warning "没有检测到更改，删除临时分支"
        git checkout main
        git branch -D "$FEATURE_BRANCH"
        return
    fi
    
    # 提交更改
    print_info "提交功能代码..."
    git add .
    git commit -m "feat: 从development分支同步功能代码"
    
    # 合并到main分支
    git checkout main
    git merge "$FEATURE_BRANCH" --no-ff -m "merge: 合并功能代码到main分支"
    
    # 删除临时分支
    git branch -D "$FEATURE_BRANCH"
    
    print_success "功能代码已成功同步到main分支"
}

# 通过cherry-pick进行同步
sync_via_cherry_pick() {
    print_info "显示development分支的提交列表："
    git log --oneline main..development
    
    echo ""
    read -p "请输入要同步的提交哈希值（多个用空格分隔）: " commits
    
    if [ -z "$commits" ]; then
        print_error "未输入提交哈希值"
        exit 1
    fi
    
    # 切换到main分支
    git checkout main
    
    # 逐个cherry-pick提交
    for commit in $commits; do
        print_info "正在cherry-pick提交: $commit"
        if git cherry-pick "$commit"; then
            print_success "成功cherry-pick提交: $commit"
        else
            print_error "Cherry-pick失败，请解决冲突后继续"
            print_info "解决冲突后运行: git cherry-pick --continue"
            exit 1
        fi
    done
    
    print_success "所有提交已成功同步到main分支"
}

# 从main分支同步更新到custom分支
sync_main_to_custom() {
    print_info "开始从main分支同步更新到custom分支..."
    
    # 检查当前是否有未提交的更改
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "当前有未提交的更改，请先提交或暂存"
        exit 1
    fi
    
    # 确保main分支是最新的
    print_info "更新main分支..."
    git checkout main
    git pull origin main || print_warning "无法从远程更新main分支，继续使用本地版本"
    
    # 显示main分支相对于custom分支的新提交
    print_info "main分支相对于custom分支的新提交："
    git log --oneline custom..main
    
    # 切换到custom分支
    print_info "切换到custom分支..."
    git checkout custom
    
    # 合并main分支的更新
    print_info "合并main分支的更新..."
    if git merge main --no-ff -m "sync: 同步main分支更新"; then
        print_success "main分支更新已成功同步到custom分支"
    else
        print_error "合并过程中出现冲突，请解决冲突后提交"
        print_info "解决冲突后运行: git add . && git commit"
        exit 1
    fi
}

# 主函数
main() {
    case "${1:-help}" in
        dev-to-main)
            sync_dev_to_main
            ;;
        main-to-custom)
            sync_main_to_custom
            ;;
        status)
            show_status
            ;;
        diff)
            show_diff
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

# 运行主函数
main "$@"
