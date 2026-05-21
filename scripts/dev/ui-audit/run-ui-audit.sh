#!/usr/bin/env bash
# One-click UI audit: health check → source scan → Playwright page audit → summary.
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
REPORT_DIR="$AUDIT_DIR/reports"
SUMMARY="$REPORT_DIR/ui-audit-summary.md"
SCAN_REPORT="$REPORT_DIR/legacy-terms-report.md"
SCAN_META="$REPORT_DIR/scan-meta.env"
PAGE_META="$REPORT_DIR/page-audit-meta.env"
SCREENSHOT_DIR="$AUDIT_DIR/screenshots"
SCOPE_DOC="$AUDIT_DIR/UI_ACCEPTANCE_SCOPE.md"

BASE_URL="${BASE_URL:-http://192.168.18.92:3001}"
UI_AUDIT_USERNAME="${UI_AUDIT_USERNAME:-${DEMO_USERNAME:-}}"
UI_AUDIT_PASSWORD="${UI_AUDIT_PASSWORD:-${DEMO_PASSWORD:-}}"
UI_AUDIT_SKIP_SCREENSHOTS="${UI_AUDIT_SKIP_SCREENSHOTS:-0}"
UI_AUDIT_STRICT="${UI_AUDIT_STRICT:-0}"

FRONTEND_OK=0
SCAN_OK=0
PAGE_AUDIT_STATUS="skipped"
PAGE_AUDIT_REASON="未执行"
SCREENSHOT_STATUS="skipped"
SCREENSHOT_REASON="未执行"
SCREENSHOT_LOG="$REPORT_DIR/screenshot.log"
EXIT_CODE=0

log() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

load_meta_file() {
  local meta="$1"
  [[ -f "$meta" ]] || return 0
  # shellcheck source=/dev/null
  source "$meta"
}

mkdir -p "$REPORT_DIR"

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

log "=== UI audit (昀河星泽词元运营中心) ==="
log "Time (UTC): $GENERATED_AT"
log "Repo root: $ROOT"
log ""

# --- 1. Project paths ---
log "[1/4] Checking project paths..."
if [[ ! -d "$ROOT/web/default/src" ]]; then
  echo "ERROR: web/default/src not found. Run from new-api repository root." >&2
  exit 1
fi
if [[ ! -f "$ROOT/UI_REDESIGN_RULES.md" ]]; then
  warn "UI_REDESIGN_RULES.md not found at repo root."
fi
log "  OK: web/default/src"
log ""

# --- 2. Frontend BASE_URL ---
log "[2/4] Checking frontend: $BASE_URL"
if curl -sf -o /dev/null -m 8 --connect-timeout 5 "$BASE_URL" 2>/dev/null \
  || curl -sfI -m 8 --connect-timeout 5 "$BASE_URL" 2>/dev/null | head -1 | grep -qE 'HTTP/[0-9.]+ [23]'; then
  FRONTEND_OK=1
  log "  OK: frontend reachable"
else
  FRONTEND_OK=0
  warn "前端服务未启动或端口不正确: $BASE_URL"
  log ""
  log "  请先启动前端（不会自动启动）："
  log "    cd web/default"
  log "    pnpm dev --host 0.0.0.0 --port 3001"
  log ""
  log "  将继续执行源码扫描；页面截图/可见文本扫描将跳过。"
fi
log ""

# --- 3. Legacy term scan (source) ---
log "[3/4] Running legacy term scan (source)..."
if bash "$AUDIT_DIR/scan-ui-legacy-terms.sh"; then
  SCAN_OK=1
  load_meta_file "$SCAN_META"
  log "  OK: $SCAN_REPORT"
else
  SCAN_OK=0
  warn "Scan script failed."
  P0_ACTIONABLE=0
  P1_ACTIONABLE=0
fi
log ""

# --- 4. Playwright page audit (screenshots + visible text) ---
log "[4/4] Playwright page audit (screenshots + visible text)..."
: >"$SCREENSHOT_LOG"
if [[ "$UI_AUDIT_SKIP_SCREENSHOTS" == 1 ]]; then
  PAGE_AUDIT_STATUS="skipped"
  PAGE_AUDIT_REASON="UI_AUDIT_SKIP_SCREENSHOTS=1"
  SCREENSHOT_STATUS="skipped"
  SCREENSHOT_REASON="$PAGE_AUDIT_REASON"
  echo "Skipped: UI_AUDIT_SKIP_SCREENSHOTS=1" >>"$SCREENSHOT_LOG"
  log "  Skipped (UI_AUDIT_SKIP_SCREENSHOTS=1)"
elif [[ "$FRONTEND_OK" != 1 ]]; then
  PAGE_AUDIT_STATUS="skipped"
  PAGE_AUDIT_REASON="BASE_URL 不可达: $BASE_URL"
  SCREENSHOT_STATUS="skipped"
  SCREENSHOT_REASON="$PAGE_AUDIT_REASON"
  {
    echo "Page audit skipped: frontend not reachable"
    echo "Start: cd web/default && pnpm dev --host 0.0.0.0 --port 3001"
  } >>"$SCREENSHOT_LOG"
  log "  Skipped: $PAGE_AUDIT_REASON"
else
  export BASE_URL UI_AUDIT_USERNAME UI_AUDIT_PASSWORD
  export DEMO_USERNAME="$UI_AUDIT_USERNAME" DEMO_PASSWORD="$UI_AUDIT_PASSWORD"
  if bash "$AUDIT_DIR/screenshot-ui-acceptance.sh"; then
    load_meta_file "$REPORT_DIR/screenshot-meta.env"
    load_meta_file "$PAGE_META"
    SCREENSHOT_STATUS="${SCREENSHOT_STATUS:-skipped}"
    SCREENSHOT_REASON="${SCREENSHOT_REASON:-见 screenshot.log}"
    PAGE_AUDIT_STATUS="${PAGE_AUDIT_STATUS:-success}"
    PAGE_AUDIT_REASON="${SCREENSHOT_REASON}"
    if [[ -f "$REPORT_DIR/page-audit-report.md" ]]; then
      log "  OK: page-audit-report.md"
      log "  Screenshots: $SCREENSHOT_DIR"
    else
      log "  Page audit: $SCREENSHOT_STATUS — $SCREENSHOT_REASON"
    fi
  else
    PAGE_AUDIT_STATUS="failed"
    PAGE_AUDIT_REASON="screenshot-ui-acceptance.sh 退出非 0"
    SCREENSHOT_STATUS="failed"
    SCREENSHOT_REASON="$PAGE_AUDIT_REASON"
    load_meta_file "$PAGE_META"
    warn "$PAGE_AUDIT_REASON"
  fi
fi
log ""

# --- Summary report ---
log "Writing summary: $SUMMARY"

P0_ACTIONABLE="${P0_ACTIONABLE:-0}"
P1_ACTIONABLE="${P1_ACTIONABLE:-0}"
PAGE_P0_VISIBLE_HITS="${PAGE_P0_VISIBLE_HITS:-0}"
PAGE_P1_VISIBLE_HITS="${PAGE_P1_VISIBLE_HITS:-0}"
PAGE_FAILED_COUNT="${PAGE_FAILED_COUNT:-0}"
PAGE_SKIPPED_AUTH_COUNT="${PAGE_SKIPPED_AUTH_COUNT:-0}"

{
  echo "# UI audit summary"
  echo ""
  echo "- **Generated (UTC):** $GENERATED_AT"
  echo "- **BASE_URL:** $BASE_URL"
  echo "- **Frontend reachable:** $([[ "$FRONTEND_OK" == 1 ]] && echo yes || echo no)"
  echo "- **Scope:** [\`UI_ACCEPTANCE_SCOPE.md\`](./UI_ACCEPTANCE_SCOPE.md)"
  echo ""
  echo "## Artifacts"
  echo ""
  echo "| Item | Path |"
  echo "|------|------|"
  echo "| Legacy term report (source) | \`reports/legacy-terms-report.md\` |"
  echo "| Scan meta | \`reports/scan-meta.env\` |"
  echo "| **Page audit report** | \`reports/page-audit-report.md\` |"
  echo "| Page audit TSV | \`reports/page-audit-full.tsv\` |"
  echo "| Screenshots | \`screenshots/\` |"
  echo "| Screenshot / page log | \`reports/screenshot.log\` |"
  echo ""
  P0_INTERNAL="${P0_INTERNAL:-0}"
  P1_INTERNAL="${P1_INTERNAL:-0}"
  P2_COUNT="${P2_COUNT:-0}"
  echo "## Source scan counts"
  echo ""
  echo "| Tier | Actionable | Internal/Ignored |"
  echo "|------|----------:|-----------------:|"
  echo "| P0 | $P0_ACTIONABLE | $P0_INTERNAL |"
  echo "| P1 | $P1_ACTIONABLE | $P1_INTERNAL |"
  echo "| P2 | $P2_COUNT | — |"
  echo ""
  echo "Full TSV: \`reports/legacy-terms-full.tsv\`"
  echo ""
  echo "## Page audit (visible text + screenshots)"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|------:|"
  echo "| Status | ${PAGE_AUDIT_STATUS:-skipped} |"
  echo "| P0 visible hits | ${PAGE_P0_VISIBLE_HITS:-0} |"
  echo "| P1 visible hits | ${PAGE_P1_VISIBLE_HITS:-0} |"
  echo "| Failed pages | ${PAGE_FAILED_COUNT:-0} |"
  echo "| Skipped (auth required) | ${PAGE_SKIPPED_AUTH_COUNT:-0} |"
  echo ""
  echo "Detail: [\`page-audit-report.md\`](./page-audit-report.md)"
  echo ""
  echo "## Recommended next steps"
  echo ""
  echo "1. 修复 **页面 P0 可见命中** 与 **failed 页面**（含 500）。"
  echo "2. 修复 **源码 P0 actionable**（\`legacy-terms-report.md\`）。"
  echo "3. 复验：\`bash scripts/dev/ui-audit/run-ui-audit.sh\`"
  echo ""
  echo "## Important constraints"
  echo ""
  echo "- 不要改 API、字段名、\`routeTree.gen.ts\`、计费逻辑。"
  echo "- 额度用词元；金额/单价用 ¥。"
  echo ""
  echo "## Page / screenshot status"
  echo ""
  echo "- **Page audit:** ${PAGE_AUDIT_STATUS:-skipped} — ${PAGE_AUDIT_REASON:-—}"
  echo "- **Screenshot runner:** ${SCREENSHOT_STATUS:-skipped}"
  echo "- **Log:** \`reports/screenshot.log\`"
} >"$SUMMARY"

log "  OK: $SUMMARY"
log ""
log "=== Done ==="
log "  Legacy report:     $SCAN_REPORT"
log "  Page audit report: ${REPORT_DIR}/page-audit-report.md"
log "  Summary:           $SUMMARY"
log "  Source P0 actionable: $P0_ACTIONABLE | Page P0 visible: ${PAGE_P0_VISIBLE_HITS:-0} | Failed pages: ${PAGE_FAILED_COUNT:-0}"

# STRICT: source P0 actionable OR page P0 visible hits OR page failed (not auth-skipped)
if [[ "$UI_AUDIT_STRICT" == 1 ]]; then
  if [[ "${P0_ACTIONABLE:-0}" -gt 0 ]]; then
    warn "UI_AUDIT_STRICT=1: source P0 actionable=${P0_ACTIONABLE} → exit 1"
    EXIT_CODE=1
  fi
  if [[ "${PAGE_P0_VISIBLE_HITS:-0}" -gt 0 ]]; then
    warn "UI_AUDIT_STRICT=1: page P0 visible hits=${PAGE_P0_VISIBLE_HITS} → exit 1"
    EXIT_CODE=1
  fi
  if [[ "${PAGE_FAILED_COUNT:-0}" -gt 0 ]]; then
    warn "UI_AUDIT_STRICT=1: page failed count=${PAGE_FAILED_COUNT} → exit 1"
    EXIT_CODE=1
  fi
fi

if [[ "$FRONTEND_OK" != 1 ]]; then
  log ""
  log "Note: frontend was not reachable; start dev server for page audit."
fi

exit "$EXIT_CODE"
