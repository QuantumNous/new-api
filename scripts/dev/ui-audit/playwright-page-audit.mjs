/**
 * Playwright page audit: screenshots + visible text (body.innerText) risk scan.
 *
 *   BASE_URL=http://192.168.18.92:3001 \
 *   UI_AUDIT_USERNAME=aioc_demo_zhang UI_AUDIT_PASSWORD='DevUi@123456' \
 *   node scripts/dev/ui-audit/playwright-page-audit.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

function resolvePlaywrightBrowsersPath() {
  const candidates = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache/ms-playwright'),
  ].filter(Boolean)

  for (const base of candidates) {
    try {
      const hasBrowser = fs
        .readdirSync(base)
        .some((name) => /^chromium/i.test(name))
      if (hasBrowser) return base
    } catch {
      /* try next */
    }
  }
  return candidates[0] || path.join(os.homedir(), '.cache/ms-playwright')
}

process.env.PLAYWRIGHT_BROWSERS_PATH = resolvePlaywrightBrowsersPath()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const requireFromWebDefault = createRequire(
  path.join(ROOT, 'web/default/package.json')
)
const { chromium } = requireFromWebDefault('@playwright/test')
const SCOPE_FILE = path.join(__dirname, 'UI_ACCEPTANCE_SCOPE.md')
const OUT_DIR = path.join(__dirname, 'screenshots')
const REPORT_DIR = path.join(__dirname, 'reports')
const PAGE_REPORT_MD = path.join(REPORT_DIR, 'page-audit-report.md')
const PAGE_REPORT_TSV = path.join(REPORT_DIR, 'page-audit-full.tsv')
const PAGE_META = path.join(REPORT_DIR, 'page-audit-meta.env')

const BASE_URL = (process.env.BASE_URL || 'http://192.168.18.92:3001').replace(
  /\/$/,
  ''
)
const USERNAME =
  process.env.UI_AUDIT_USERNAME || process.env.DEMO_USERNAME || ''
const PASSWORD =
  process.env.UI_AUDIT_PASSWORD || process.env.DEMO_PASSWORD || ''
const HAS_AUTH = Boolean(USERNAME && PASSWORD)

/** P0 — customer-visible high risk */
const P0_RULES = [
  { term: 'New API', re: /\bNew\s*API\b/i },
  { term: 'QuantumNous', re: /QuantumNous/i },
  { term: 'USD', re: /\bUSD\b/ },
  { term: 'dollar', re: /\bdollars?\b/i },
  { term: '美元', re: /美元/ },
  { term: 'Midjourney', re: /\bMidjourney\b/i },
  { term: 'MJ', re: /\bMJ\b/ },
  { term: 'Uptime Kuma', re: /Uptime\s*Kuma/i },
  { term: 'io.net', re: /\bio\.net\b/i },
  { term: 'GitHub release', re: /GitHub\s*release/i },
  { term: 'Open release', re: /Open\s*release/i },
  { term: 'Calcium-Ion', re: /Calcium-Ion/i },
  { term: 'new-api', re: /\bnew-api\b/i },
  { term: 'Open in GitHub', re: /Open\s+in\s+GitHub/i },
  { term: 'System Settings', re: /System\s+Settings/i },
  { term: 'Operation Settings', re: /Operation\s+Settings/i },
  { term: 'Group & Model Pricing', re: /Group\s*&\s*Model\s+Pricing/i },
]

/** P1 — terminology review */
const P1_RULES = [
  { term: 'API Key', re: /\bAPI\s*Keys?\b/i },
  { term: 'Token', re: /\bTokens?\b/ },
  { term: 'Wallet', re: /\bWallet\b/i },
  { term: 'Balance', re: /\bBalance\b/i },
  { term: 'User', re: /\bUsers?\b/ },
  { term: 'Channel', re: /\bChannels?\b/ },
  { term: 'Model', re: /\bModels?\b/ },
  { term: 'Provider', re: /\bProviders?\b/i },
  { term: 'Cost', re: /\bCosts?\b/i },
  { term: 'Fee', re: /\bFees?\b/i },
  { term: 'Prompt', re: /\bPrompts?\b/i },
  { term: 'Fail Reason', re: /Fail\s+Reason/i },
  { term: 'Image Preview', re: /Image\s+Preview/i },
  { term: 'Playground', re: /\bPlayground\b/i },
  { term: 'Dashboard', re: /\bDashboard\b/i },
]

const PUBLIC_PAGES = [
  { tier: 'p0', path: '/', auth: false, label: 'home' },
  { tier: 'p0', path: '/sign-in', altPaths: ['/login'], auth: false, label: 'login' },
  { tier: 'p0', path: '/pricing', auth: false, label: 'pricing' },
  { tier: 'p0', path: '/rankings', auth: false, label: 'rankings' },
  { tier: 'p0', path: '/about', auth: false, label: 'about' },
]

const AUTH_PAGES = [
  { tier: 'p0', path: '/dashboard/overview', altPaths: ['/dashboard'], auth: true, label: 'dashboard' },
  { tier: 'p0', path: '/keys', auth: true, label: 'keys' },
  { tier: 'p0', path: '/usage-logs/common', auth: true, label: 'usage-logs-common' },
  { tier: 'p0', path: '/usage-logs/task', auth: true, label: 'usage-logs-task' },
  { tier: 'p0', path: '/usage-logs/drawing', auth: true, label: 'usage-logs-drawing' },
  { tier: 'p0', path: '/wallet', auth: true, label: 'wallet' },
  { tier: 'p0', path: '/system-settings/site/system-info', auth: true, label: 'system-settings-site-system-info' },
  { tier: 'p1', path: '/redemption-codes', auth: true, label: 'redemption-codes' },
  { tier: 'p1', path: '/subscriptions', auth: true, label: 'subscriptions' },
  { tier: 'p1', path: '/models/metadata', auth: true, label: 'models-metadata' },
  { tier: 'p1', path: '/channels', auth: true, label: 'channels' },
  { tier: 'p1', path: '/users', auth: true, label: 'users' },
  { tier: 'p1', path: '/groups', auth: true, label: 'groups' },
  { tier: 'p1', path: '/system-settings/site/notice', auth: true, label: 'system-settings-site-notice' },
  { tier: 'p1', path: '/system-settings/site/header-navigation', auth: true, label: 'system-settings-site-header-navigation' },
  { tier: 'p1', path: '/system-settings/site/sidebar-modules', auth: true, label: 'system-settings-site-sidebar-modules' },
]

function pageId(def) {
  return `${def.tier}-${def.label}`
}

function scanText(text, rules) {
  const hits = []
  for (const rule of rules) {
    rule.re.lastIndex = 0
    if (rule.re.test(text)) hits.push(rule.term)
  }
  return hits
}

function parseScopePages(scopePath) {
  if (!fs.existsSync(scopePath)) return null
  const lines = fs.readFileSync(scopePath, 'utf8').split('\n')
  let tier = null
  const parsed = []
  for (const line of lines) {
    if (/^## P0\b/i.test(line)) tier = 'p0'
    else if (/^## P1\b/i.test(line)) tier = 'p1'
    else if (/^## P2\b/i.test(line)) tier = null
    const m = line.match(/\|\s*`(\/[^`]+)`\s*\|/)
    if (!m || !tier) continue
    const rawPath = normalizePath(m[1].split(/\s+/)[0])
    const label =
      rawPath === '/sign-in'
        ? 'login'
        : rawPath.replace(/^\//, '').replace(/\//g, '-') || 'home'
    const auth =
      !PUBLIC_PAGES.some(
        (p) => p.path === rawPath || p.altPaths?.includes(rawPath)
      ) && rawPath !== '/sign-in'
    parsed.push({
      tier,
      path: rawPath,
      altPaths:
        rawPath === '/dashboard/overview' ? ['/dashboard'] : undefined,
      auth,
      label,
    })
  }
  return parsed.length ? parsed : null
}

function normalizePath(routePath) {
  if (routePath === '/login') return '/sign-in'
  if (routePath === '/dashboard') return '/dashboard/overview'
  return routePath
}

function buildPageList() {
  const fromScope = parseScopePages(SCOPE_FILE)
  const authPages = (fromScope ? fromScope.filter((p) => p.auth) : AUTH_PAGES).map(
    (p) => ({ ...p, path: normalizePath(p.path) })
  )
  const byId = new Map()
  for (const p of PUBLIC_PAGES) {
    byId.set(pageId(p), { ...p, path: normalizePath(p.path) })
  }
  for (const p of authPages) {
    byId.set(pageId(p), p)
  }
  const dashboard = {
    tier: 'p0',
    path: '/dashboard/overview',
    altPaths: ['/dashboard'],
    auth: true,
    label: 'dashboard',
  }
  byId.set(pageId(dashboard), dashboard)
  return [...byId.values()]
}

/**
 * Usage-logs tables often show HTTP status 500, quotas, and timings in cells.
 * A bare "500" in innerText is not an error page (old heuristic caused false fails).
 */
const USAGE_LOGS_POSITIVE_MARKERS = [
  '词元消耗明细',
  '调用时间',
  '应用接入密钥',
  '模型资源',
  '词元消耗',
]

function isErrorPageTitle(pageTitle) {
  const title = (pageTitle || '').trim()
  if (title === '500') return true
  if (/^Internal Server Error\b/i.test(title)) return true
  return false
}

/** Body (or title) must match explicit error-page copy — not isolated digits */
const ERROR_PAGE_BODY_PATTERNS = [
  /\b500\s+Internal\s+Server\s+Error\b/i,
  /\bInternal\s+Server\s+Error\b/i,
  /\bUnexpected\s+Application\s+Error\b/i,
  /\bApplication\s+Error\b/i,
  /\bSomething\s+went\s+wrong\b/i,
  /服务器错误/,
  /页面加载失败/,
]

function routeLooksLikeUsageLogs(routePath = '') {
  return /\/usage-logs(?:\/|$)/i.test(routePath)
}

function matchesUsageLogsPositive(pageText, routePath = '') {
  if (!routeLooksLikeUsageLogs(routePath)) return false
  return USAGE_LOGS_POSITIVE_MARKERS.some((marker) => pageText.includes(marker))
}

function looksLikeErrorPage(pageText, pageTitle) {
  const title = (pageTitle || '').trim()
  if (isErrorPageTitle(title)) {
    return { failed: true, reason: `Error page title: ${title.slice(0, 80)}` }
  }
  const combined = `${title}\n${pageText}`
  for (const re of ERROR_PAGE_BODY_PATTERNS) {
    if (re.test(combined)) {
      return {
        failed: true,
        reason: `Error page copy matched: ${re.source.slice(0, 60)}`,
      }
    }
  }
  return { failed: false, reason: '' }
}

function detectFailure(pageText, pageTitle, finalUrl, errorMessage, routePath = '') {
  if (errorMessage) {
    return { failed: true, reason: errorMessage.slice(0, 200) }
  }

  if (finalUrl.includes('/sign-in') || finalUrl.includes('/login')) {
    return { failed: false, reason: '' }
  }

  const pathKey = routePath || finalUrl

  // Positive matcher wins for usage-logs (e.g. /usage-logs/common with status column "500")
  if (matchesUsageLogsPositive(pageText, pathKey)) {
    return { failed: false, reason: '' }
  }

  const errorCheck = looksLikeErrorPage(pageText, pageTitle)
  if (errorCheck.failed) return errorCheck

  if (
    /404|Not Found|页面不存在/i.test(pageText) &&
    /404|not found/i.test(pageTitle)
  ) {
    return { failed: true, reason: '404 Not Found' }
  }

  return { failed: false, reason: '' }
}

async function hasStoredUser(page) {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('user')
      if (!raw) return false
      const u = JSON.parse(raw)
      return Boolean(u && (u.id || u.username))
    } catch {
      return false
    }
  })
}

/** @returns {{ ok: boolean, reason: 'ok' | 'rate_limited' | 'failed' }} */
async function tryLogin(page) {
  const loginPaths = ['/sign-in', '/login']
  for (const loginPath of loginPaths) {
    try {
      const res = await page.goto(`${BASE_URL}${loginPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })
      await page.waitForTimeout(1000)
      if (res && res.status() >= 400 && res.status() !== 404) {
        continue
      }
      const user = page.locator(
        'input[name="username"], input#username, input[name="email"], form input[type="text"]'
      ).first()
      const pass = page.locator(
        'input[name="password"], input#password, input[type="password"]'
      ).first()
      if ((await user.count()) === 0 || (await pass.count()) === 0) continue

      const legal = page.locator(
        'input[type="checkbox"][aria-label*="agree"], input[type="checkbox"]'
      ).first()
      if ((await legal.count()) > 0 && !(await legal.isChecked())) {
        await legal.check({ force: true })
      }

      await user.fill(USERNAME)
      await pass.fill(PASSWORD)

      const loginResponse = page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          /\/api\/.*login|\/login/i.test(r.url()),
        { timeout: 20000 }
      )
      const submit = page
        .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("登录")')
        .first()
      if ((await submit.count()) > 0) await submit.click()
      else await pass.press('Enter')

      let loginHttpStatus = null
      try {
        const response = await loginResponse
        loginHttpStatus = response?.status() ?? null
      } catch {
        /* SPA may not expose login XHR in dev proxy */
      }

      if (loginHttpStatus === 429) {
        console.warn(
          'WARN login rate limited (HTTP 429); stopping login retries — auth pages → skipped_rate_limited'
        )
        return { ok: false, reason: 'rate_limited' }
      }

      try {
        await page.waitForFunction(
          () => {
            try {
              const raw = window.localStorage.getItem('user')
              if (!raw) return false
              const u = JSON.parse(raw)
              return Boolean(u && (u.id || u.username))
            } catch {
              return false
            }
          },
          { timeout: 20000 }
        )
      } catch {
        await page.waitForTimeout(3000)
      }

      if (await hasStoredUser(page)) {
        console.log('OK login', page.url())
        return { ok: true, reason: 'ok' }
      }
    } catch (err) {
      console.warn('WARN login path', loginPath, err.message)
    }
  }
  return { ok: false, reason: 'failed' }
}

async function auditPage(page, def, loggedIn, loginReason = 'failed') {
  const id = pageId(def)
  const pathsToTry = [def.path, ...(def.altPaths || [])]
  const screenshotFile = path.join(OUT_DIR, `${id}.png`)
  let status = 'ok'
  let error = ''
  let finalUrl = ''
  let p0Hits = []
  let p1Hits = []
  let bodyText = ''

  if (def.auth && loginReason === 'rate_limited') {
    return {
      page: id,
      path: def.path,
      url: `${BASE_URL}${def.path}`,
      status: 'skipped_rate_limited',
      screenshot: '',
      p0Hits: [],
      p1Hits: [],
      matchedTerms: '',
      error: 'Login rate limited (HTTP 429)',
    }
  }

  if (def.auth && !loggedIn) {
    return {
      page: id,
      path: def.path,
      url: `${BASE_URL}${def.path}`,
      status: 'skipped_auth_required',
      screenshot: '',
      p0Hits: [],
      p1Hits: [],
      matchedTerms: '',
      error: 'Login credentials not provided',
    }
  }

  let navigated = false
  for (const route of pathsToTry) {
    const url = `${BASE_URL}${route}`
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      await page.waitForTimeout(1000)
      finalUrl = page.url()
      bodyText = await page.evaluate(() => document.body?.innerText || '')
      const title = await page.title()
      navigated = true

      if (response && response.status() === 404) {
        status = 'unavailable'
        error = `HTTP 404 for ${route}`
      } else if (response && response.status() >= 500) {
        status = 'failed'
        error = `HTTP ${response.status()}`
      } else {
        const fail = detectFailure(bodyText, title, finalUrl, '', def.path)
        if (fail.failed) {
          status = 'failed'
          error = fail.reason || `HTTP ${response?.status() ?? 'unknown'}`
        }
      }
      if (
        def.auth &&
        loggedIn &&
        /\/sign-in|\/login/.test(new URL(finalUrl).pathname)
      ) {
        status = 'failed'
        error = error || 'Redirected to sign-in (session invalid or forbidden)'
      }
      break
    } catch (err) {
      error = err.message
      if (pathsToTry.indexOf(route) === pathsToTry.length - 1) {
        status = 'failed'
        try {
          bodyText = await page.evaluate(() => document.body?.innerText || '')
        } catch {
          bodyText = ''
        }
        finalUrl = page.url() || url
      }
    }
  }

  if (!navigated && status === 'ok') {
    status = 'unavailable'
    error = error || 'Navigation failed for all path variants'
  }

  p0Hits = scanText(bodyText, P0_RULES)
  p1Hits = scanText(bodyText, P1_RULES)
  const matchedTerms = [...p0Hits, ...p1Hits].join('; ')

  try {
    await page.screenshot({ path: screenshotFile, fullPage: true })
  } catch (err) {
    console.error('WARN screenshot', id, err.message)
    if (!error) error = `Screenshot failed: ${err.message}`
  }

  return {
    page: id,
    path: def.path,
    url: finalUrl || `${BASE_URL}${def.path}`,
    status,
    screenshot: fs.existsSync(screenshotFile) ? screenshotFile : '',
    p0Hits,
    p1Hits,
    matchedTerms,
    error,
  }
}

function writeReports(results) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const header = [
    'page',
    'url',
    'status',
    'screenshot',
    'p0_hits',
    'p1_hits',
    'matched_terms',
    'error',
  ]
  const tsvLines = [header.join('\t')]
  for (const r of results) {
    tsvLines.push(
      [
        r.page,
        r.url,
        r.status,
        r.screenshot,
        r.p0Hits.length,
        r.p1Hits.length,
        r.matchedTerms.replace(/\t/g, ' '),
        (r.error || '').replace(/\t/g, ' '),
      ].join('\t')
    )
  }
  fs.writeFileSync(PAGE_REPORT_TSV, `${tsvLines.join('\n')}\n`)

  let p0Visible = 0
  let p1Visible = 0
  let failedCount = 0
  let skippedAuth = 0
  let skippedRateLimited = 0
  for (const r of results) {
    p0Visible += r.p0Hits.length
    p1Visible += r.p1Hits.length
    if (r.status === 'failed') failedCount += 1
    if (r.status === 'skipped_auth_required') skippedAuth += 1
    if (r.status === 'skipped_rate_limited') skippedRateLimited += 1
  }

  const md = []
  md.push('# Page audit report (visible text + screenshots)')
  md.push('')
  md.push(`- **Generated:** ${new Date().toISOString()}`)
  md.push(`- **BASE_URL:** ${BASE_URL}`)
  md.push(`- **Auth:** ${HAS_AUTH ? `yes (${USERNAME})` : 'no — auth pages skipped'}`)
  md.push(`- **Screenshots:** \`screenshots/\``)
  md.push('')
  md.push('## Summary')
  md.push('')
  md.push(`| Metric | Count |`)
  md.push(`|--------|------:|`)
  md.push(`| Pages audited | ${results.length} |`)
  md.push(`| P0 visible term hits | ${p0Visible} |`)
  md.push(`| P1 visible term hits | ${p1Visible} |`)
  md.push(`| Failed pages | ${failedCount} |`)
  md.push(`| Skipped (auth required) | ${skippedAuth} |`)
  md.push(`| Skipped (login rate limited) | ${skippedRateLimited} |`)
  md.push('')
  md.push('## Pages')
  md.push('')
  md.push('| Page | Status | P0 hits | P1 hits | Screenshot | Notes |')
  md.push('|------|--------|--------:|--------:|------------|-------|')
  for (const r of results) {
    const shot = r.screenshot
      ? `\`${path.basename(r.screenshot)}\``
      : '—'
    const notes = [r.matchedTerms, r.error].filter(Boolean).join(' — ')
    md.push(
      `| ${r.page} | ${r.status} | ${r.p0Hits.length} | ${r.p1Hits.length} | ${shot} | ${notes || '—'} |`
    )
  }
  md.push('')
  md.push('## P0 risk terms scanned')
  md.push('')
  md.push(P0_RULES.map((r) => `- ${r.term}`).join('\n'))
  md.push('')
  md.push('## P1 terms scanned')
  md.push('')
  md.push(P1_RULES.map((r) => `- ${r.term}`).join('\n'))
  md.push('')
  md.push('## Failure detection notes')
  md.push('')
  md.push(
    'Earlier runs treated any `500` substring in `body.innerText` as a server error. ' +
      'On `/usage-logs/common`, table cells often contain HTTP status codes (e.g. 500), quotas, or timings — that is normal data, not the `/500` error route or an ErrorBoundary. ' +
      'Failed now requires explicit error-page copy (e.g. `Internal Server Error`, `Something went wrong`) or an error title of `500` / `Internal Server Error`. ' +
      'Usage-logs routes pass when expected Chinese column labels are visible (positive matcher).'
  )
  md.push('')
  fs.writeFileSync(PAGE_REPORT_MD, `${md.join('\n')}\n`)

  const auditStatus =
    failedCount > 0 ? 'partial' : p0Visible > 0 ? 'partial' : 'success'
  const metaLines = [
    `PAGE_AUDIT_STATUS=${auditStatus}`,
    `PAGE_P0_VISIBLE_HITS=${p0Visible}`,
    `PAGE_P1_VISIBLE_HITS=${p1Visible}`,
    `PAGE_FAILED_COUNT=${failedCount}`,
    `PAGE_SKIPPED_AUTH_COUNT=${skippedAuth}`,
    `PAGE_SKIPPED_RATE_LIMITED_COUNT=${skippedRateLimited}`,
  ]
  fs.writeFileSync(PAGE_META, `${metaLines.join('\n')}\n`)

  return {
    p0Visible,
    p1Visible,
    failedCount,
    skippedAuth,
    skippedRateLimited,
    auditStatus,
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pages = buildPageList()
  console.log(`Pages to audit: ${pages.length}`)
  console.log(`BASE_URL=${BASE_URL}`)
  console.log(`HAS_AUTH=${HAS_AUTH}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  let loggedIn = false
  let loginReason = 'failed'
  if (HAS_AUTH) {
    const loginResult = await tryLogin(page)
    loggedIn = loginResult.ok
    loginReason = loginResult.reason
    if (loginReason === 'rate_limited') {
      console.warn('WARN: login rate limited (429); auth pages → skipped_rate_limited')
    } else if (!loggedIn) {
      console.warn('WARN: login failed; auth pages → skipped_auth_required')
    }
  }

  const publicPages = pages.filter((p) => !p.auth)
  const authPages = pages.filter((p) => p.auth)
  const orderedPages =
    loggedIn && authPages.length
      ? [...authPages, ...publicPages]
      : pages

  const results = []
  for (const def of orderedPages) {
    const row = await auditPage(page, def, loggedIn, loginReason)
    results.push(row)
    console.log(
      row.status.padEnd(22),
      row.page,
      `P0=${row.p0Hits.length}`,
      `P1=${row.p1Hits.length}`,
      row.error || ''
    )
  }

  await browser.close()

  const stats = writeReports(results)
  console.log('')
  console.log('Report:', PAGE_REPORT_MD)
  console.log('TSV:', PAGE_REPORT_TSV)
  console.log(
    `P0 visible=${stats.p0Visible} P1 visible=${stats.p1Visible} failed=${stats.failedCount}`
  )

  process.exit(stats.failedCount > 0 && !HAS_AUTH ? 0 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
