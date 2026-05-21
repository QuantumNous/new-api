#!/usr/bin/env bash
# Scan web/default/src — strict term matching + classification (no source edits).
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
SCAN_ROOT="$ROOT/web/default/src"
REPORT_DIR="$AUDIT_DIR/reports"
REPORT="$REPORT_DIR/legacy-terms-report.md"
TSV="$REPORT_DIR/legacy-terms-full.tsv"
META="$REPORT_DIR/scan-meta.env"

if [[ ! -d "$SCAN_ROOT" ]]; then
  echo "ERROR: scan root not found: $SCAN_ROOT" >&2
  exit 1
fi

mkdir -p "$REPORT_DIR"

if command -v rg >/dev/null 2>&1; then
  RG=(rg -n --no-heading --color=never
    --glob '!**/node_modules/**' --glob '!**/dist/**'
    --glob '!**/routeTree.gen.ts' --glob '!**/LICENSE*'
    --glob '!**/NOTICE*' --glob '!**/THIRD-PARTY-LICENSES*')
  HAS_RG=1
else
  echo "WARN: ripgrep (rg) not found; falling back to grep -R (slower)." >&2
  HAS_RG=0
fi

rg_search() {
  if [[ "$HAS_RG" == 1 ]]; then
    "${RG[@]}" -e "$1" "$SCAN_ROOT" 2>/dev/null || true
  else
    grep -RIn --exclude-dir=node_modules --exclude-dir=dist \
      --exclude='routeTree.gen.ts' --exclude='LICENSE' --exclude='NOTICE' \
      --exclude='THIRD-PARTY-LICENSES' -E "$1" "$SCAN_ROOT" 2>/dev/null || true
  fi
}

is_boilerplate_line() {
  local line="$1"
  [[ "$line" =~ Copyright\ \(C\) ]] && return 0
  [[ "$line" =~ GNU\ Affero ]] && return 0
  [[ "$line" =~ quantumnous\.com ]] && return 0
  [[ "$line" =~ For\ commercial\ licensing ]] && return 0
  return 1
}

# --- strict line matchers (return 0 if this line should be recorded for term) ---

match_new_api_brand() {
  local line="$1"
  [[ "$line" =~ [Nn][Ee][Ww][[:space:]-]?[Aa][Pp][Ii] ]] && return 0
  [[ "$line" =~ (^|[^A-Za-z0-9_])new-api([^A-Za-z0-9_]|$) ]] && return 0
  return 1
}

match_quantumnous() {
  [[ "$1" =~ QuantumNous ]] && return 0
  return 1
}

match_usd_strict() {
  local line="$1"
  [[ "$line" =~ (^|[^A-Za-z0-9_])USD([^A-Za-z0-9_]|$) ]] && return 0
  [[ "$line" =~ ['\"]USD['\"] ]] && return 0
  [[ "$line" =~ currency[^[:alnum:]]*USD|USD[^[:alnum:]]*currency ]] && return 0
  return 1
}

match_usd_code_var() {
  local line="$1"
  [[ "$line" =~ (usd_exchange_rate|usdExchangeRate|USDExchangeRate|USDPerUnit|usd_per_unit) ]] && return 0
  return 1
}

match_usdc() {
  [[ "$1" =~ (^|[^A-Za-z0-9_])USDC([^A-Za-z0-9_]|$) ]] && return 0
  return 1
}

match_dollar_word() {
  [[ "$1" =~ (^|[^A-Za-z0-9_])dollar(s)?([^A-Za-z0-9_]|$) ]] && return 0
  return 1
}

match_user_visible_dollar_sign() {
  local line="$1"
  local rel="$2"
  [[ "$line" =~ \$\{ ]] && return 1
  [[ "$line" =~ /\.(test|spec)\./ ]] && return 1
  if [[ "$rel" == */locales/*.json ]]; then
    [[ "$line" =~ :[[:space:]]*\"[^\"]*\$[^\"]*\" ]] && return 0
  fi
  if [[ "$rel" == *.tsx ]] || [[ "$rel" == *.ts ]]; then
    [[ "$line" =~ (placeholder|description|title|label|toast|FormDescription|FormLabel) ]] \
      && [[ "$line" =~ \$ ]] && return 0
    [[ "$line" =~ ['\"]\$['\"] ]] && return 0
    [[ "$line" =~ InputGroupAddon.*\$|\$[[:space:]]*/(1M|1K|request) ]] && return 0
  fi
  return 1
}

match_midjourney() {
  [[ "$1" =~ (^|[^A-Za-z0-9_])[Mm]idjourney([^A-Za-z0-9_]|$) ]] && return 0
  return 1
}

match_mj_strict() {
  local line="$1"
  [[ "$line" =~ (^|[^A-Za-z0-9_])MJ([^A-Za-z0-9_]|$) ]] && return 0
  [[ "$line" =~ ['\"]MJ['\"] ]] && return 0
  return 1
}

match_io_net() {
  [[ "$1" =~ io\.net ]] && return 0
  return 1
}

match_github() {
  [[ "$1" =~ [Gg]it[Hh]ub ]] && return 0
  return 1
}

match_release_phrase() {
  local line="$1"
  [[ "$line" =~ [Oo]pen[[:space:]]+release ]] && return 0
  [[ "$line" =~ release[[:space:]]+notes ]] && return 0
  [[ "$line" =~ Calcium-Ion/new-api ]] && return 0
  return 1
}

match_p1_word() {
  local term="$1"
  local line="$2"
  case "$term" in
    Wallet) [[ "$line" =~ (^|[^A-Za-z0-9_])Wallet([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Balance) [[ "$line" =~ (^|[^A-Za-z0-9_])Balance([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Token) [[ "$line" =~ (^|[^A-Za-z0-9_])Token([^A-Za-z0-9_]|$) ]] && return 0 ;;
    User) [[ "$line" =~ (^|[^A-Za-z0-9_])User([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Model) [[ "$line" =~ (^|[^A-Za-z0-9_])Model([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Channel) [[ "$line" =~ (^|[^A-Za-z0-9_])Channel([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Cost) [[ "$line" =~ (^|[^A-Za-z0-9_])Cost([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Fee) [[ "$line" =~ (^|[^A-Za-z0-9_])Fee([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Provider) [[ "$line" =~ (^|[^A-Za-z0-9_])Provider([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Vendor) [[ "$line" =~ (^|[^A-Za-z0-9_])Vendor([^A-Za-z0-9_]|$) ]] && return 0 ;;
    Prompt) [[ "$line" =~ (^|[^A-Za-z0-9_])Prompt([^A-Za-z0-9_]|$) ]] && return 0 ;;
  esac
  return 1
}

match_p1_phrase() {
  local term="$1"
  local line="$2"
  case "$term" in
    API\ Key) [[ "$line" =~ API[[:space:]]+Key ]] && return 0 ;;
    Fail\ Reason) [[ "$line" =~ [Ff]ail[[:space:]]+[Rr]eason ]] && return 0 ;;
    Image\ Preview) [[ "$line" =~ [Ii]mage[[:space:]]+[Pp]review ]] && return 0 ;;
    Header\ Navigation) [[ "$line" =~ [Hh]eader[[:space:]]+[Nn]avigation ]] && return 0 ;;
    Sidebar\ Modules) [[ "$line" =~ [Ss]idebar[[:space:]]+[Mm]odules ]] && return 0 ;;
    Legacy\ Frontend) [[ "$line" =~ [Ll]egacy[[:space:]]+\(?[Ff]rontend ]] && return 0 ;;
    New\ Frontend) [[ "$line" =~ [Nn]ew[[:space:]]+\(?[Ff]rontend ]] && return 0 ;;
    Markdown) [[ "$line" =~ [Mm]arkdown ]] && return 0 ;;
    HTML) [[ "$line" =~ (^|[^A-Za-z0-9_])HTML([^A-Za-z0-9_]|$) ]] && return 0 ;;
    iframe) [[ "$line" =~ iframe ]] && return 0 ;;
  esac
  return 1
}

# Echo classification slug
classify_hit() {
  local rel="$1"
  local line="$2"
  local term="$3"
  local tier="$4"

  if is_boilerplate_line "$line"; then
    echo "comment_or_doc"
    return 0
  fi

  if [[ "$rel" == *update-checker-section.tsx* ]]; then
    echo "p2_deep_settings"
    return 0
  fi

  local _gh_internal='(GitHubOAuth|GitHubClient|github_client|github\.com|TabsTrigger|TabsContent|activeTab)'
  local _has_t_call='t\('
  if [[ "$term" == GitHub ]] && [[ "$line" =~ $_gh_internal ]] && [[ ! "$line" =~ $_has_t_call ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  local _wallet_icon='(lucide-react|Wallet className|<Wallet )'
  if [[ "$term" == Wallet ]] && [[ "$line" =~ $_wallet_icon ]] && [[ ! "$line" =~ $_has_t_call ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  local _usd_cfg='(z\.enum|quota_display_type|quotaDisplayType|value=.USD.|=== .USD.)'
  local _usd_ui='(FormLabel|placeholder|description|title)'
  if [[ "$term" == USD ]] && [[ "$line" =~ $_usd_cfg ]] \
    && [[ ! "$line" =~ $_has_t_call ]] && [[ ! "$line" =~ $_usd_ui ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  if [[ "$rel" == *constants.ts* ]] && [[ "$term" =~ New|LEGACY|new-api ]]; then
    echo "source_logic_keep"
    return 0
  fi

  if [[ "$line" =~ New-Api-User|new-api-dashboard|User-Agent.*new-api ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  if [[ "$line" =~ (^|[^A-Za-z0-9_])id:[[:space:]]*['\"]new-api['\"] ]] \
    || [[ "$line" =~ value:[[:space:]]*['\"]new-api['\"] ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  if match_usd_code_var "$line"; then
    echo "likely_internal_contract"
    return 0
  fi

  if [[ "$line" =~ ^[[:space:]]*// ]] || [[ "$line" =~ ^[[:space:]]*\* ]] || [[ "$line" =~ ^[[:space:]]*/\* ]]; then
    echo "comment_or_doc"
    return 0
  fi

  if [[ "$line" =~ /api/|'/api|\"/api ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  if [[ "$rel" == *.ts ]] && [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?(type|interface|enum)[[:space:]] ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  if [[ "$rel" == */_reports/* ]] || [[ "$rel" == *untranslated* ]]; then
    echo "comment_or_doc"
    return 0
  fi

  if [[ "$rel" == */locales/*.json ]]; then
    if [[ "$line" =~ \"[^\"]+\":[[:space:]]*\" ]]; then
      local value="${line#*:}"
      value="${value#*\"}"
      value="${value#*\"}"
      if [[ "$value" =~ (^|[^A-Za-z0-9_])(${term}|New API|USD|\$|GitHub) ]]; then
        echo "i18n_value_user_visible"
        return 0
      fi
      echo "i18n_key_only"
      return 0
    fi
  fi

  if [[ "$line" =~ t\(['\"] ]]; then
    local _jsx_text_re='>[[:space:]]*[^<]{0,80}t\('
    if [[ ! "$line" =~ $_jsx_text_re ]]; then
      echo "i18n_key_only"
      return 0
    fi
  fi

  if [[ "$rel" == *.tsx ]]; then
    local _tsx_visible_re='(placeholder|title|description|aria-label|FormLabel|FormDescription|toast\.)'
    if [[ "$line" =~ $_tsx_visible_re ]]; then
      echo "tsx_user_visible"
      return 0
    fi
  fi

  if [[ "$rel" == *.ts ]] && [[ "$line" =~ (toast\.|i18next\.t|FormLabel|placeholder|description|title=) ]]; then
    echo "action_required"
    return 0
  fi

  if [[ "$rel" == *.tsx ]]; then
    echo "tsx_user_visible"
    return 0
  fi

  if [[ "$rel" == *.ts ]]; then
    echo "likely_internal_contract"
    return 0
  fi

  echo "likely_internal_contract"
}

is_actionable_class() {
  case "$1" in
    action_required|i18n_value_user_visible|tsx_user_visible) return 0 ;;
    *) return 1 ;;
  esac
}

record_hit() {
  local tier="$1"
  local term="$2"
  local rel="$3"
  local linenum="$4"
  local content="$5"
  local classification="$6"

  local safe="${content//$'\t'/ }"
  safe="${safe//|/\\|}"

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$tier" "$classification" "$rel" "$linenum" "$term" "$safe" >>"$TSV"

  if [[ "$classification" == p2_deep_settings ]]; then
    P2_COUNT=$((P2_COUNT + 1))
    return 0
  fi

  if is_actionable_class "$classification"; then
    if [[ "$tier" == P0 ]]; then
      P0_ACTIONABLE=$((P0_ACTIONABLE + 1))
      printf '%s\t%s\t%s\t%s\t%s\n' "$rel" "$linenum" "$term" "$classification" "$safe" >>"$P0_ROWS"
    else
      P1_ACTIONABLE=$((P1_ACTIONABLE + 1))
      printf '%s\t%s\t%s\t%s\t%s\n' "$rel" "$linenum" "$term" "$classification" "$safe" >>"$P1_ROWS"
    fi
  else
    if [[ "$tier" == P0 ]]; then
      P0_INTERNAL=$((P0_INTERNAL + 1))
    else
      P1_INTERNAL=$((P1_INTERNAL + 1))
    fi
  fi
}

process_candidates() {
  local tier="$1"
  local term="$2"
  local candidates="$3"
  local rel_filter="${4:-}"

  [[ -z "$candidates" ]] && return 0

  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    local filepath="${hit%%:*}"
    local rest="${hit#*:}"
    local linenum="${rest%%:*}"
    local content="${rest#*:}"
    local rel="${filepath#"$ROOT/"}"

    [[ -n "$rel_filter" && "$rel" != *"$rel_filter"* ]] && continue

    local matched=1
    case "$term" in
      New\ API|new-api) match_new_api_brand "$content" || matched=0 ;;
      QuantumNous) match_quantumnous "$content" || matched=0 ;;
      USD) match_usd_strict "$content" || matched=0 ;;
      USDC) match_usdc "$content" || matched=0 ;;
      dollar) match_dollar_word "$content" || matched=0 ;;
      \$) match_user_visible_dollar_sign "$content" "$rel" || matched=0 ;;
      Midjourney) match_midjourney "$content" || matched=0 ;;
      MJ) match_mj_strict "$content" || matched=0 ;;
      io.net) match_io_net "$content" || matched=0 ;;
      GitHub) match_github "$content" || matched=0 ;;
      release) match_release_phrase "$content" || matched=0 ;;
      *) match_p1_word "$term" "$content" || match_p1_phrase "$term" "$content" || matched=0 ;;
    esac
    [[ "$matched" -eq 0 ]] && continue

    local classification
    classification="$(classify_hit "$rel" "$content" "$term" "$tier")"
    record_hit "$tier" "$term" "$rel" "$linenum" "$content" "$classification"
  done <<<"$candidates"
}

P0_ACTIONABLE=0
P1_ACTIONABLE=0
P0_INTERNAL=0
P1_INTERNAL=0
P2_COUNT=0
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

P0_ROWS="$(mktemp)"
P1_ROWS="$(mktemp)"
trap 'rm -f "$P0_ROWS" "$P1_ROWS"' EXIT

echo -e "tier\tclassification\tfile\tline\tterm\tcontent" >"$TSV"

# P0 — strict patterns only
process_candidates P0 "New API" "$(rg_search 'New[[:space:]-]?API|(^|[^A-Za-z0-9_])new-api([^A-Za-z0-9_]|$)')"
process_candidates P0 "QuantumNous" "$(rg_search 'QuantumNous')"
process_candidates P0 "USD" "$(rg_search '(^|[^A-Za-z0-9_])USD([^A-Za-z0-9_]|$)|[\"'\'']USD[\"'\'']')"
process_candidates P0 "USDC" "$(rg_search '(^|[^A-Za-z0-9_])USDC([^A-Za-z0-9_]|$)')"
process_candidates P0 "dollar" "$(rg_search '(^|[^A-Za-z0-9_])dollars?([^A-Za-z0-9_]|$)')"
process_candidates P0 "\$" "$(rg_search '\$')"
process_candidates P0 "Midjourney" "$(rg_search '(^|[^A-Za-z0-9_])[Mm]idjourney([^A-Za-z0-9_]|$)')"
process_candidates P0 "MJ" "$(rg_search '(^|[^A-Za-z0-9_])MJ([^A-Za-z0-9_]|$)|[\"'\'']MJ[\"'\'']')"
process_candidates P0 "io.net" "$(rg_search 'io\.net')"
process_candidates P0 "GitHub" "$(rg_search 'GitHub|github')"
process_candidates P0 "release" "$(rg_search 'Open[[:space:]]+release|release[[:space:]]+notes|Calcium-Ion/new-api')"

# P1
P1_TERMS=(Wallet Balance "API Key" Token Cost Fee User Channel Model Provider Vendor Prompt "Fail Reason" "Image Preview" "Header Navigation" "Sidebar Modules" "Legacy Frontend" "New Frontend" Markdown HTML iframe)
for t in "${P1_TERMS[@]}"; do
  pat="$t"
  [[ "$t" == "API Key" ]] && pat='API[[:space:]]+Key'
  [[ "$t" == "Fail Reason" ]] && pat='Fail[[:space:]]+Reason'
  [[ "$t" == "Image Preview" ]] && pat='Image[[:space:]]+Preview'
  [[ "$t" == "Header Navigation" ]] && pat='Header[[:space:]]+Navigation'
  [[ "$t" == "Sidebar Modules" ]] && pat='Sidebar[[:space:]]+Modules'
  [[ "$t" == "Legacy Frontend" ]] && pat='Legacy[[:space:]]+.*Frontend'
  [[ "$t" == "New Frontend" ]] && pat='New[[:space:]]+.*Frontend'
  process_candidates P1 "$t" "$(rg_search "$pat")"
done

# Top files (actionable only)
TOP_FILES="$(mktemp)"
{
  awk -F'\t' 'NR>1 && ($2=="action_required" || $2=="i18n_value_user_visible" || $2=="tsx_user_visible") {
    f=$3; t=$1
    if(t=="P0") p0[f]++; else if(t=="P1") p1[f]++
  }
  END {
    for (f in p0) print p0[f]+0, p1[f]+0, f
    for (f in p1) if (!(f in p0)) print 0, p1[f]+0, f
  }' "$TSV" | sort -rn -k1,1 | head -20
} >"$TOP_FILES" 2>/dev/null || true

P0_MD_LIMIT=300
P1_MD_LIMIT=300
P0_EXTRA=$((P0_ACTIONABLE > P0_MD_LIMIT ? P0_ACTIONABLE - P0_MD_LIMIT : 0))
P1_EXTRA=$((P1_ACTIONABLE > P1_MD_LIMIT ? P1_ACTIONABLE - P1_MD_LIMIT : 0))

{
  echo "# Legacy / risk terms scan report"
  echo ""
  echo "- **Generated (UTC):** $GENERATED_AT"
  echo "- **Scan root:** \`web/default/src\`"
  echo "- **Full export:** \`reports/legacy-terms-full.tsv\`"
  echo ""
  echo "## Summary"
  echo ""
  echo "| Tier | Actionable | Internal/Ignored | Notes |"
  echo "|------|----------:|-----------------:|-------|"
  echo "| P0 | $P0_ACTIONABLE | $P0_INTERNAL | 品牌/货币/开源痕迹（用户可见优先） |"
  echo "| P1 | $P1_ACTIONABLE | $P1_INTERNAL | 术语语义产品化 |"
  echo "| P2 | $P2_COUNT | — | 深层配置（如更新检查 GitHub） |"
  echo ""
  echo "## Top actionable files"
  echo ""
  echo "| File | P0 | P1 | Suggested priority |"
  echo "|------|---:|---:|-------------------|"
  if [[ -s "$TOP_FILES" ]]; then
    while read -r p0c p1c f; do
      pri="P1"
      [[ "${p0c:-0}" -gt 0 ]] && pri="P0"
      echo "| \`$f\` | ${p0c:-0} | ${p1c:-0} | $pri |"
    done <"$TOP_FILES"
  else
    echo "| _none_ | 0 | 0 | — |"
  fi
  echo ""
  echo "---"
  echo ""
  echo "## P0 actionable (first $P0_MD_LIMIT)"
  echo ""
  if [[ "$P0_ACTIONABLE" -eq 0 ]]; then
    echo "_No P0 actionable hits._"
  else
    echo "| File | Line | Term | Classification | Content |"
    echo "|------|-----:|------|----------------|---------|"
    head -n "$P0_MD_LIMIT" "$P0_ROWS" | while IFS=$'\t' read -r f l t c rest; do
      echo "| \`$f\` | $l | $t | $c | \`${rest}\` |"
    done
    if [[ "$P0_EXTRA" -gt 0 ]]; then
      echo ""
      echo "_还有 ${P0_EXTRA} 条 P0 actionable，详见 \`reports/legacy-terms-full.tsv\`（筛选 classification）。_"
    fi
  fi
  echo ""
  echo "---"
  echo ""
  echo "## P1 actionable (first $P1_MD_LIMIT)"
  echo ""
  if [[ "$P1_ACTIONABLE" -eq 0 ]]; then
    echo "_No P1 actionable hits._"
  else
    echo "| File | Line | Term | Classification | Content |"
    echo "|------|-----:|------|----------------|---------|"
    head -n "$P1_MD_LIMIT" "$P1_ROWS" | while IFS=$'\t' read -r f l t c rest; do
      echo "| \`$f\` | $l | $t | $c | \`${rest}\` |"
    done
    if [[ "$P1_EXTRA" -gt 0 ]]; then
      echo ""
      echo "_还有 ${P1_EXTRA} 条 P1 actionable，详见 \`reports/legacy-terms-full.tsv\`._"
    fi
  fi
  echo ""
  echo "## Classification legend"
  echo ""
  echo "| Classification | Meaning |"
  echo "|----------------|---------|"
  echo "| action_required | 优先人工修复（用户可见文案） |"
  echo "| i18n_value_user_visible | i18n JSON 的 value 命中 |"
  echo "| tsx_user_visible | TSX 展示层命中 |"
  echo "| i18n_key_only | 仅 i18n key 英文，通常不改 key |"
  echo "| likely_internal_contract | 字段名/API/类型，禁止改名 |"
  echo "| source_logic_keep | 遗留名屏蔽等保留逻辑 |"
  echo "| comment_or_doc | 注释/许可证 |"
  echo "| p2_deep_settings | P2 深层页（如 GitHub 更新检查） |"
} >"$REPORT"

cat >"$META" <<EOF
GENERATED_AT=$GENERATED_AT
P0_ACTIONABLE=$P0_ACTIONABLE
P1_ACTIONABLE=$P1_ACTIONABLE
P0_INTERNAL=$P0_INTERNAL
P1_INTERNAL=$P1_INTERNAL
P2_COUNT=$P2_COUNT
REPORT_PATH=$REPORT
TSV_PATH=$TSV
EOF

echo "Report written: $REPORT"
echo "TSV written: $TSV"
echo "P0 actionable: $P0_ACTIONABLE (internal $P0_INTERNAL) | P1 actionable: $P1_ACTIONABLE (internal $P1_INTERNAL) | P2: $P2_COUNT"
