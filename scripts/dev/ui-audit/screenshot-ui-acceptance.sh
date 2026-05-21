#!/usr/bin/env bash
# UI acceptance screenshots — requires Playwright (not bundled by default).
# Does not modify application source. Output under screenshots/ (gitignored).
set -euo pipefail

AUDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$AUDIT_DIR/../../.." && pwd)"
OUT_DIR="$AUDIT_DIR/screenshots"
BASE_URL="${BASE_URL:-http://192.168.18.92:3001}"
DEMO_USERNAME="${DEMO_USERNAME:-}"
DEMO_PASSWORD="${DEMO_PASSWORD:-}"

mkdir -p "$OUT_DIR"

ROUTES=(
  "/"
  "/login"
  "/keys"
  "/usage-logs/common"
  "/usage-logs/task"
  "/usage-logs/drawing"
  "/wallet"
  "/redemption-codes"
  "/subscriptions"
  "/models/metadata"
  "/system-settings/site/system-info"
  "/system-settings/site/notice"
  "/system-settings/site/header-navigation"
  "/system-settings/site/sidebar-modules"
)

has_playwright() {
  local pkg="$ROOT/web/default/package.json"
  [[ -f "$pkg" ]] || return 1
  grep -qE '"@playwright/test"|"playwright"' "$pkg" 2>/dev/null
}

write_skeleton() {
  local helper="$AUDIT_DIR/playwright-screenshots.mjs"
  if [[ -f "$helper" ]]; then
    echo "Using existing: $helper"
    return 0
  fi
  cat >"$helper" <<'EOF'
/**
 * Optional Playwright screenshot runner.
 * Install once in web/default:
 *   cd web/default && pnpm add -D @playwright/test && pnpm exec playwright install chromium
 *
 * Run from repo root:
 *   BASE_URL=http://192.168.18.92:3001 \
 *   DEMO_USERNAME=aioc_demo_zhang DEMO_PASSWORD='DevUi@123456' \
 *   node scripts/dev/ui-audit/playwright-screenshots.mjs
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'screenshots')
const BASE_URL = process.env.BASE_URL || 'http://192.168.18.92:3001'
const DEMO_USERNAME = process.env.DEMO_USERNAME || ''
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || ''

const ROUTES = [
  '/',
  '/login',
  '/keys',
  '/usage-logs/common',
  '/usage-logs/task',
  '/usage-logs/drawing',
  '/wallet',
  '/redemption-codes',
  '/subscriptions',
  '/models/metadata',
  '/system-settings/site/system-info',
  '/system-settings/site/notice',
  '/system-settings/site/header-navigation',
  '/system-settings/site/sidebar-modules',
]

function slug(p) {
  return p.replace(/^\//, '').replace(/\//g, '_') || 'root'
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
})
const page = await context.newPage()

if (DEMO_USERNAME && DEMO_PASSWORD) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  // Adjust selectors to match your login form if needed.
  const user = page.locator('input[name="username"], input[type="text"]').first()
  const pass = page.locator('input[name="password"], input[type="password"]').first()
  if ((await user.count()) > 0) {
    await user.fill(DEMO_USERNAME)
    await pass.fill(DEMO_PASSWORD)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForTimeout(2000)
  }
}

for (const route of ROUTES) {
  const url = `${BASE_URL}${route}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    const file = path.join(OUT_DIR, `${slug(route)}.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log('OK', file)
  } catch (err) {
    console.error('FAIL', route, err.message)
  }
}

await browser.close()
EOF
  echo "Wrote skeleton: $helper"
}

if has_playwright && command -v node >/dev/null 2>&1; then
  write_skeleton
  echo "Playwright dependency found in web/default/package.json."
  echo "Running: node $AUDIT_DIR/playwright-screenshots.mjs"
  echo "BASE_URL=$BASE_URL"
  export BASE_URL DEMO_USERNAME DEMO_PASSWORD
  if node "$AUDIT_DIR/playwright-screenshots.mjs"; then
    echo "Screenshots saved under: $OUT_DIR"
    exit 0
  fi
  echo "Playwright run failed. See README.md for setup." >&2
  exit 1
fi

write_skeleton

cat <<EOF

Playwright is NOT installed in this repo (web/default/package.json has no playwright).

Screenshot automation is NOT runnable yet. Options:

  A) Install Playwright (dev only, requires package.json change — do in a dedicated PR):
     cd web/default
     pnpm add -D @playwright/test
     pnpm exec playwright install chromium
     cd ../..
     BASE_URL=$BASE_URL \\
     DEMO_USERNAME=aioc_demo_zhang DEMO_PASSWORD='DevUi@123456' \\
     bash scripts/dev/ui-audit/screenshot-ui-acceptance.sh

  B) Manual acceptance: follow UI_ACCEPTANCE_SCOPE.md and capture PNGs into:
     scripts/dev/ui-audit/screenshots/  (gitignored)

Configured defaults:
  BASE_URL=$BASE_URL
  DEMO_USERNAME=${DEMO_USERNAME:-<unset>}
  DEMO_PASSWORD=${DEMO_PASSWORD:+<set>}${DEMO_PASSWORD:-<unset>}

EOF

exit 0
