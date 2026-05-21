#!/usr/bin/env bash
# Playwright page audit: screenshots + visible text scan + page-level reports.
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
OUT_DIR="$AUDIT_DIR/screenshots"
REPORT_DIR="$AUDIT_DIR/reports"
LOG="$REPORT_DIR/screenshot.log"
META="$REPORT_DIR/screenshot-meta.env"

BASE_URL="${BASE_URL:-http://192.168.18.92:3001}"
UI_AUDIT_USERNAME="${UI_AUDIT_USERNAME:-${DEMO_USERNAME:-}}"
UI_AUDIT_PASSWORD="${UI_AUDIT_PASSWORD:-${DEMO_PASSWORD:-}}"
export BASE_URL UI_AUDIT_USERNAME UI_AUDIT_PASSWORD
export DEMO_USERNAME="$UI_AUDIT_USERNAME" DEMO_PASSWORD="$UI_AUDIT_PASSWORD"

mkdir -p "$OUT_DIR" "$REPORT_DIR"
: >"$LOG"

log() { printf '%s\n' "$*" | tee -a "$LOG"; }
log_err() { printf '%s\n' "$*" | tee -a "$LOG" >&2; }

write_meta() {
  local status="$1"
  local reason="$2"
  {
    printf 'SCREENSHOT_STATUS=%q\n' "$status"
    printf 'SCREENSHOT_REASON=%q\n' "$reason"
    printf 'SCREENSHOT_DIR=%q\n' "$OUT_DIR"
    printf 'SCREENSHOT_LOG=%q\n' "$LOG"
  } >"$META"
  if [[ -f "$REPORT_DIR/page-audit-meta.env" ]]; then
    cat "$REPORT_DIR/page-audit-meta.env" >>"$META"
  fi
}

has_playwright() {
  local pkg="$ROOT/web/default/package.json"
  [[ -f "$pkg" ]] || return 1
  grep -qE '"@playwright/test"|"playwright"' "$pkg" 2>/dev/null
}

HELPER="$AUDIT_DIR/playwright-page-audit.mjs"

log "=== Page audit (screenshots + visible text) ==="
log "BASE_URL=$BASE_URL"
log "UI_AUDIT_USERNAME=${UI_AUDIT_USERNAME:-<unset>}"
log ""

if ! command -v node >/dev/null 2>&1; then
  reason='未找到 node，无法运行 Playwright 页面验收。'
  write_meta "skipped" "$reason"
  log_err "$reason"
  exit 0
fi

if ! has_playwright; then
  reason='未检测到 @playwright/test，请按 README 在 web/default 安装 Playwright。'
  write_meta "skipped" "$reason"
  log_err "$reason"
  exit 0
fi

if [[ ! -f "$HELPER" ]]; then
  reason="缺少 playwright-page-audit.mjs"
  write_meta "failed" "$reason"
  log_err "ERROR: $reason"
  exit 1
fi

if [[ -z "$UI_AUDIT_USERNAME" || -z "$UI_AUDIT_PASSWORD" ]]; then
  log "INFO: 未设置 UI_AUDIT_USERNAME/UI_AUDIT_PASSWORD — 仅公开页截图+扫描，需登录页记为 skipped_auth_required"
fi

log "Running Playwright page audit → screenshots/ + reports/page-audit-*"
if node "$HELPER" >>"$LOG" 2>&1; then
  # shellcheck source=/dev/null
  [[ -f "$REPORT_DIR/page-audit-meta.env" ]] && source "$REPORT_DIR/page-audit-meta.env"
  PAGE_FAILED_COUNT="${PAGE_FAILED_COUNT:-0}"
  PAGE_P0_VISIBLE_HITS="${PAGE_P0_VISIBLE_HITS:-0}"
  if [[ "$PAGE_FAILED_COUNT" -gt 0 ]]; then
    write_meta "partial" "部分页面失败或 500，见 page-audit-report.md（截图已保留）"
  elif [[ "$PAGE_P0_VISIBLE_HITS" -gt 0 ]]; then
    write_meta "partial" "页面可见文本存在 P0 风险词，见 page-audit-report.md"
  else
    write_meta "success" "截图与页面文本扫描完成"
  fi
  log "Screenshots: $OUT_DIR"
  log "Page report: $REPORT_DIR/page-audit-report.md"
  exit 0
fi

reason="Playwright 页面验收失败，详见 reports/screenshot.log 与 page-audit-report.md"
write_meta "failed" "$reason"
log_err "$reason"
exit 1
