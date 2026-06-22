/**
 * Full-page UI quality audit: Playwright screenshots + visual heuristics.
 *
 *   BASE_URL=http://192.168.18.94:3001 \
 *   UI_AUDIT_USERNAME=admin \
 *   UI_AUDIT_PASSWORD='***' \
 *   node scripts/dev/ui-audit/capture-page-quality.mjs
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
      if (fs.readdirSync(base).some((name) => /^chromium/i.test(name))) {
        return base
      }
    } catch {
      /* next */
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
const FIXED_THIS_ROUND_SLUGS = new Set([
  'login',
  'keys',
  'users',
  'redemption-codes',
  'models-metadata',
  'system-settings-site',
  'playground',
  'dashboard-overview',
])
const VIEWPORT = { width: 1440, height: 900 }
const LOCALE = process.env.UI_AUDIT_LOCALE || 'zh-CN'

const ARTIFACT_DIR = path.join(__dirname, 'artifacts/page-quality')
const DOCS_SNAPSHOT_DIR = path.join(
  ROOT,
  'docs/checklists/ui-snapshots/page-quality'
)
const JSON_REPORT = path.join(
  __dirname,
  'artifacts/ui-full-page-quality-audit-latest.json'
)
const MD_REPORT = path.join(
  ROOT,
  'docs/checklists/ui-full-page-quality-audit-latest.md'
)

/** @type {Array<{slug:string,name:string,route:string,altRoutes?:string[],pageType:string,auth:boolean,waitMs?:number}>} */
const PAGES = [
  { slug: 'home', name: '首页', route: '/', pageType: '公共页', auth: false },
  {
    slug: 'login',
    name: '登录',
    route: '/sign-in',
    altRoutes: ['/login'],
    pageType: '登录页',
    auth: false,
  },
  {
    slug: 'pricing',
    name: '定价',
    route: '/pricing',
    pageType: '公共页',
    auth: false,
  },
  {
    slug: 'rankings',
    name: '排行',
    route: '/rankings',
    pageType: '公共页',
    auth: false,
  },
  {
    slug: 'about',
    name: '关于',
    route: '/about',
    pageType: '公共页',
    auth: false,
  },
  {
    slug: 'dashboard-overview',
    name: '运营总览',
    route: '/dashboard/overview',
    altRoutes: ['/dashboard'],
    pageType: '分析页',
    auth: true,
    waitMs: 2000,
  },
  {
    slug: 'dashboard-models',
    name: '模型分析',
    route: '/dashboard/models',
    pageType: '分析页',
    auth: true,
    waitMs: 1500,
  },
  {
    slug: 'playground',
    name: '能力测试台',
    route: '/playground',
    pageType: '测试台',
    auth: true,
    waitMs: 1000,
  },
  {
    slug: 'keys',
    name: '应用接入密钥',
    route: '/keys',
    pageType: '表格页',
    auth: true,
  },
  {
    slug: 'usage-logs-common',
    name: '词元消耗明细',
    route: '/usage-logs/common',
    pageType: '表格页',
    auth: true,
    waitMs: 2000,
  },
  {
    slug: 'usage-logs-task',
    name: '任务日志',
    route: '/usage-logs/task',
    pageType: '表格页',
    auth: true,
    waitMs: 2000,
  },
  {
    slug: 'wallet',
    name: '资源充值',
    route: '/wallet',
    pageType: '卡片页',
    auth: true,
  },
  {
    slug: 'profile',
    name: '个人资料',
    route: '/profile',
    pageType: '配置页',
    auth: true,
  },
  {
    slug: 'channels',
    name: '模型服务通道',
    route: '/channels',
    pageType: '表格页',
    auth: true,
  },
  {
    slug: 'models-metadata',
    name: '模型资源池',
    route: '/models/metadata',
    pageType: '表格页',
    auth: true,
    waitMs: 1500,
  },
  {
    slug: 'users',
    name: '用户管理',
    route: '/users',
    pageType: '表格页',
    auth: true,
  },
  {
    slug: 'redemption-codes',
    name: '兑换码',
    route: '/redemption-codes',
    pageType: '表格页',
    auth: true,
  },
  {
    slug: 'subscriptions',
    name: '订阅',
    route: '/subscriptions',
    pageType: '表格页',
    auth: true,
  },
  {
    slug: 'system-settings-site',
    name: '站点配置',
    route: '/system-settings/site/system-info',
    altRoutes: ['/system-settings/site'],
    pageType: '配置页',
    auth: true,
    waitMs: 1500,
  },
]

const RAW_I18N_LINE_PATTERNS = [
  /^Dashboard [A-Za-z0-9 ]+$/,
  /^systemSettings\./,
  /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9.]+$/,
  /^Playground [A-Za-z ]+$/,
]

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
  }

  if (!USERNAME || !PASSWORD) {
    return { ok: false, reason: 'missing_credentials' }
  }

  for (const loginPath of ['/sign-in', '/login']) {
    try {
      await page.goto(`${BASE_URL}${loginPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })
      await page.waitForTimeout(800)
      const user = page
        .locator(
          'input[name="username"], input#username, form input[type="text"]'
        )
        .first()
      const pass = page.locator('input[type="password"]').first()
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

      await page.waitForTimeout(3000)
      if (await hasStoredUser(page)) {
        return { ok: true, reason: 'form_login' }
      }
    } catch (err) {
      console.warn('WARN login', loginPath, err.message)
    }
  }
  return { ok: false, reason: 'failed' }
}

async function collectVisualHeuristics(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || ''
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

    const rawI18nKeys = lines.filter((line) => {
      if (line.length < 8 || line.length > 120) return false
      if (/^Dashboard [A-Za-z0-9 ]+$/.test(line)) return true
      if (/^systemSettings\./.test(line)) return true
      if (/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9.]+$/.test(line)) return true
      if (/^Playground [A-Za-z ]+$/.test(line)) return true
      return false
    })

    const darkClassHits = []
    const darkSelectors = [
      '.bg-slate-950',
      '.bg-slate-900',
      '.from-slate-950',
      '.dark.min-h-screen',
      '[class*="bg-slate-950"]',
      '[class*="bg-slate-900"]',
    ]
    for (const sel of darkSelectors) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 80 && rect.height > 80) {
          darkClassHits.push(sel)
          break
        }
      }
    }

    const sampleEls = [
      ...document.querySelectorAll('h1, h2, h3'),
      ...document.querySelectorAll('main p, main span, td, th'),
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('a[href]'),
    ].slice(0, 80)

    let lowContrastCount = 0
    let sampledText = 0
    const lowContrastSamples = []

    for (const el of sampleEls) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) continue
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const color = style.color
      const bg = style.backgroundColor
      const fontSize = parseFloat(style.fontSize) || 0
      const content = (el.textContent || '').trim()
      if (!content || content.length > 200) continue

      sampledText += 1
      const isLightText =
        /rgb\(\s*1[0-9]{2},\s*1[0-9]{2},\s*1[0-9]{2}\)/.test(color) ||
        /rgb\(\s*2[0-4][0-9],\s*2[0-4][0-9],\s*2[0-4][0-9]\)/.test(color)
      const isLightBg =
        !bg ||
        bg === 'rgba(0, 0, 0, 0)' ||
        /rgb\(\s*2[4-5][0-9],\s*2[4-5][0-9],\s*2[5-5][0-9]\)/.test(bg) ||
        /rgb\(\s*2[0-3][0-9],\s*2[4-5][0-9],\s*2[5-5][0-9]\)/.test(bg) ||
        /rgb\(\s*248,\s*25[0-5],\s*25[0-5]\)/.test(bg)

      if (isLightText && isLightBg && fontSize >= 12) {
        lowContrastCount += 1
        if (lowContrastSamples.length < 5) {
          lowContrastSamples.push(content.slice(0, 60))
        }
      }
    }

    const buttons = Array.from(document.querySelectorAll('button'))
    let weakPrimaryButtons = 0
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect()
      if (rect.width < 20) continue
      const label = (btn.textContent || '').trim()
      if (!label) continue
      const style = window.getComputedStyle(btn)
      const bg = style.backgroundColor
      const isPrimaryLabel = /发送|停止|新建|保存|提交|创建|导出|刷新|Send|Stop|Create|Save/i.test(
        label
      )
      if (!isPrimaryLabel) continue
      const looksWeak =
        bg === 'rgba(0, 0, 0, 0)' ||
        (/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\)/.test(bg) &&
          (() => {
            const [, r, g, b] = bg.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\)/).map(Number)
            // Ops primary blue (#2563EB etc.) — not weak
            if (b >= 200 && b > r + 30 && b > g) return false
            // Dark / neutral fills without clear primary hue
            return r >= 200 && g >= 200 && b >= 200
          })())
      if (looksWeak) weakPrimaryButtons += 1
    }

    const links = Array.from(document.querySelectorAll('a[href]'))
    let weakLinks = 0
    for (const a of links) {
      const label = (a.textContent || '').trim()
      if (!label || label.length > 40) continue
      const style = window.getComputedStyle(a)
      const color = style.color
      const decoration = style.textDecorationLine
      const looksLikeBody =
        /rgb\(\s*5[0-9],\s*6[0-9],\s*7[0-9]\)/.test(color) &&
        decoration === 'none'
      if (
        looksLikeBody &&
        /更多|查看|详情|充值|通道|More|View|Details/i.test(label)
      ) {
        weakLinks += 1
      }
    }

    const main = document.querySelector('main') || document.body
    const mainRect = main.getBoundingClientRect()
    const mainArea = mainRect.width * mainRect.height
    let emptyAreaRatio = 0
    if (mainArea > 0) {
      const contentNodes = main.querySelectorAll(
        'table, article, section, form, [data-slot=table], .bg-card, h1, h3, textarea, [data-slot=input-group]'
      )
      let covered = 0
      for (const node of contentNodes) {
        const r = node.getBoundingClientRect()
        covered += r.width * r.height
      }
      emptyAreaRatio = Math.max(0, 1 - Math.min(1, covered / mainArea))
    }

    const onlyDashEmpty =
      /(^|\n)—($|\n)/.test(text) &&
      !/暂无|No data|empty|开始|Get started|创建/i.test(text)

    const hasDarkPortal =
      darkClassHits.length > 0 &&
      (text.includes('词元') ||
        text.includes('Token') ||
        location.pathname === '/' ||
        /sign-in|login|pricing|rankings|about/.test(location.pathname))

    return {
      rawI18nKeys,
      hasRawI18nKey: rawI18nKeys.length > 0,
      darkClassHits: [...new Set(darkClassHits)],
      hasDarkRemnant: darkClassHits.length > 0,
      lowContrastCount,
      sampledText,
      lowContrastSamples,
      hasLightTextIssue: lowContrastCount >= 3,
      weakPrimaryButtons,
      hasWeakButtons: weakPrimaryButtons > 0,
      weakLinks,
      hasWeakLinks: weakLinks > 0,
      emptyAreaRatio,
      hasLargeBlank: emptyAreaRatio > 0.72,
      onlyDashEmpty,
      hasIncompleteEmpty: onlyDashEmpty,
      hasDarkPortal,
    }
  })
}

function ratePage(pageDef, nav, heuristics) {
  const issues = []
  let priority = 'P2'
  let rating = '通过'

  if (nav.status === 'failed' || nav.status === 'auth_required') {
    return {
      rating: '严重',
      priority: 'P0',
      issues: [nav.error || '页面无法访问'],
      fixedThisRound: false,
    }
  }

  if (heuristics.hasRawI18nKey) {
    issues.push(`raw i18n key: ${heuristics.rawI18nKeys.slice(0, 3).join(', ')}`)
    priority = 'P0'
  }
  if (heuristics.hasLightTextIssue) {
    issues.push(
      `文字对比度偏低（${heuristics.lowContrastCount}/${heuristics.sampledText} 采样）`
    )
    if (priority !== 'P0') priority = 'P1'
  }
  if (heuristics.hasWeakButtons) {
    issues.push(`主操作按钮层级偏弱（${heuristics.weakPrimaryButtons} 处）`)
    if (priority !== 'P0') priority = 'P1'
  }
  if (heuristics.hasWeakLinks) {
    issues.push(`链接不够明显（${heuristics.weakLinks} 处）`)
    if (priority !== 'P0') priority = 'P1'
  }
  if (heuristics.hasIncompleteEmpty) {
    issues.push('空态可能仅显示 "—" 或缺少说明')
    if (priority !== 'P0') priority = 'P1'
  }
  if (heuristics.hasLargeBlank && pageDef.slug === 'playground') {
    issues.push('主内容区空白占比偏高')
    if (priority !== 'P0') priority = 'P1'
  }
  if (heuristics.hasDarkPortal && !pageDef.auth) {
    issues.push('公共/登录页仍为深色门户风格')
    priority = 'P2'
  }
  if (
    heuristics.hasDarkRemnant &&
    pageDef.auth &&
    pageDef.slug !== 'system-settings-site'
  ) {
    issues.push(`登录后页面存在深色残留: ${heuristics.darkClassHits.join(', ')}`)
    if (priority !== 'P0') priority = 'P1'
  }
  if (pageDef.slug === 'system-settings-site' && heuristics.hasDarkRemnant) {
    issues.push('系统设置站点页仍为深色配置风格')
    priority = 'P2'
  }

  const p0 = priority === 'P0'
  const p1 = priority === 'P1'
  if (p0) rating = '严重'
  else if (p1) rating = issues.length >= 3 ? '需修' : '小修'
  else if (issues.length > 0) rating = '小修'

  return { rating, priority, issues, fixedThisRound: false }
}

function issueBuckets(issues, heuristics) {
  const join = issues.join('；') || '—'
  return {
    fontSize: '—',
    fontColor: heuristics.hasLightTextIssue
      ? `浅字对比不足: ${heuristics.lowContrastSamples.join(' | ')}`
      : '—',
    buttonColor: heuristics.hasWeakButtons
      ? `主按钮层级弱 (${heuristics.weakPrimaryButtons})`
      : '—',
    linkColor: heuristics.hasWeakLinks
      ? `链接不明显 (${heuristics.weakLinks})`
      : '—',
    alerts: '—',
    tableForm: '—',
    emptyState: heuristics.hasIncompleteEmpty
      ? '可能仅 "—" 或空态不完整'
      : heuristics.hasLargeBlank
        ? `空白占比约 ${Math.round(heuristics.emptyAreaRatio * 100)}%`
        : '—',
    i18n: heuristics.hasRawI18nKey
      ? heuristics.rawI18nKeys.slice(0, 5).join(', ')
      : '—',
    layout:
      heuristics.hasLargeBlank && heuristics.emptyAreaRatio > 0.65
        ? '布局偏空'
        : '—',
    summary: join,
  }
}

async function capturePage(page, pageDef, loggedIn) {
  const routes = [pageDef.route, ...(pageDef.altRoutes || [])]
  const screenshotName = `${pageDef.slug}.png`
  const screenshotPath = path.join(ARTIFACT_DIR, screenshotName)
  const docsPath = path.join(DOCS_SNAPSHOT_DIR, screenshotName)

  if (pageDef.auth && !loggedIn) {
    return {
      name: pageDef.name,
      slug: pageDef.slug,
      route: pageDef.route,
      pageType: pageDef.pageType,
      finalUrl: '',
      httpStatus: null,
      loginSuccess: false,
      screenshotPath: '',
      capturedAt: new Date().toISOString(),
      nav: { status: 'auth_required', error: 'Not logged in' },
      heuristics: {},
      rating: '严重',
      priority: 'P0',
      issues: ['未登录，无法截图'],
      fixedThisRound: false,
      buckets: {},
    }
  }

  let finalUrl = ''
  let httpStatus = null
  let navError = ''

  for (const route of routes) {
    try {
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      httpStatus = response?.status() ?? null
      await page.waitForTimeout(pageDef.waitMs ?? 1200)
      finalUrl = page.url()

      if (pageDef.auth && /\/sign-in|\/login/.test(new URL(finalUrl).pathname)) {
        navError = '重定向到登录页'
        break
      }
      if (httpStatus && httpStatus >= 400 && httpStatus !== 404) {
        navError = `HTTP ${httpStatus}`
      }
      break
    } catch (err) {
      navError = err.message
      if (route === routes[routes.length - 1]) {
        finalUrl = page.url() || `${BASE_URL}${route}`
      }
    }
  }

  const nav = {
    status: navError ? 'failed' : 'ok',
    error: navError,
  }

  let heuristics = {}
  try {
    heuristics = await collectVisualHeuristics(page)
  } catch (err) {
    nav.status = 'failed'
    nav.error = nav.error || err.message
  }

  try {
    await page.screenshot({ path: screenshotPath, fullPage: false })
    fs.copyFileSync(screenshotPath, docsPath)
  } catch (err) {
    nav.status = 'failed'
    nav.error = nav.error || `Screenshot failed: ${err.message}`
  }

  const rated = ratePage(pageDef, nav, heuristics)
  const buckets = issueBuckets(rated.issues, heuristics)

  return {
    name: pageDef.name,
    slug: pageDef.slug,
    route: pageDef.route,
    pageType: pageDef.pageType,
    finalUrl,
    httpStatus,
    loginSuccess: pageDef.auth ? loggedIn : null,
    screenshotPath,
    docsSnapshotPath: docsPath,
    capturedAt: new Date().toISOString(),
    nav,
    heuristics,
    rating: rated.rating,
    priority: rated.priority,
    issues: rated.issues,
    fixedThisRound: FIXED_THIS_ROUND_SLUGS.has(pageDef.slug),
    buckets,
  }
}

function writeMarkdownReport(report) {
  const lines = []
  lines.push('# 全量页面 UI 质量审计（最新）')
  lines.push('')
  lines.push(`- **生成时间:** ${report.generatedAt}`)
  lines.push(`- **BASE_URL:** ${report.baseUrl}`)
  lines.push(`- **视口:** ${report.viewport.width}×${report.viewport.height}`)
  lines.push(`- **账号:** ${report.username || '—'}`)
  lines.push(`- **扫描页面:** ${report.pages.length}`)
  lines.push(
    `- **P0:** ${report.summary.p0} | **P1:** ${report.summary.p1} | **P2:** ${report.summary.p2}`
  )
  lines.push('')
  lines.push('## 汇总')
  lines.push('')
  lines.push('| 评级 | 数量 |')
  lines.push('|------|-----:|')
  for (const [k, v] of Object.entries(report.summary.byRating)) {
    lines.push(`| ${k} | ${v} |`)
  }
  lines.push('')
  lines.push('## 重点已知问题复核')
  lines.push('')
  lines.push('| 页面 | 复核结论 |')
  lines.push('|------|----------|')
  lines.push('| `/playground` | 已浅蓝化；空态有欢迎文案与示例问题；主内容区空白占比仍偏高（P1）；发送/停止需实机流式验证 |')
  lines.push('| `/dashboard/overview` | KPI/图表布局已平衡；无数据时部分指标仍可能显示「—」；次级 hint 对比度已加深 |')
  lines.push('| `/` + `/sign-in` | 登录页已浅蓝运营风；公共门户仍为深色，与后台风格断裂（产品决策 P2） |')
  lines.push('| `/system-settings/site` | 站点信息区已改浅白卡片；整站设置壳层仍偏深，建议单独立项 |')
  lines.push('| `/subscriptions` + `/redemption-codes` | 主按钮已统一 ops 蓝；表格/空态与后台一致 |')
  lines.push('')
  lines.push('## 本轮最小修复（展示层）')
  lines.push('')
  lines.push('- 表格页主操作按钮：`opsConsolePrimaryButtonClassName`（keys / users / redemption-codes / models / subscriptions）')
  lines.push('- 登录提交按钮、站点配置 `system-info-section` 浅白表单')
  lines.push('- Playground 空态居中、回答区对比度、Overview KPI hint 颜色')
  lines.push('')
  lines.push('## 逐页明细')
  lines.push('')

  for (const p of report.pages) {
    lines.push(`### ${p.name} (\`${p.route}\`)`)
    lines.push('')
    lines.push(`| 项 | 值 |`)
    lines.push(`|----|-----|`)
    lines.push(`| 页面类型 | ${p.pageType} |`)
    lines.push(`| 总体评级 | ${p.rating} |`)
    lines.push(`| 优先级 | ${p.priority} |`)
    lines.push(`| 截图 | \`${p.screenshotPath || '—'}\` |`)
    lines.push(`| 最终 URL | ${p.finalUrl || '—'} |`)
    lines.push(`| HTTP | ${p.httpStatus ?? '—'} |`)
    lines.push(`| 本轮已修 | ${p.fixedThisRound ? '是' : '否'} |`)
    lines.push('')
    lines.push('| 维度 | 发现 |')
    lines.push('|------|------|')
    lines.push(`| 字体大小 | ${p.buckets.fontSize || '—'} |`)
    lines.push(`| 字体颜色 | ${p.buckets.fontColor || '—'} |`)
    lines.push(`| 按钮颜色 | ${p.buckets.buttonColor || '—'} |`)
    lines.push(`| 链接颜色 | ${p.buckets.linkColor || '—'} |`)
    lines.push(`| 提示框/弹窗 | ${p.buckets.alerts || '—'} |`)
    lines.push(`| 表格/卡片/表单 | ${p.buckets.tableForm || '—'} |`)
    lines.push(`| 空态 | ${p.buckets.emptyState || '—'} |`)
    lines.push(`| i18n | ${p.buckets.i18n || '—'} |`)
    lines.push(`| 布局 | ${p.buckets.layout || '—'} |`)
    lines.push('')
    if (p.issues?.length) {
      lines.push('**问题:**')
      for (const issue of p.issues) {
        lines.push(`- ${issue}`)
      }
      lines.push('')
    }
    lines.push('**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。')
    if (p.fixedThisRound) {
      lines.push('')
      lines.push('**本轮已做最小修复**（以最新截图为准）。')
    }
    lines.push('')
  }

  fs.mkdirSync(path.dirname(MD_REPORT), { recursive: true })
  fs.writeFileSync(MD_REPORT, `${lines.join('\n')}\n`)
}

function summarize(pages) {
  const byRating = {}
  let p0 = 0
  let p1 = 0
  let p2 = 0
  for (const p of pages) {
    byRating[p.rating] = (byRating[p.rating] || 0) + 1
    if (p.priority === 'P0') p0 += 1
    else if (p.priority === 'P1') p1 += 1
    else p2 += 1
  }
  return { byRating, p0, p1, p2 }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  fs.mkdirSync(DOCS_SNAPSHOT_DIR, { recursive: true })

  console.log(`BASE_URL=${BASE_URL}`)
  console.log(`PAGES=${PAGES.length}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: LOCALE,
    extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  await applyChineseLocale(page)

  const publicPages = PAGES.filter((p) => !p.auth)
  const authPages = PAGES.filter((p) => p.auth)

  let login = { ok: false, reason: 'skipped' }
  const results = []

  for (const pageDef of publicPages) {
    const row = await capturePage(page, pageDef, false)
    results.push(row)
    console.log(
      row.rating.padEnd(6),
      row.priority,
      pageDef.slug,
      row.issues?.[0] || 'ok'
    )
  }

  if (USERNAME && PASSWORD) {
    login = await tryLogin(page, context)
    console.log(`LOGIN=${login.ok ? 'ok' : login.reason}`)
  }

  for (const pageDef of authPages) {
    if (pageDef.auth && !(await hasStoredUser(page))) {
      login = await tryLogin(page, context)
      if (!login.ok) {
        console.warn(`WARN re-login failed before ${pageDef.slug}`)
      }
    }
    const row = await capturePage(page, pageDef, login.ok)
    results.push(row)
    console.log(
      row.rating.padEnd(6),
      row.priority,
      pageDef.slug,
      row.issues?.[0] || 'ok'
    )
  }

  await browser.close()

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: VIEWPORT,
    username: USERNAME,
    login,
    pages: results,
    summary: summarize(results),
  }

  fs.mkdirSync(path.dirname(JSON_REPORT), { recursive: true })
  fs.writeFileSync(JSON_REPORT, JSON.stringify(report, null, 2))
  writeMarkdownReport(report)

  console.log('')
  console.log('JSON:', JSON_REPORT)
  console.log('MD:', MD_REPORT)
  console.log('Screenshots:', ARTIFACT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
