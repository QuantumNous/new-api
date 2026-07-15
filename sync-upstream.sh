#!/usr/bin/env bash

set -Eeuo pipefail

upstream_remote="upstream"
origin_remote="origin"
upstream_branch="main"
sync_mode="merge"
push_after_sync=true

usage() {
  cat <<'EOF'
用法：./sync-upstream.sh [选项]

将上游分支同步到当前本地分支，并可将当前分支推送到自己的远端。

选项：
  --merge             使用 merge 同步（默认）
  --rebase            使用 rebase 同步
  --branch <分支>     指定上游分支（默认：main）
  --upstream <远端>   指定上游远端名（默认：upstream）
  --origin <远端>     指定个人远端名（默认：origin）
  --no-push           同步后不推送当前分支到个人远端
  -h, --help          显示帮助

示例：
  ./sync-upstream.sh
  ./sync-upstream.sh --no-push
  ./sync-upstream.sh --rebase --no-push
  ./sync-upstream.sh --branch dev --no-push
EOF
}

while (($# > 0)); do
  case "$1" in
    --merge)
      sync_mode="merge"
      shift
      ;;
    --rebase)
      sync_mode="rebase"
      shift
      ;;
    --branch | --upstream | --origin)
      if (($# < 2)); then
        echo "错误：$1 缺少参数。" >&2
        usage >&2
        exit 2
      fi
      case "$1" in
        --branch) upstream_branch="$2" ;;
        --upstream) upstream_remote="$2" ;;
        --origin) origin_remote="$2" ;;
      esac
      shift 2
      ;;
    --no-push)
      push_after_sync=false
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "错误：未知参数 $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "错误：当前目录不在 Git 仓库中。" >&2
  exit 1
}
cd "$repo_root"

current_branch="$(git branch --show-current)"
if [[ -z "$current_branch" ]]; then
  echo "错误：当前处于 detached HEAD，请先切换到需要接取上游代码的本地分支。" >&2
  exit 1
fi

if ! git remote get-url "$upstream_remote" >/dev/null 2>&1; then
  echo "错误：远端 ${upstream_remote} 不存在。" >&2
  echo "首次使用请执行：" >&2
  echo "  git remote add ${upstream_remote} https://github.com/QuantumNous/new-api.git" >&2
  exit 1
fi
if [[ "$push_after_sync" == true ]] && ! git remote get-url "$origin_remote" >/dev/null 2>&1; then
  echo "错误：远端 ${origin_remote} 不存在。" >&2
  exit 1
fi

stash_commit=""
stash_ref=""
if [[ -n "$(git status --porcelain)" ]]; then
  echo "检测到未提交修改，正在临时保存（包含未跟踪文件）……"
  stash_before="$(git rev-parse -q --verify refs/stash 2>/dev/null || true)"
  if [[ -n "$(git ls-files --others --exclude-standard -- sync-upstream.sh)" ]]; then
    git stash push -u -m "sync-upstream: $(date '+%Y-%m-%d %H:%M:%S')" -- . ":(top,exclude)sync-upstream.sh"
  else
    git stash push -u -m "sync-upstream: $(date '+%Y-%m-%d %H:%M:%S')"
  fi
  stash_after="$(git rev-parse -q --verify refs/stash 2>/dev/null || true)"
  if [[ -n "$stash_after" && "$stash_after" != "$stash_before" ]]; then
    stash_ref="stash@{0}"
    stash_commit="$stash_after"
    echo "本次修改已保存到 stash：${stash_commit}"
  fi
fi

echo "正在获取 ${upstream_remote}/${upstream_branch}……"
if ! git fetch "$upstream_remote" "$upstream_branch"; then
  echo "错误：获取上游代码失败。" >&2
  if [[ -n "$stash_commit" ]]; then
    echo "原有修改仍保存在 stash：${stash_commit}" >&2
  fi
  exit 1
fi

echo "正在使用 ${sync_mode} 将 ${upstream_remote}/${upstream_branch} 同步到本地 ${current_branch}……"
if [[ "$sync_mode" == "rebase" ]]; then
  if ! git rebase "${upstream_remote}/${upstream_branch}"; then
    echo "错误：rebase 发生冲突。解决后执行 git rebase --continue，或执行 git rebase --abort。" >&2
    if [[ -n "$stash_commit" ]]; then
      echo "原有修改仍保存在 stash：${stash_commit}" >&2
    fi
    exit 1
  fi
else
  if ! git merge --no-edit "${upstream_remote}/${upstream_branch}"; then
    echo "错误：merge 发生冲突。解决后提交，或执行 git merge --abort。" >&2
    if [[ -n "$stash_commit" ]]; then
      echo "原有修改仍保存在 stash：${stash_commit}" >&2
    fi
    exit 1
  fi
fi

if [[ "$push_after_sync" == true ]]; then
  echo "正在推送到 ${origin_remote}/${current_branch}……"
  if ! git push "$origin_remote" "$current_branch"; then
    echo "错误：上游代码已同步到本地，但推送失败。" >&2
    if [[ -n "$stash_commit" ]]; then
      echo "原有修改仍保存在 stash：${stash_commit}" >&2
    fi
    exit 1
  fi
fi

if [[ -n "$stash_commit" ]]; then
  echo "正在恢复同步前的本地修改……"
  if ! git stash pop "$stash_ref"; then
    echo "警告：恢复本地修改时发生冲突，stash 已保留：${stash_commit}" >&2
    echo "请解决冲突后检查 git status。" >&2
    exit 1
  fi
fi

echo "完成：${upstream_remote}/${upstream_branch} 已同步到本地 ${current_branch}。"
if [[ "$push_after_sync" == true ]]; then
  echo "完成：本地 ${current_branch} 已推送到 ${origin_remote}/${current_branch}。"
fi
