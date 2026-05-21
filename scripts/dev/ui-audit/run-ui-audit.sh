#!/usr/bin/env bash
# One-click UI audit: health check → legacy scan → optional screenshots → summary.
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
REPORT_DIR="$AUDIT_DIR/reports"
SUMMARY="$REPORT_DIR/ui-audit-summary.md"
SCAN_REPORT="$REPORT_DIR/legacy-terms-report.md"
SCAN_META="$REPORT_DIR/scan-meta.env"
SCREENSHOT_DIR="$AUDIT_DIR/screenshots"
SCOPE_DOC="$AUDIT_DIR/UI_ACCEPTANCE_SCOPE.md"

BASE_URL="${BASE_URL:-http://192.168.18.92:3001}"
UI_AUDIT_USERNAME="${UI_AUDIT_USERNAME:-${DEMO_USERNAME:-}}"
UI_AUDIT_PASSWORD="${UI_AUDIT_PASSWORD:-${DEMO_PASSWORD:-}}"
UI_AUDIT_SKIP_SCREENSHOTS="${UI_AUDIT_SKIP_SCREENSHOTS:-0}"
UI_AUDIT_STRICT="${UI_AUDIT_STRICT:-0}"

FRONTEND_OK=0
SCAN_OK=0
SCREENSHOT_STATUS="skipped"
SCREENSHOT_REASON="未执行"
SCREENSHOT_LOG="$REPORT_DIR/screenshot.log"
EXIT_CODE=0

log() { printf '%s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

mkdir -p "$REPORT_DIR"

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

log "=== UI audit (昀河星泽词元运营中心) ==="
log "Time (UTC): $GENERATED_AT"
log "Repo root: $ROOT"
log ""

# --- 1. Project paths ---
log "[1/5] Checking project paths..."
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
log "[2/5] Checking frontend: $BASE_URL"
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
  log "  将继续执行旧词扫描并生成报告（截图可能跳过）。"
fi
log ""

# --- 3. Legacy term scan ---
log "[3/5] Running legacy term scan..."
if bash "$AUDIT_DIR/scan-ui-legacy-terms.sh"; then
  SCAN_OK=1
  # shellcheck source=/dev/null
  [[ -f "$SCAN_META" ]] && source "$SCAN_META"
  log "  OK: $SCAN_REPORT"
else
  SCAN_OK=0
  warn "Scan script failed."
  P0_ACTIONABLE=0
  P1_ACTIONABLE=0
fi
log ""

# --- 4. Screenshots ---
log "[4/5] Screenshot acceptance..."
: >"$SCREENSHOT_LOG"
if [[ "$UI_AUDIT_SKIP_SCREENSHOTS" == 1 ]]; then
  SCREENSHOT_STATUS="skipped"
  SCREENSHOT_REASON="UI_AUDIT_SKIP_SCREENSHOTS=1"
  echo "Skipped: UI_AUDIT_SKIP_SCREENSHOTS=1" >>"$SCREENSHOT_LOG"
  log "  Skipped (UI_AUDIT_SKIP_SCREENSHOTS=1)"
elif [[ "$FRONTEND_OK" != 1 ]]; then
  SCREENSHOT_STATUS="skipped"
  SCREENSHOT_REASON="BASE_URL 不可达: $BASE_URL"
  {
    echo "Screenshot skipped: frontend not reachable"
    echo "Start: cd web/default && pnpm dev --host 0.0.0.0 --port 3001"
  } >>"$SCREENSHOT_LOG"
  log "  Skipped: $SCREENSHOT_REASON"
else
  export BASE_URL UI_AUDIT_USERNAME UI_AUDIT_PASSWORD
  export DEMO_USERNAME="$UI_AUDIT_USERNAME" DEMO_PASSWORD="$UI_AUDIT_PASSWORD"
  if bash "$AUDIT_DIR/screenshot-ui-acceptance.sh"; then
    # shellcheck source=/dev/null
    [[ -f "$AUDIT_DIR/reports/screenshot-meta.env" ]] && source "$AUDIT_DIR/reports/screenshot-meta.env"
    SCREENSHOT_STATUS="${SCREENSHOT_STATUS:-skipped}"
    SCREENSHOT_REASON="${SCREENSHOT_REASON:-见 screenshot.log}"
    if [[ "$SCREENSHOT_STATUS" == success ]]; then
      log "  OK: screenshots in $SCREENSHOT_DIR"
    else
      log "  Screenshot: $SCREENSHOT_STATUS — $SCREENSHOT_REASON"
    fi
  else
    SCREENSHOT_STATUS="failed"
    SCREENSHOT_REASON="screenshot-ui-acceptance.sh 退出非 0，详见 reports/screenshot.log"
    warn "$SCREENSHOT_REASON"
  fi
fi
log ""

# --- 5. Summary report ---
log "[5/5] Writing summary: $SUMMARY"

P0_ACTIONABLE="${P0_ACTIONABLE:-0}"
P1_ACTIONABLE="${P1_ACTIONABLE:-0}"

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
  echo "| Legacy term report | \`reports/legacy-terms-report.md\` |"
  echo "| Scan meta | \`reports/scan-meta.env\` |"
  echo "| Screenshots | \`screenshots/\`（若已生成） |"
  echo "| Screenshot log | \`reports/screenshot.log\` |"
  echo ""
  P0_INTERNAL="${P0_INTERNAL:-0}"
  P1_INTERNAL="${P1_INTERNAL:-0}"
  P2_COUNT="${P2_COUNT:-0}"
  echo "## Scan counts"
  echo ""
  echo "| Tier | Actionable | Internal/Ignored |"
  echo "|------|----------:|-----------------:|"
  echo "| P0 | $P0_ACTIONABLE | $P0_INTERNAL |"
  echo "| P1 | $P1_ACTIONABLE | $P1_INTERNAL |"
  echo "| P2 | $P2_COUNT | — |"
  echo ""
  echo "Full TSV: \`reports/legacy-terms-full.tsv\`"
  echo ""
  echo "## P0 pages (customer-facing)"
  echo ""
  echo "See \`UI_ACCEPTANCE_SCOPE.md\`: \`/\`, \`/login\`, \`/dashboard\`, \`/keys\`, \`/usage-logs/*\`, \`/wallet\`, \`/system-settings/site/system-info\`"
  echo ""
  echo "## P1 pages"
  echo ""
  echo "\`/redemption-codes\`, \`/subscriptions\`, \`/models/metadata\`, \`/channels\`, \`/users\`, \`/groups\`, \`/system-settings/site/{notice,header-navigation,sidebar-modules}\`"
  echo ""
  echo "## Recommended next steps"
  echo ""
  echo "1. **先修 P0 页面** 用户可见旧词（品牌、USD/\$、Midjourney、GitHub/release、io.net）。"
  echo "2. **再修 P1 语义**（Token→词元、API Key→应用接入密钥等），勿改字段名。"
  echo "3. **最后处理 P2**（更新检查、多语言、极端错误弹窗、隐藏部署）。"
  echo "4. 复验：\`bash scripts/dev/ui-audit/run-ui-audit.sh\`"
  echo "5. 演示数据：\`DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh\`（见 \`scripts/dev/README.md\`）"
  echo ""
  echo "## Important constraints"
  echo ""
  echo "- **不要**修改 API、请求路径、payload、数据库、\`routeTree.gen.ts\`。"
  echo "- **不要**修改表单/API **字段名**、配置 key、枚举值、计费逻辑。"
  echo "- **不要**改 LICENSE、NOTICE、THIRD-PARTY-LICENSES、源码许可证头。"
  echo "- **额度**展示用词元额度/词元消耗；**金额/单价**才用人民币（¥）。"
  echo ""
  echo "## Screenshot status"
  echo ""
  echo "- **Status:** $SCREENSHOT_STATUS"
  echo "- **Reason:** $SCREENSHOT_REASON"
  echo "- **Log:** \`reports/screenshot.log\`"
} >"$SUMMARY"

log "  OK: $SUMMARY"
log ""
log "=== Done ==="
log "  Legacy report: $SCAN_REPORT"
log "  Summary:       $SUMMARY"
log "  P0 actionable: $P0_ACTIONABLE | P1 actionable: $P1_ACTIONABLE"

# STRICT: only P0 actionable fails the run; P1/internal/P2 do not.
if [[ "$UI_AUDIT_STRICT" == 1 ]] && [[ "${P0_ACTIONABLE:-0}" -gt 0 ]]; then
  warn "UI_AUDIT_STRICT=1: P0 actionable=${P0_ACTIONABLE} → exit 1"
  EXIT_CODE=1
fi

if [[ "$FRONTEND_OK" != 1 ]]; then
  log ""
  log "Note: frontend was not reachable; start dev server before screenshot-based checks."
  # Do not exit 1 solely for unreachable frontend (per user request).
fi

exit "$EXIT_CODE"
