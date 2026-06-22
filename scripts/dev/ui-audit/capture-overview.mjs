/**
 * Single-page Playwright capture for /dashboard/overview visual acceptance.
 *
 * Usage (credentials via env — do not commit passwords):
 *   BASE_URL=http://192.168.18.94:3001 \
 *   UI_AUDIT_USERNAME=admin \
 *   UI_AUDIT_PASSWORD='***' \
 *   node scripts/dev/ui-audit/capture-overview.mjs
 *
 * Outputs:
 *   - scripts/dev/ui-audit/artifacts/dashboard-overview-latest.png
 *   - docs/checklists/ui-snapshots/dashboard-overview-latest.png
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

function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const requireFromWebDefault = createRequire(
  path.join(ROOT, 'web/default/package.json')
)
const { chromium } = requireFromWebDefault('@playwright/test')

const BASE_URL = (process.env.BASE_URL || 'http://192.168.18.94:3001').replace(
  /\/$/,
  ''
)
const API_BASE_URL = (
  process.env.API_BASE_URL ||
  BASE_URL.replace(/:3001(?=\/|$)/, ':3000')
).replace(/\/$/, '')
const USERNAME =
  process.env.UI_AUDIT_USERNAME || process.env.DEMO_USERNAME || ''
const PASSWORD =
  process.env.UI_AUDIT_PASSWORD || process.env.DEMO_PASSWORD || ''
const ROUTE = '/dashboard/overview'
const VIEWPORT = { width: 1440, height: 900 }
const LOCALE = process.env.UI_AUDIT_LOCALE || 'zh-CN'

const ARTIFACT_DIR = path.join(__dirname, 'artifacts')
const DOCS_SNAPSHOT_DIR = path.join(ROOT, 'docs/checklists/ui-snapshots')
const OUTPUT_NAME = 'dashboard-overview-latest.png'

const RAW_I18N_PATTERN = /^Dashboard [A-Za-z0-9 ]+$/

async function applyChineseLocale(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('i18nextLng', 'zh')
    } catch {
      /* ignore */
    }
  })
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

async function tryApiLogin(context) {
  if (!USERNAME || !PASSWORD) {
    return { ok: false, reason: 'missing_credentials' }
  }
  try {
    const response = await context.request.post(
      `${API_BASE_URL}/api/user/login?turnstile=`,
      {
        data: { username: USERNAME, password: PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok() || !body?.success) {
      return {
        ok: false,
        reason: 'api_rejected',
        message: body?.message || `HTTP ${response.status()}`,
      }
    }
    return { ok: true, reason: 'api_ok', data: body.data }
  } catch (err) {
    return { ok: false, reason: 'api_error', message: err.message }
  }
}

async function tryLogin(page, context) {
  const apiResult = await tryApiLogin(context)
  if (apiResult.ok) {
    await page.goto(`${BASE_URL}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    })
    await page.waitForTimeout(1000)
    if (await hasStoredUser(page)) {
      return { ok: true, reason: 'api_login' }
    }
  } else if (apiResult.reason === 'api_rejected') {
    console.warn('WARN API login:', apiResult.message || apiResult.reason)
  }

  if (!USERNAME || !PASSWORD) {
    return { ok: false, reason: 'missing_credentials' }
  }

  const loginPaths = ['/sign-in', '/login']
  for (const loginPath of loginPaths) {
    try {
      const res = await page.goto(`${BASE_URL}${loginPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })
      await page.waitForTimeout(1000)
      if (res && res.status() >= 400 && res.status() !== 404) continue

      const user = page.locator(
        'input[name="username"], input#username, input[name="email"], form input[type="text"]'
      ).first()
      const pass = page.locator(
        'input[name="password"], input#password, input[type="password"]'
      ).first()
      if ((await user.count()) === 0 || (await pass.count()) === 0) continue

      const legal = page.locator('#legal-consent, input#legal-consent').first()
      if ((await legal.count()) > 0 && !(await legal.isChecked())) {
        await legal.check({ force: true })
      }

      await user.fill(USERNAME)
      await pass.fill(PASSWORD)

      const submit = page
        .locator(
          'button[type="submit"], button:has-text("Sign in"), button:has-text("登录")'
        )
        .first()
      if ((await submit.count()) > 0) await submit.click()
      else await pass.press('Enter')

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
        return { ok: true, reason: 'ok' }
      }
    } catch (err) {
      console.warn('WARN login path', loginPath, err.message)
    }
  }
  return { ok: false, reason: 'failed' }
}

async function waitForOverviewShell(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || ''
      return (
        text.includes('运营控制台') ||
        text.includes('Operations Console') ||
        text.includes('Dashboard')
      )
    },
    { timeout: 30000 }
  )
  await page.waitForTimeout(1500)
}

async function collectChecks(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || ''
    const vpHeight = window.innerHeight

    const isPartiallyVisible = (el) => {
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return rect.top < vpHeight && rect.bottom > 0 && rect.height > 0
    }

    const h1 = document.querySelector('header h1')
    let titleInlineSubtitle = false
    if (h1) {
      const titleRow = h1.parentElement
      if (titleRow) {
        const subtitleEl = Array.from(titleRow.children).find(
          (el) => el !== h1 && el.tagName !== 'P'
        )
        titleInlineSubtitle = Boolean(
          subtitleEl &&
            titleRow.contains(h1) &&
            titleRow.contains(subtitleEl) &&
            (subtitleEl.textContent || '').trim().length > 0
        )
      }
    }

    const sectionTitles = Array.from(document.querySelectorAll('h3'))
    const overview24hSection = sectionTitles.find((el) =>
      /近 24 小时概览|Last 24 hours at a glance/i.test(el.textContent || '')
    )
    const tenantRankingSection = sectionTitles.find((el) =>
      /租户活跃排行|Tenant activity/i.test(el.textContent || '')
    )

    const overview24hRoot = overview24hSection?.closest('section')
    const tenantRankingRoot = tenantRankingSection?.closest('section')

    const overview24hMetrics = overview24hRoot
      ? Array.from(
          overview24hRoot.querySelectorAll('.grid > div, .grid > a')
        ).filter(isPartiallyVisible)
      : []

    const rawI18nKeys = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^Dashboard [A-Za-z0-9 ]+$/.test(line))

    return {
      titleInlineSubtitle,
      isChineseUi: text.includes('运营控制台'),
      hasKpiCalls: /今日调用量|Calls today/i.test(text),
      hasKpiTokens: /今日词元消耗|Token usage today/i.test(text),
      hasTrendSection: /运营趋势图表|Operations trend/i.test(text),
      hasChannelHealth: /通道健康|Channel health/i.test(text),
      has24hOverview: /近 24 小时概览|Last 24 hours at a glance/i.test(text),
      has24hOverviewContentVisible:
        isPartiallyVisible(overview24hRoot) &&
        overview24hMetrics.length >= 2,
      hasTenantRanking: /租户活跃排行|Tenant activity/i.test(text),
      hasTenantRankingContentVisible:
        isPartiallyVisible(tenantRankingRoot) &&
        Boolean(
          tenantRankingRoot?.querySelector('table, [class*="empty"], tbody')
        ),
      noRawI18nKeys: rawI18nKeys.length === 0,
      rawI18nKeys,
    }
  })
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  fs.mkdirSync(DOCS_SNAPSHOT_DIR, { recursive: true })

  const artifactPath = path.join(ARTIFACT_DIR, OUTPUT_NAME)
  const docsPath = path.join(DOCS_SNAPSHOT_DIR, OUTPUT_NAME)
  const metaPath = path.join(ARTIFACT_DIR, 'dashboard-overview-meta.json')

  console.log(`BASE_URL=${BASE_URL}`)
  console.log(`ROUTE=${ROUTE}`)
  console.log(`VIEWPORT=${VIEWPORT.width}x${VIEWPORT.height}`)
  console.log(`LOCALE=${LOCALE}`)
  console.log(`API_BASE_URL=${API_BASE_URL}`)
  console.log(`USERNAME=${USERNAME || '<unset>'}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: LOCALE,
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  await applyChineseLocale(page)

  let login = { ok: false, reason: 'skipped' }
  if (USERNAME && PASSWORD) {
    login = await tryLogin(page, context)
    console.log(`LOGIN=${login.ok ? 'success' : login.reason}`)
  } else {
    console.log('LOGIN=skipped (no UI_AUDIT_USERNAME/UI_AUDIT_PASSWORD)')
  }

  let navStatus = 'unknown'
  let finalUrl = ''
  let pageTitle = ''
  try {
    await page.goto(`${BASE_URL}${ROUTE}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('i18nextLng', 'zh')
      } catch {
        /* ignore */
      }
    })
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 })

    finalUrl = page.url()
    pageTitle = await page.title()
    navStatus = '200'

    if (/\/sign-in|\/login/.test(new URL(finalUrl).pathname)) {
      throw new Error('Redirected to sign-in — session not established')
    }

    await waitForOverviewShell(page)
  } catch (err) {
    console.error('ERROR navigation:', err.message)
    await page.screenshot({ path: artifactPath, fullPage: false })
    fs.copyFileSync(artifactPath, docsPath)
    await browser.close()
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          route: ROUTE,
          locale: LOCALE,
          apiBaseUrl: API_BASE_URL,
          login,
          navStatus,
          finalUrl,
          pageTitle,
          error: err.message,
          artifactPath,
          docsPath,
        },
        null,
        2
      )
    )
    process.exit(1)
  }

  await page.screenshot({ path: artifactPath, fullPage: false })
  fs.copyFileSync(artifactPath, docsPath)

  const checks = await collectChecks(page)

  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        route: ROUTE,
        viewport: VIEWPORT,
        locale: LOCALE,
        screenshotMode: 'viewport',
        apiBaseUrl: API_BASE_URL,
        login,
        navStatus,
        finalUrl,
        pageTitle,
        checks,
        artifactPath,
        docsPath,
      },
      null,
      2
    )
  )

  await browser.close()

  console.log(`SCREENSHOT=${artifactPath}`)
  console.log(`COPY=${docsPath}`)
  console.log('CHECKS=', JSON.stringify(checks))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
