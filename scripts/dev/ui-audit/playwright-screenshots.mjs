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
