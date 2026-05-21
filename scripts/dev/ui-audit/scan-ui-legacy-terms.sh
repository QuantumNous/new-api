#!/usr/bin/env bash
# Scan web/default/src for legacy / risk terms (UI audit).
# Does not modify source files. Report is gitignored under reports/.
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
SCAN_ROOT="$ROOT/web/default/src"
REPORT_DIR="$AUDIT_DIR/reports"
REPORT="$REPORT_DIR/legacy-terms-report.md"

if [[ ! -d "$SCAN_ROOT" ]]; then
  echo "ERROR: scan root not found: $SCAN_ROOT" >&2
  exit 1
fi

mkdir -p "$REPORT_DIR"

# --- search tool ---
if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n --no-heading --color=never)
  RG_GLOBS=(
    --glob '!**/node_modules/**'
    --glob '!**/dist/**'
    --glob '!**/routeTree.gen.ts'
    --glob '!**/LICENSE*'
    --glob '!**/NOTICE*'
    --glob '!**/THIRD-PARTY-LICENSES*'
  )
  search_term() {
    local pattern="$1"
    local extra_flags=("${@:2}")
    "${SEARCH_CMD[@]}" "${RG_GLOBS[@]}" "${extra_flags[@]}" -e "$pattern" "$SCAN_ROOT" 2>/dev/null || true
  }
else
  echo "WARN: ripgrep (rg) not found; falling back to grep -R (slower)." >&2
  search_term() {
    local pattern="$1"
    grep -RIn --exclude-dir=node_modules --exclude-dir=dist \
      --exclude='routeTree.gen.ts' \
      --exclude='LICENSE' --exclude='NOTICE' --exclude='THIRD-PARTY-LICENSES' \
      -E "$pattern" "$SCAN_ROOT" 2>/dev/null || true
  }
fi

# Skip license / compliance boilerplate (not user-visible).
is_boilerplate_line() {
  local line="$1"
  [[ "$line" =~ Copyright\ \(C\) ]] && return 0
  [[ "$line" =~ GNU\ Affero ]] && return 0
  [[ "$line" =~ quantumnous\.com ]] && return 0
  [[ "$line" =~ For\ commercial\ licensing ]] && return 0
  [[ "$line" =~ LICENSE|THIRD-PARTY-LICENSES ]] && return 0
  return 1
}

# term_id|grep_pattern|rg_flags (optional, space-separated for extra -i etc.)
read -r -d '' TERM_TABLE <<'EOF' || true
New API|New API|-i
NEW API|NEW API|-i
new-api|new-api|-i
QuantumNous|QuantumNous|
USD|USD|-i
USDC|USDC|-i
dollar|dollar|-i
Dollar-USD|\$\{|\$[0-9]|USD|dollar|-i
Wallet|Wallet|
Balance|Balance|
API Key|API Key|-i
Token|Token|
Cost|Cost|
Fee|Fee|
User|User|
Channel|Channel|
Model|Model|
Provider|Provider|
Vendor|Vendor|
Midjourney|Midjourney|-i
\bMJ\b|MJ|
Prompt|Prompt|
Fail Reason|Fail Reason|-i
Image Preview|Image Preview|-i
Header Navigation|Header Navigation|-i
Sidebar Modules|Sidebar Modules|-i
GitHub|GitHub|-i
Open release|Open release|-i
release notes|release notes|-i
io\.net|io.net|-i
Legacy Frontend|Legacy Frontend|-i
New Frontend|New Frontend|-i
Markdown|Markdown|-i
\bHTML\b|HTML|
iframe|iframe|-i
EOF

GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TOTAL_HITS=0
declare -A TERM_COUNTS

{
  echo "# Legacy / risk terms scan report"
  echo ""
  echo "- **Generated (UTC):** $GENERATED_AT"
  echo "- **Scan root:** \`web/default/src\`"
  echo "- **Excluded:** \`node_modules\`, \`dist\`, \`routeTree.gen.ts\`, LICENSE/NOTICE/THIRD-PARTY-LICENSES paths"
  echo "- **Boilerplate skipped:** Copyright / AGPL header lines in source files"
  echo "- **Classification:** 需要人工判断（代码标识符、i18n key、用户文案需分别处理）"
  echo ""
  echo "---"
  echo ""
} >"$REPORT"

while IFS='|' read -r term_id pattern flags; do
  [[ -z "${term_id// }" ]] && continue

  section_tmp="$(mktemp)"
  count=0

  if [[ "$flags" == *-i* ]]; then
    hits="$(search_term "$pattern" -i)"
  else
    hits="$(search_term "$pattern")"
  fi

  if [[ -n "$hits" ]]; then
    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      # rg: path:line:content  |  grep: path:line:content
      filepath="${hit%%:*}"
      rest="${hit#*:}"
      linenum="${rest%%:*}"
      content="${rest#*:}"

      rel="${filepath#"$ROOT/"}"
      if is_boilerplate_line "$content"; then
        continue
      fi

      # Escape pipe for markdown table
      safe_content="${content//|/\\|}"
      printf '| `%s` | %s | %s | `%s` | 需要人工判断 |\n' \
        "$rel" "$linenum" "$term_id" "$safe_content" >>"$section_tmp"
      count=$((count + 1))
    done <<<"$hits"
  fi

  TERM_COUNTS["$term_id"]=$count
  TOTAL_HITS=$((TOTAL_HITS + count))

  {
    echo "## Term: $term_id"
    echo ""
    echo "**Hits (after boilerplate filter):** $count"
    echo ""
    if [[ "$count" -eq 0 ]]; then
      echo "_No matches._"
    else
      echo "| File | Line | Term | Content | Classification |"
      echo "|------|------|------|---------|----------------|"
      cat "$section_tmp"
    fi
    echo ""
  } >>"$REPORT"

  rm -f "$section_tmp"
done <<<"$TERM_TABLE"

{
  echo "---"
  echo ""
  echo "## Summary"
  echo ""
  echo "| Term | Hits |"
  echo "|------|------|"
  for term_id in "${!TERM_COUNTS[@]}"; do
    echo "| $term_id | ${TERM_COUNTS[$term_id]} |"
  done | sort
  echo ""
  echo "**Total hits:** $TOTAL_HITS"
  echo ""
  echo "## Next steps"
  echo ""
  echo "1. Triage with \`UI_ACCEPTANCE_SCOPE.md\` (P0 first)."
  echo "2. Ignore license-header-only QuantumNous if already filtered."
  echo "3. i18n **keys** containing English are not necessarily user-visible — verify in UI."
  echo "4. Identifier hits (\`Token\`, \`User\`, \`Model\`) often must **not** rename (forbidden field names)."
} >>"$REPORT"

echo "Report written: $REPORT"
echo "Total hits: $TOTAL_HITS"
