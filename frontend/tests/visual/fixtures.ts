import { expect, type ConsoleMessage, type Page } from '@playwright/test'

export type VisualTheme = 'light' | 'dark'

const FIXED_NOW = new Date('2026-07-27T12:00:00+08:00').getTime()

const VISUAL_USER = {
  id: 1,
  username: 'visual.root',
  display_name: 'Visual Root',
  email: 'visual-root@ren2hub.dev',
  role: 100,
  quota: 5_201_314,
  used_quota: 2_985_211,
  group: 'vip',
}

const DAY_MS = 86_400_000
const VISUAL_START_TIME = Math.floor(
  (FIXED_NOW - (37 * DAY_MS + 12 * 3_600_000 + 34 * 60_000 + 56_000)) / 1000
)
const VISUAL_HOURLY_REQUESTS = [
  8, 12, 9, 7, 6, 11, 18, 27, 34, 41, 38, 45, 52, 49, 43, 57, 61, 54, 47, 39,
  32, 26, 21, 15,
]

function visualDateKey(daysAgo: number): string {
  return new Date(FIXED_NOW - daysAgo * DAY_MS).toISOString().slice(0, 10)
}

const VISUAL_DISTRIBUTION = Array.from({ length: 366 }, (_, index) => {
  const daysAgo = 365 - index
  return {
    date: visualDateKey(daysAgo),
    requests: 40 + ((index * 17) % 180),
    consume: 12_000 + ((index * 7_919) % 180_000),
    tokens: 8_000 + ((index * 12_401) % 900_000),
  }
})

const VISUAL_USAGE_ROWS = VISUAL_DISTRIBUTION.slice(-30).map(
  (point, index) => ({
    model_name: index % 2 === 0 ? 'gpt-4.1' : 'claude-sonnet-4',
    created_at: Math.floor((FIXED_NOW - (29 - index) * DAY_MS) / 1000),
    count: point.requests,
    quota: point.consume,
    token_used: point.tokens,
  })
)

const VISUAL_STATS = {
  kpi: {
    totalTokens: VISUAL_DISTRIBUTION.slice(-30).reduce(
      (sum, point) => sum + point.tokens,
      0
    ),
    totalQuota: VISUAL_DISTRIBUTION.slice(-30).reduce(
      (sum, point) => sum + point.consume,
      0
    ),
    totalRequests: VISUAL_DISTRIBUTION.slice(-30).reduce(
      (sum, point) => sum + point.requests,
      0
    ),
    avgLatency: 1.27,
    successRate: 99.4,
  },
  comparison: { quotaDelta: 8.4, requestsDelta: 5.1 },
  models: [
    {
      model: 'gpt-4.1',
      tokens: 5_820_000,
      quota: 1_480_000,
      requests: 3_280,
      share: 39.2,
      avgLatency: 1.08,
    },
    {
      model: 'claude-sonnet-4',
      tokens: 4_610_000,
      quota: 1_170_000,
      requests: 2_440,
      share: 31,
      avgLatency: 1.42,
    },
    {
      model: 'gemini-2.5-pro',
      tokens: 2_770_000,
      quota: 720_000,
      requests: 1_630,
      share: 19.1,
      avgLatency: 1.31,
    },
    {
      model: 'deepseek-v3',
      tokens: 1_440_000,
      quota: 402_000,
      requests: 1_020,
      share: 10.7,
      avgLatency: 0.94,
    },
  ],
  hourly: Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    requests: 30 + ((hour * 37) % 210),
  })),
  flow: VISUAL_DISTRIBUTION.slice(-30).map((point) => ({
    date: point.date,
    consume: point.consume,
    requests: point.requests,
    topup: 0,
  })),
}

const VISUAL_ROUTE_CHANNELS = [
  ...Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    name: `OpenAI Route ${index + 1}`,
    supplier: 'OpenAI',
    latency: 180 + index * 95,
    quota: 620 - index * 45,
    weight: 100 - index * 8,
    priority: 100 - index * 10,
    status: index === 6 ? 2 : 1,
  })),
  ...['Anthropic', 'Google Gemini', 'DeepSeek', 'Azure', 'AWS', 'xAI'].map(
    (supplier, index) => ({
      id: 20 + index,
      name: `${supplier} Route`,
      supplier,
      latency: 260 + index * 110,
      quota: 320 - index * 22,
      weight: 80 - index * 5,
      priority: 70 - index * 5,
      status: 1,
    })
  ),
]

interface StablePageOptions {
  theme: VisualTheme
  authenticated?: boolean
  routeAwareAuth?: boolean
  setupInitialized?: boolean
  clockStepMs?: number
}

export async function configureStablePage(
  page: Page,
  {
    theme,
    authenticated = true,
    routeAwareAuth = false,
    setupInitialized = true,
    clockStepMs = 1,
  }: StablePageOptions
): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(
    ({ fixedNow, selectedTheme, timeStepMs }) => {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value(
          this: HTMLCanvasElement,
          contextId: string,
          options?: CanvasRenderingContext2DSettings
        ) {
          if (contextId === '2d') {
            return Reflect.apply(nativeGetContext, this, [
              contextId,
              { ...options, willReadFrequently: true },
            ])
          }
          return Reflect.apply(nativeGetContext, this, [contextId, options])
        },
      })

      const NativeDate = Date
      let clockTick = 0
      const nextNow = () => fixedNow + clockTick++ * timeStepMs
      const FixedDate = new Proxy(NativeDate, {
        construct(target, args) {
          return Reflect.construct(target, args.length ? args : [nextNow()])
        },
        apply(target, thisArg, args) {
          return Reflect.apply(
            target,
            thisArg,
            args.length ? args : [nextNow()]
          )
        },
      })
      Object.defineProperty(FixedDate, 'now', { value: nextNow })
      Object.defineProperty(window, 'Date', { value: FixedDate })

      let seed = 0x2f6e2b1
      Math.random = () => {
        seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
        return seed / 0x1_0000_0000
      }

      localStorage.setItem('ren2hub_theme_mode', selectedTheme)
      localStorage.setItem('ren2hub_locale', 'zh-CN')
      localStorage.setItem('ren2hub_sidebar_collapsed', 'false')
      localStorage.setItem('ren2hub_lab_sidebar_collapsed', 'false')
      sessionStorage.clear()
    },
    {
      fixedNow: FIXED_NOW,
      selectedTheme: theme,
      timeStepMs: clockStepMs,
    }
  )

  const responses = new Map<string, unknown>([
    [
      '/api/setup',
      {
        status: setupInitialized,
        root_init: setupInitialized,
        database_type: 'postgres',
      },
    ],
    [
      '/api/status',
      {
        version: 'v2.6.0',
        start_time: VISUAL_START_TIME,
        system_name: 'Ren2Hub',
        logo: '',
        docs_link: 'https://docs.example.test',
        register_enabled: true,
        HeaderNavModules: { docs: true, pricing: { enabled: true } },
        next_frontend_enabled: true,
        frontend_capabilities: {
          next_frontend: 'live',
          registration: 'live',
          login: 'live',
          refresh: 'live',
          logout: 'live',
          profile: 'live',
          legacy_token: 'live',
          user_models: 'live',
          logs: 'live',
          dashboard_basic: 'live',
          wallet: 'live',
          redemption: 'live',
          passkey: 'live',
          two_factor: 'live',
          oauth_bindings: 'live',
          notifications: 'live',
          admin: 'live',
          orders: 'live',
          tickets: 'live',
          invites: 'live',
          activity: 'live',
          subscription_balance: 'disabled',
          token_private_routing: 'disabled',
          marketplace: 'disabled',
          invoices: 'disabled',
          lab: 'disabled',
          farm: 'disabled',
          bigame: 'disabled',
        },
      },
    ],
    ['/api/notice', 'All systems operational'],
    [
      '/api/pricing',
      [
        {
          model_name: 'gpt-4.1',
          description: 'Reliable reasoning for production workloads',
          icon: '',
          tags: 'reasoning,tools',
          vendor_id: 1,
          quota_type: 0,
          model_ratio: 1.25,
          model_price: 0,
          owner_by: 'OpenAI',
          completion_ratio: 4,
          cache_ratio: 0.25,
          enable_groups: ['default', 'vip'],
          supported_endpoint_types: ['openai'],
          billing_mode: 'token',
        },
        {
          model_name: 'claude-sonnet-4',
          description: 'Long-context analysis and code generation',
          icon: '',
          tags: 'analysis,code',
          vendor_id: 2,
          quota_type: 0,
          model_ratio: 1.5,
          model_price: 0,
          owner_by: 'Anthropic',
          completion_ratio: 5,
          cache_ratio: 0.1,
          enable_groups: ['default', 'vip'],
          supported_endpoint_types: ['openai'],
          billing_mode: 'token',
        },
        {
          model_name: 'gemini-2.5-pro',
          description: 'Multimodal model for complex tasks',
          icon: '',
          tags: 'multimodal,long-context',
          vendor_id: 3,
          quota_type: 0,
          model_ratio: 0.85,
          model_price: 0,
          owner_by: 'Google',
          completion_ratio: 4,
          cache_ratio: null,
          enable_groups: ['default', 'vip'],
          supported_endpoint_types: ['openai'],
          billing_mode: 'token',
        },
      ],
    ],
    [
      '/api/perf-metrics/summary',
      {
        models: [
          {
            model_name: 'gpt-4.1',
            avg_latency_ms: 820,
            success_rate: 99.8,
            avg_tps: 64.2,
          },
          {
            model_name: 'claude-sonnet-4',
            avg_latency_ms: 1060,
            success_rate: 99.4,
            avg_tps: 58.7,
          },
          {
            model_name: 'gemini-2.5-pro',
            avg_latency_ms: 940,
            success_rate: 98.9,
            avg_tps: 71.5,
          },
        ],
      },
    ],
    ['/api/uptime/status', [{ monitors: [{ uptime: 0.9995, status: 1 }] }]],
    [
      '/api/home/metrics',
      {
        available: true,
        requests_24h: VISUAL_HOURLY_REQUESTS.reduce(
          (sum, count) => sum + count,
          0
        ),
        hourly_requests: VISUAL_HOURLY_REQUESTS,
        generated_at: Math.floor(FIXED_NOW / 1000),
      },
    ],
    ['/api/data/self', VISUAL_USAGE_ROWS],
    ['/api/next/dashboard/distribution', VISUAL_DISTRIBUTION],
    ['/api/next/dashboard/stats', VISUAL_STATS],
    [
      '/api/next/dashboard/system-status',
      {
        cpu_percent: 4.627766599,
        memory_used_gb: 5.2,
        memory_total_gb: 16,
        bandwidth_up_mbps: 0.45,
        bandwidth_down_mbps: 0.00042,
        disk_used_gb: 218,
        disk_total_gb: 512,
        api_success_rate: 99.7,
        bandwidth_series: {
          up: [0.12, 0.28, 0.45],
          down: [0.00012, 0.0003, 0.00042],
        },
      },
    ],
    ['/api/next/admin/dashboard/routes', VISUAL_ROUTE_CHANNELS],
    [
      '/api/user/models',
      { models: ['gpt-4.1', 'claude-sonnet-4', 'gemini-2.5-pro'] },
    ],
    [
      '/api/token/',
      {
        page: 1,
        page_size: 20,
        total: 1,
        items: [
          {
            id: 7,
            name: 'Production key',
            key: 'sk-vis************2026',
            group: 'vip',
            status: 1,
            used_quota: 285_000,
            remain_quota: 4_715_000,
            unlimited_quota: false,
            model_limits_enabled: true,
            model_limits: 'gpt-4.1,claude-sonnet-4',
            allow_ips: '127.0.0.1',
            expired_time: -1,
            created_time: Math.floor((FIXED_NOW - 45 * DAY_MS) / 1000),
          },
        ],
      },
    ],
    [
      '/api/log/self',
      {
        page: 1,
        page_size: 10,
        total: 1,
        items: [
          {
            id: 11,
            type: 2,
            token_name: 'Production key',
            model_name: 'gpt-4.1',
            channel_name: 'OpenAI Route 1',
            prompt_tokens: 827_000,
            completion_tokens: 993,
            other: JSON.stringify({
              frt: 320,
              cache_read_tokens: 828_463,
              cache_write_tokens: 1_700,
              cache_ttl: 500,
              service_tier: 'fast',
            }),
            quota: 42_680,
            use_time: 6_990,
            is_stream: true,
            content: 'Request completed',
            created_at: Math.floor((FIXED_NOW - 15 * 60_000) / 1000),
          },
        ],
      },
    ],
    [
      '/api/log/self/stat',
      {
        total_requests: 32_132,
        total_quota: 5_201_314,
        today_requests: 286,
        today_quota: 92_480,
      },
    ],
    [
      '/api/next/activity/self',
      {
        activities: [
          {
            id: 1,
            kind: 'checkin',
            title: 'Daily check-in',
            tagline: 'Claim a daily quota reward',
            status: 'ongoing',
            gradient: 'accent',
            badgeKey: 'hot',
            start: Math.floor((FIXED_NOW - 30 * DAY_MS) / 1000),
            end: Math.floor((FIXED_NOW + 30 * DAY_MS) / 1000),
            icon: 'M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
            checkin: {
              days: Array.from({ length: 7 }, (_, index) => ({
                done: index < 4,
                reward: index < 4 ? 10_000 : 0,
              })),
              todayClaimed: true,
              streak: 4,
              total_days: 18,
              month_days: 12,
              month_days_total: 31,
              total_reward: 180_000,
              month_reward: 120_000,
              best_streak: 9,
              week_entries: Array.from({ length: 7 }, (_, index) => ({
                date: `07/${String(21 + index).padStart(2, '0')}`,
                weekday: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][
                  index
                ],
                reward: index < 4 ? 10_000 : 0,
                claimed: index < 4,
                today: index === 6,
              })),
            },
          },
          {
            id: 2,
            kind: 'newcomer',
            title: 'Newcomer gift',
            tagline: 'Complete onboarding tasks to claim rewards',
            status: 'ongoing',
            gradient: 'signal',
            badgeKey: 'new',
            start: Math.floor((FIXED_NOW - 35 * DAY_MS) / 1000),
            end: Math.floor((FIXED_NOW + 330 * DAY_MS) / 1000),
            icon: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
            newcomer: {
              tasks: [
                {
                  id: 'first-key',
                  labelKey: 'activity.newcomer.taskFirstKey',
                  reward: 20_000,
                  done: true,
                },
                {
                  id: 'first-call',
                  labelKey: 'activity.newcomer.taskFirstCall',
                  reward: 30_000,
                  done: true,
                },
                {
                  id: 'profile',
                  labelKey: 'activity.newcomer.taskProfile',
                  reward: 10_000,
                  done: false,
                },
              ],
              claimed: false,
            },
          },
          {
            id: 4,
            kind: 'invite',
            title: 'Invite rewards',
            tagline: 'Invite new users to earn quota',
            status: 'ongoing',
            gradient: 'signal',
            start: Math.floor((FIXED_NOW - 35 * DAY_MS) / 1000),
            end: Math.floor((FIXED_NOW + 10 * 365 * DAY_MS) / 1000),
            icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM19 8v6M22 11h-6',
            invite: {
              invited: 6,
              reward_total: 300_000,
              reward_per_invite: 50_000,
            },
          },
        ],
        summary: { claimable: 1, reward_earned: 480_000, ongoing: 3 },
      },
    ],
    [
      '/api/next/admin/channels',
      { items: [], total: 0, page: 1, page_size: 20, type_counts: {} },
    ],
    [
      '/api/next/admin/users',
      {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        role_counts: {},
        status_counts: {},
      },
    ],
    [
      '/api/next/admin/redemptions',
      {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        type_counts: { quota: 0 },
        status_counts: {},
      },
    ],
    [
      '/api/next/admin/orders',
      {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        status_counts: { completed: 0, pending: 0, failed: 0 },
        method_counts: { epay: 0 },
        type_counts: { topup: 0 },
        filtered_epay_revenue: 0,
      },
    ],
    [
      '/api/next/admin/orders/stats',
      {
        range: 30,
        generated_at: Math.floor(FIXED_NOW / 1000),
        currency: 'CNY',
        today_revenue: 0,
        today_orders: 0,
        total_revenue: 0,
        total_orders: 0,
        average_amount: 0,
        daily: [],
        payment_share: [],
        top_spenders: [],
      },
    ],
    [
      '/api/next/tickets',
      {
        items: [
          {
            id: 1,
            title: 'Production request investigation',
            category: 'api',
            priority: 'normal',
            status: 'replied',
            reply_count: 2,
            last_reply_role: 'support',
            model_id: 'gpt-4.1',
            request_id: 'req_visual_2026',
            created: Math.floor((FIXED_NOW - 2 * DAY_MS) / 1000),
            updated: Math.floor((FIXED_NOW - DAY_MS) / 1000),
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
      },
    ],
    [
      '/api/next/tickets/1',
      {
        ticket: {
          id: 1,
          title: 'Production request investigation',
          category: 'api',
          priority: 'normal',
          status: 'replied',
          reply_count: 2,
          last_reply_role: 'support',
          model_id: 'gpt-4.1',
          request_id: 'req_visual_2026',
          created: Math.floor((FIXED_NOW - 2 * DAY_MS) / 1000),
          updated: Math.floor((FIXED_NOW - DAY_MS) / 1000),
        },
        messages: [
          {
            id: 1,
            role: 'user',
            content: 'Please help inspect this request.',
            images: [],
            created: Math.floor((FIXED_NOW - 2 * DAY_MS) / 1000),
          },
          {
            id: 2,
            role: 'support',
            department: 'tech',
            content: 'The request has been reviewed.',
            images: [],
            created: Math.floor((FIXED_NOW - DAY_MS) / 1000),
          },
        ],
      },
    ],
    [
      '/api/next/wallet/config',
      {
        enable_online_topup: true,
        enable_redemption: true,
        pay_methods: [
          { name: 'Alipay', type: 'alipay', min_topup: 5 },
          { name: 'WeChat Pay', type: 'wxpay', min_topup: 5 },
        ],
        min_topup: 5,
        amount_options: [5, 10, 20, 50, 100],
      },
    ],
    ['/api/next/wallet/topups', { items: [], total: 0, page: 1, page_size: 6 }],
    [
      '/api/next/invite/self',
      {
        code: 'VISUAL2026',
        invited: 6,
        reward_per_invite: 50_000,
        reward_total: 300_000,
        transferable: 120_000,
        monthly_series: [
          { month: '2026-05', new_count: 1, cumulative: 3 },
          { month: '2026-06', new_count: 2, cumulative: 5 },
          { month: '2026-07', new_count: 1, cumulative: 6 },
        ],
        records: [
          {
            id: 2,
            invitee: 'visual.friend',
            created: Math.floor((FIXED_NOW - 12 * DAY_MS) / 1000),
          },
        ],
      },
    ],
    ['/api/user/passkey', { enabled: false }],
    ['/api/user/2fa/status', { enabled: true, backup_codes_remaining: 8 }],
    ['/api/user/oauth/bindings', []],
  ])

  await page.route('**/api/user/auth/refresh*', (route) => {
    const pagePath = new URL(page.url()).pathname
    const shouldAuthenticate = routeAwareAuth
      ? !pagePath.startsWith('/auth/')
      : authenticated
    if (!shouldAuthenticate) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_UNAUTHORIZED',
        }),
      })
    }

    const nowSeconds = Math.floor(FIXED_NOW / 1000)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: '',
        data: {
          access_token: 'visual-access-token',
          token_type: 'Bearer',
          access_expires_at: nowSeconds + 900,
          session: {
            sid: 'visual-session',
            current: true,
            login_method: 'password',
            ip: '127.0.0.1',
            user_agent: 'Playwright',
            created_at: nowSeconds - 3600,
            last_active_at: nowSeconds,
            expires_at: nowSeconds + 86_400,
          },
          user: VISUAL_USER,
        },
      }),
    })
  })

  for (const [path, data] of responses) {
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await page.route(new RegExp(`${escapedPath}(?:\\?.*)?$`), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: '', data }),
      })
    )
  }
}

export function isExpectedGuestRefreshConsoleMessage(
  page: Page,
  message: ConsoleMessage
): boolean {
  if (message.type() !== 'error' || !message.text().includes('401')) {
    return false
  }
  const pagePath = new URL(page.url()).pathname
  if (!pagePath.startsWith('/auth/')) return false
  const sourceUrl = message.location().url
  return !sourceUrl || sourceUrl.includes('/api/user/auth/refresh')
}

export async function waitForStablePage(page: Page): Promise<void> {
  await page.locator('#app > *').first().waitFor({ state: 'visible' })
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  ).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(260)
  await expect(page.locator('[data-error-retry]')).toHaveCount(0)
}

export async function freezeAndInspectHomeCanvas(page: Page): Promise<void> {
  const canvas = page.locator('canvas[role="img"]').first()
  await canvas.waitFor({ state: 'visible' })
  await expect(canvas).toHaveCSS('opacity', '1')

  const pixels = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    const context = target.getContext('2d')
    if (!context || target.width === 0 || target.height === 0) {
      return { distinct: 0, changed: 0, samples: 0 }
    }

    const image = context.getImageData(0, 0, target.width, target.height)
    const corner = image.data.slice(0, 3)
    const stepX = Math.max(1, Math.floor(target.width / 96))
    const stepY = Math.max(1, Math.floor(target.height / 64))
    const colors = new Set<string>()
    let changed = 0
    let samples = 0

    for (let y = 0; y < target.height; y += stepY) {
      for (let x = 0; x < target.width; x += stepX) {
        const offset = (y * target.width + x) * 4
        const red = image.data[offset]
        const green = image.data[offset + 1]
        const blue = image.data[offset + 2]
        colors.add(`${red},${green},${blue}`)
        const distance =
          Math.abs(red - corner[0]!) +
          Math.abs(green - corner[1]!) +
          Math.abs(blue - corner[2]!)
        if (distance > 24) changed++
        samples++
      }
    }

    return { distinct: colors.size, changed, samples }
  })

  expect(pixels.distinct).toBeGreaterThan(24)
  expect(pixels.changed).toBeGreaterThan(pixels.samples * 0.01)

  const frameChecksum = () =>
    canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement
      const context = target.getContext('2d')
      if (!context || target.width === 0 || target.height === 0) return 0

      const image = context.getImageData(0, 0, target.width, target.height)
      const stepX = Math.max(1, Math.floor(target.width / 96))
      const stepY = Math.max(1, Math.floor(target.height / 64))
      let checksum = 2_166_136_261
      for (let y = 0; y < target.height; y += stepY) {
        for (let x = 0; x < target.width; x += stepX) {
          const offset = (y * target.width + x) * 4
          for (let channel = 0; channel < 4; channel++) {
            checksum = Math.imul(
              checksum ^ image.data[offset + channel]!,
              16_777_619
            )
          }
        }
      }
      return checksum >>> 0
    })

  const initialFrame = await frameChecksum()
  await page.waitForTimeout(100)
  expect(await frameChecksum()).toBe(initialFrame)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
}

export async function assertHomeNavbarInitialState(page: Page): Promise<void> {
  const navbar = page.locator('.app-navbar')
  await expect(navbar).toHaveAttribute('data-scrolled', 'false')
  await expect(navbar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).toHaveCSS('box-shadow', 'none')
  await expect(page.locator('.home-brand')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  )
  await expect(page.locator('.home-brand')).toHaveCSS('box-shadow', 'none')
  expect(
    await page.locator('.home-brand').evaluate((element) => ({
      before: getComputedStyle(element, '::before').display,
      after: getComputedStyle(element, '::after').display,
    }))
  ).toEqual({ before: 'none', after: 'none' })

  await page.evaluate(() => window.scrollTo(0, 80))
  await expect(navbar).toHaveAttribute('data-scrolled', 'true')
  await expect(navbar).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).not.toHaveCSS('box-shadow', 'none')

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(navbar).toHaveAttribute('data-scrolled', 'false')
  await expect(navbar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(navbar).toHaveCSS('box-shadow', 'none')
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    html:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))
  expect(overflow.html).toBeLessThanOrEqual(1)
  expect(overflow.body).toBeLessThanOrEqual(1)
}

export async function assertInteractiveCentersVisible(
  page: Page
): Promise<void> {
  const covered = await page.evaluate(() => {
    const selector =
      'button:not([disabled]), a[href], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="button"]:not([aria-disabled="true"])'
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return (
          rect.width > 4 &&
          rect.height > 4 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < innerHeight &&
          rect.left < innerWidth &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          Number(style.opacity) > 0.05
        )
      })
      .flatMap((element) => {
        const rect = element.getBoundingClientRect()
        const x = Math.min(
          innerWidth - 1,
          Math.max(0, rect.left + rect.width / 2)
        )
        const y = Math.min(
          innerHeight - 1,
          Math.max(0, rect.top + rect.height / 2)
        )

        let ancestor = element.parentElement
        while (ancestor) {
          const ancestorStyle = getComputedStyle(ancestor)
          const ancestorRect = ancestor.getBoundingClientRect()
          const clipsX = ['auto', 'scroll', 'hidden', 'clip'].includes(
            ancestorStyle.overflowX
          )
          const clipsY = ['auto', 'scroll', 'hidden', 'clip'].includes(
            ancestorStyle.overflowY
          )
          if (
            (clipsX && (x < ancestorRect.left || x > ancestorRect.right)) ||
            (clipsY && (y < ancestorRect.top || y > ancestorRect.bottom))
          ) {
            return []
          }
          ancestor = ancestor.parentElement
        }

        const hit = document.elementFromPoint(x, y)
        if (
          !hit ||
          element === hit ||
          element.contains(hit) ||
          hit.contains(element)
        ) {
          return []
        }
        return [
          {
            control:
              element.getAttribute('aria-label') ||
              element.textContent?.trim().slice(0, 40) ||
              element.tagName,
            covering: `${hit.tagName}.${(hit as HTMLElement).className}`.slice(
              0,
              120
            ),
          },
        ]
      })
      .slice(0, 5)
  })

  expect(covered).toEqual([])
}
