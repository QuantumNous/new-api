#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY_MODE="local"
USE_STAGED=false
DIFF_BASE=""
DIFF_HEAD=""
COMMIT_MSG_FILE=""

declare -a CHANGED_FILES=()
declare -a TEXT_FILES=()
declare -a FAILURES=()

usage() {
  cat <<'EOF'
Usage:
  scripts/ai/verify_constraints.sh --staged [--mode local|ci]
  scripts/ai/verify_constraints.sh --diff-base <sha> --diff-head <sha> [--mode local|ci]
  scripts/ai/verify_constraints.sh --commit-msg <path>
EOF
}

record_failure() {
  FAILURES+=("$1")
}

print_failures() {
  if [[ ${#FAILURES[@]} -eq 0 ]]; then
    return 0
  fi

  printf '\n[ai-guard] 检查失败：\n' >&2
  for item in "${FAILURES[@]}"; do
    printf '  - %s\n' "$item" >&2
  done
  return 1
}

contains_path() {
  local target="$1"
  shift || true
  local item
  for item in "$@"; do
    if [[ "$item" == "$target" ]]; then
      return 0
    fi
  done
  return 1
}

collect_changes() {
  local name_cmd=()
  local numstat_cmd=()

  if [[ "$USE_STAGED" == true ]]; then
    name_cmd=(git -C "$ROOT_DIR" diff --cached --name-only --diff-filter=ACMR)
    numstat_cmd=(git -C "$ROOT_DIR" diff --cached --numstat --diff-filter=ACMR)
  else
    name_cmd=(git -C "$ROOT_DIR" diff --name-only --diff-filter=ACMR "$DIFF_BASE" "$DIFF_HEAD")
    numstat_cmd=(git -C "$ROOT_DIR" diff --numstat --diff-filter=ACMR "$DIFF_BASE" "$DIFF_HEAD")
  fi

  CHANGED_FILES=()
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    CHANGED_FILES+=("$line")
  done < <("${name_cmd[@]}" | sed '/^$/d')

  TEXT_FILES=()
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    TEXT_FILES+=("$line")
  done < <("${numstat_cmd[@]}" | awk -F '\t' '$1 != "-" && $2 != "-" {print $3}' | sed '/^$/d')
}

file_exists_in_worktree() {
  [[ -f "$ROOT_DIR/$1" ]]
}

get_file_diff() {
  local path="$1"
  if [[ "$USE_STAGED" == true ]]; then
    git -C "$ROOT_DIR" diff --cached --unified=0 --no-color --diff-filter=ACMR -- "$path"
  else
    git -C "$ROOT_DIR" diff --unified=0 --no-color --diff-filter=ACMR "$DIFF_BASE" "$DIFF_HEAD" -- "$path"
  fi
}

has_changed_path_prefix() {
  local prefix="$1"
  local path
  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" == "$prefix"* ]]; then
      return 0
    fi
  done
  return 1
}

has_changed_path_match() {
  local pattern="$1"
  local path
  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" == $pattern ]]; then
      return 0
    fi
  done
  return 1
}

unique_dirs_from_go_changes() {
  local path dir
  declare -A seen=()

  for path in "${CHANGED_FILES[@]}"; do
    case "$path" in
      *.go)
        if [[ "$path" == *_test.go ]]; then
          continue
        fi
        dir="$(dirname "$path")"
        if [[ "$dir" == "." ]]; then
          seen["."]=1
        else
          seen["./$dir"]=1
        fi
        ;;
    esac
  done

  if has_changed_path_match "go.mod" || has_changed_path_match "go.sum"; then
    seen["./..."]=1
  fi

  for dir in "${!seen[@]}"; do
    printf '%s\n' "$dir"
  done | sort
}

check_utf8_no_bom() {
  local path bom mime_info
  for path in "${TEXT_FILES[@]}"; do
    if ! file_exists_in_worktree "$path"; then
      continue
    fi

    mime_info="$(file -I "$ROOT_DIR/$path" 2>/dev/null || true)"
    if [[ "$mime_info" != *"charset=utf-8"* && "$mime_info" != *"charset=us-ascii"* ]]; then
      record_failure "$path 不是 UTF-8 编码。"
      continue
    fi

    bom="$(LC_ALL=C head -c 3 "$ROOT_DIR/$path" | od -An -t x1 | tr -d ' \n')"
    if [[ "$bom" == "efbbbf" ]]; then
      record_failure "$path 含有 UTF-8 BOM，必须去除。"
    fi
  done
}

check_json_wrapper_rules() {
  local path diff_content
  for path in "${CHANGED_FILES[@]}"; do
    case "$path" in
      *.go)
        if [[ "$path" == "common/json.go" || "$path" == *_test.go ]]; then
          continue
        fi
        diff_content="$(get_file_diff "$path")"
        if printf '%s\n' "$diff_content" | grep -Eq '^\+[^+].*"encoding/json"'; then
          record_failure "$path 新增了 encoding/json 导入，业务代码必须统一走 common/json.go。"
        fi
        if printf '%s\n' "$diff_content" | grep -Eq '^\+[^+].*\bjson\.(Marshal|MarshalIndent|Unmarshal|NewDecoder|NewEncoder)\b'; then
          record_failure "$path 新增了直接 JSON 序列化/反序列化调用，必须改用 common/json.go。"
        fi
        ;;
    esac
  done
}

check_frontend_package_manager_rules() {
  local path diff_content
  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" != web/* ]]; then
      continue
    fi
    diff_content="$(get_file_diff "$path")"
    if printf '%s\n' "$diff_content" | grep -Eiq '^\+[^+].*\b(npm|yarn)\s+(install|run|add|dlx|exec|create)\b'; then
      record_failure "$path 新增了 npm/yarn 工作流描述，web/ 目录统一使用 bun。"
    fi
  done
}

check_protected_branding_rules() {
  local path diff_content
  local brand_regex='(new-api|New API|QuantumNous|github.com/QuantumNous/new-api|calciumion/new-api|Calcium-Ion)'

  for path in "${CHANGED_FILES[@]}"; do
    case "$path" in
      AGENTS.md|CLAUDE.md|docs/ai/*|scripts/*|.githooks/*|.github/PULL_REQUEST_TEMPLATE.md|.github/workflows/ai-guard.yml)
        continue
        ;;
    esac

    diff_content="$(get_file_diff "$path")"
    if printf '%s\n' "$diff_content" | grep -Eq "^[+-][^+-].*${brand_regex}"; then
      record_failure "$path 触碰了受保护的项目标识，请改为人工单独审查，不要由 AI 直接修改。"
    fi
  done
}

check_database_risk_rules() {
  local path diff_content
  local risk_regex='(GROUP_CONCAT|STRING_AGG|JSONB|AUTO_INCREMENT| SERIAL|ALTER COLUMN|@>|->>|\\?\\||\\?&)'
  local database_touched=false

  for path in "${CHANGED_FILES[@]}"; do
    case "$path" in
      model/*|dto/*|relay/*|service/*|setting/*|common/*|main.go)
        database_touched=true
        ;;
    esac
  done

  if [[ "$database_touched" != true ]]; then
    return 0
  fi

  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" != *.go && "$path" != *.sql ]]; then
      continue
    fi
    diff_content="$(get_file_diff "$path")"
    if printf '%s\n' "$diff_content" | grep -Eq "^\+[^+].*${risk_regex}"; then
      record_failure "$path 新增了高风险数据库特定语法，请确认 SQLite / MySQL / PostgreSQL 兼容性后再提交。"
    fi
  done
}

run_go_tests_if_needed() {
  local packages_output

  if ! has_changed_path_match "go.mod" && ! has_changed_path_match "go.sum" && ! printf '%s\n' "${CHANGED_FILES[@]}" | grep -Eq '\.go$'; then
    return 0
  fi

  if ! command -v go >/dev/null 2>&1; then
    record_failure "未找到 go，无法执行后端验证。"
    return 0
  fi

  packages_output=()
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    packages_output+=("$line")
  done < <(unique_dirs_from_go_changes)
  if [[ ${#packages_output[@]} -eq 0 ]]; then
    return 0
  fi

  printf '[ai-guard] 执行 Go 验证：%s\n' "${packages_output[*]}"
  (
    cd "$ROOT_DIR"
    go test "${packages_output[@]}"
  ) || record_failure "Go 验证失败，请检查被改包的测试或编译错误。"
}

run_frontend_checks_if_needed() {
  local frontend_changed=false

  if has_changed_path_prefix "web/"; then
    frontend_changed=true
  fi

  if [[ "$frontend_changed" != true ]]; then
    return 0
  fi

  if ! command -v bun >/dev/null 2>&1; then
    record_failure "未找到 bun，无法执行前端验证。"
    return 0
  fi

  printf '[ai-guard] 执行前端验证。\n'
  (
    cd "$ROOT_DIR/web"
    bun install --frozen-lockfile
    bun run lint
    bun run eslint
    bun run i18n:lint
    DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION="$(cat "$ROOT_DIR/VERSION")" bun run build
  ) || record_failure "前端验证失败，请检查 lint / eslint / i18n / build 输出。"
}

check_i18n_changes() {
  local path diff_content
  local has_source_change=false
  local has_locale_change=false

  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" == web/src/* && "$path" != web/src/i18n/locales/* ]]; then
      has_source_change=true
    fi
    if [[ "$path" == web/src/i18n/locales/* ]]; then
      has_locale_change=true
    fi
  done

  if [[ "$has_source_change" != true ]]; then
    return 0
  fi

  for path in "${CHANGED_FILES[@]}"; do
    if [[ "$path" != web/src/* || "$path" == web/src/i18n/locales/* ]]; then
      continue
    fi
    diff_content="$(get_file_diff "$path")"
    if printf '%s\n' "$diff_content" | grep -Eq "^\+[^+].*['\"][^'\"]*[一-龥][^'\"]*['\"]"; then
      if [[ "$has_locale_change" != true ]]; then
        record_failure "检测到前端新增中文文案，但未同步 web/src/i18n/locales/*。"
      fi
      break
    fi
  done
}

validate_env_example() {
  if ! has_changed_path_match ".env.example"; then
    return 0
  fi

  if ! awk '
    /^[[:space:]]*$/ { next }
    /^[[:space:]]*#/ { next }
    /^[A-Za-z_][A-Za-z0-9_]*=.*/ { next }
    { exit 1 }
  ' "$ROOT_DIR/.env.example"; then
    record_failure ".env.example 存在非法行，必须保持 KEY=VALUE 或注释格式。"
  fi
}

validate_docker_compose() {
  local compose_changed=false
  if has_changed_path_match "docker-compose.yml"; then
    compose_changed=true
  fi

  if [[ "$compose_changed" != true ]]; then
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    if ! (cd "$ROOT_DIR" && docker compose -f docker-compose.yml config >/dev/null); then
      record_failure "docker-compose.yml 校验失败，请修复 Compose 配置。"
    fi
  elif command -v docker-compose >/dev/null 2>&1; then
    if ! (cd "$ROOT_DIR" && docker-compose -f docker-compose.yml config >/dev/null); then
      record_failure "docker-compose.yml 校验失败，请修复 Compose 配置。"
    fi
  else
    record_failure "未找到 docker / docker-compose，无法校验 docker-compose.yml。"
  fi
}

validate_dockerfile() {
  if ! has_changed_path_match "Dockerfile"; then
    return 0
  fi

  if ! grep -Eq '^FROM ' "$ROOT_DIR/Dockerfile"; then
    record_failure "Dockerfile 缺少 FROM 指令。"
  fi
  if ! grep -Eq '^ENTRYPOINT ' "$ROOT_DIR/Dockerfile"; then
    record_failure "Dockerfile 缺少 ENTRYPOINT 指令。"
  fi

  if command -v docker >/dev/null 2>&1; then
    if ! (cd "$ROOT_DIR" && docker build -q -f Dockerfile . >/dev/null); then
      record_failure "Dockerfile 构建验证失败，请确认 Docker 构建链仍然可用。"
    fi
  else
    record_failure "未找到 docker，无法验证 Dockerfile 构建。"
  fi
}

verify_commit_message() {
  local msg_file="$1"
  local subject

  if [[ ! -f "$msg_file" ]]; then
    printf '[ai-guard] commit message 文件不存在：%s\n' "$msg_file" >&2
    return 1
  fi

  subject="$(sed -n '1p' "$msg_file" | tr -d '\r')"
  if [[ -z "$subject" ]]; then
    printf '[ai-guard] 提交信息不能为空。\n' >&2
    return 1
  fi

  if [[ "$subject" =~ ^(Merge|Revert)\  ]]; then
    return 0
  fi

  if [[ ${#subject} -lt 12 ]]; then
    printf '[ai-guard] 提交标题过短，请写出明确任务摘要。\n' >&2
    return 1
  fi

  if [[ "$subject" =~ ^(update|fix|changes|misc|test|tmp|wip)$ ]]; then
    printf '[ai-guard] 提交标题过于笼统，请改为能体现任务摘要的中文说明。\n' >&2
    return 1
  fi

  if grep -Eiq '(Generated with|Claude Code|Co-Authored-By:|未经整理|未整理的 AI|原样粘贴)' "$msg_file"; then
    printf '[ai-guard] 提交信息包含明显未整理 AI 输出痕迹，请人工整理后再提交。\n' >&2
    return 1
  fi

  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      VERIFY_MODE="${2:-}"
      shift 2
      ;;
    --staged)
      USE_STAGED=true
      shift
      ;;
    --diff-base)
      DIFF_BASE="${2:-}"
      shift 2
      ;;
    --diff-head)
      DIFF_HEAD="${2:-}"
      shift 2
      ;;
    --commit-msg)
      COMMIT_MSG_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$COMMIT_MSG_FILE" ]]; then
  verify_commit_message "$COMMIT_MSG_FILE"
  exit $?
fi

if [[ "$USE_STAGED" != true && ( -z "$DIFF_BASE" || -z "$DIFF_HEAD" ) ]]; then
  printf '[ai-guard] 必须指定 --staged 或同时指定 --diff-base / --diff-head。\n' >&2
  usage >&2
  exit 1
fi

collect_changes

if [[ ${#CHANGED_FILES[@]} -eq 0 ]]; then
  printf '[ai-guard] 没有需要检查的改动。\n'
  exit 0
fi

printf '[ai-guard] 模式：%s\n' "$VERIFY_MODE"
printf '[ai-guard] 变更文件数：%d\n' "${#CHANGED_FILES[@]}"

check_utf8_no_bom
check_json_wrapper_rules
check_frontend_package_manager_rules
check_protected_branding_rules
check_database_risk_rules
check_i18n_changes
validate_env_example
validate_docker_compose
validate_dockerfile
run_go_tests_if_needed
run_frontend_checks_if_needed

print_failures
