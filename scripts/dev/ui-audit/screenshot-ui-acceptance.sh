#!/usr/bin/env bash
# UI acceptance screenshots — requires Playwright (optional).
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

# Values are printf %q-quoted so run-ui-audit.sh can safely `source` the file.
write_meta() {
  local status="$1"
  local reason="$2"
  {
    printf 'SCREENSHOT_STATUS=%q\n' "$status"
    printf 'SCREENSHOT_REASON=%q\n' "$reason"
    printf 'SCREENSHOT_DIR=%q\n' "$OUT_DIR"
    printf 'SCREENSHOT_LOG=%q\n' "$LOG"
  } >"$META"
}

has_playwright() {
  local pkg="$ROOT/web/default/package.json"
  [[ -f "$pkg" ]] || return 1
  grep -qE '"@playwright/test"|"playwright"' "$pkg" 2>/dev/null
}

HELPER="$AUDIT_DIR/playwright-screenshots.mjs"

log "=== Screenshot acceptance ==="
log "BASE_URL=$BASE_URL"
log "UI_AUDIT_USERNAME=${UI_AUDIT_USERNAME:-<unset>}"
log ""

if ! has_playwright || ! command -v node >/dev/null 2>&1; then
  reason='当前项目未检测到可用 Playwright，按 README 说明安装或手动验收。'
  write_meta "skipped" "$reason"
  log_err "$reason"
  log ""
  log "截图验收未执行：$reason"
  exit 0
fi

if [[ ! -f "$HELPER" ]]; then
  reason="缺少 playwright-screenshots.mjs"
  write_meta "failed" "$reason"
  log_err "ERROR: $reason"
  exit 1
fi

if [[ -z "$UI_AUDIT_USERNAME" || -z "$UI_AUDIT_PASSWORD" ]]; then
  log "WARN: UI_AUDIT_USERNAME / UI_AUDIT_PASSWORD 未设置，受保护页面可能截图为登录页"
fi

log "Running Playwright → $OUT_DIR"
if node "$HELPER" >>"$LOG" 2>&1; then
  write_meta "success" "截图已写入 screenshots/"
  log "Screenshots saved under: $OUT_DIR"
  exit 0
fi

reason="Playwright 执行失败，详见 reports/screenshot.log"
write_meta "failed" "$reason"
log_err "$reason"
exit 1
