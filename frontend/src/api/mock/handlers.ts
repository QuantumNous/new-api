import { ApiError, type ApiResponse } from '../types'
import type { HttpMethod, RequestOptions } from '../transport'
import { readDemoUser, writeDemoUser } from '../demoStorage'
import type { UserInfo } from '@/types/auth'
import { MODELS, marketSources } from '@/constants/console'
import {
  ADMIN_CHANNEL_SORT_FIELDS,
  ADMIN_CHANNEL_TYPE_META,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import {
  ADMIN_ORDER_METHODS,
  ADMIN_ORDER_SORT_FIELDS,
  ADMIN_ORDER_STATUSES,
  ADMIN_ORDER_TYPES,
  ADMIN_ORDER_DEFAULT_RANGE,
  canRefundAdminOrder,
  isAdminOrderRange,
} from '@/constants/adminOrders'
import {
  ADMIN_USER_ROLES,
  ADMIN_USER_SORT_FIELDS,
  adminOperatorLevel,
} from '@/constants/adminUsers'
import type { PrizeRecord } from '@/types/bigame'
import type {
  AdminChannel,
  AdminChannelSortBy,
  AdminChannelSortOrder,
  AdminOrderMethod,
  AdminOrderRange,
  AdminOrderSortBy,
  AdminOrderSortOrder,
  AdminOrderStats,
  AdminRedemptionCode,
  AdminUser,
  AdminUserRole,
  AdminUserSortBy,
  AdminUserSortOrder,
  ListingStatus,
  LogType,
  MarketListing,
  MarketModelType,
  TicketCategory,
  TicketItem,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  TokenChannel,
  TokenItem,
  TokenSummary,
  TokenType,
} from '@/types/console'
import type { CommunityCategory } from '@/types/lab'
import { maskKey } from '@/utils/format'
import {
  GROUPS,
  PLATFORM_CHANNEL_NAME,
  activities,
  activitySummary,
  addInvoice,
  adminChannels,
  adminOrders,
  adminRedemptionCodes,
  adminUsers,
  addMyChannel,
  currentSubscription,
  dashboardStats,
  buildDashboardLimits,
  buildDashboardDiscounts,
  flowSeries,
  inviteInfo,
  invoices,
  logs,
  marketListings,
  marketMerchants,
  marketModels,
  marketVendors,
  marketplaceChannels,
  modelVendorMap,
  mockUser,
  modelShare,
  myChannels,
  plans,
  tickets,
  tokens,
  topupRecords,
} from './data'
import {
  assetItems,
  assetStorage,
  chatConversations,
  communityWorks,
  installedPlugins,
  labModelPicks,
  labStarters,
  marketPlugins,
  mcpServers,
  noteItems,
  skillItems,
  studioGallery,
  studioTools,
} from './lab'
import {
  farmState,
  farmPlots,
  ranchAnimals,
  fishingState,
  myPet,
  mineState,
  leaderboard,
  rebateTiers,
  rebateState,
} from './farm'
import {
  gameWallet,
  milestones,
  spinPrizes,
  blindBoxPrizes,
  prizeRecords,
} from './bigame'
import { getMockDelay, mockRuntime } from './state'

type Ctx = RequestOptions & { headers: Record<string, string> }

const TOKEN_TYPES: readonly TokenType[] = ['manual', 'auto']
const MARKET_MODEL_TYPES: readonly MarketModelType[] = [
  'chat',
  'image',
  'embedding',
  'rerank',
  'audio',
  'video',
]
const LISTING_STATUSES: readonly ListingStatus[] = [
  'active',
  'reviewing',
  'delisted',
]
const TICKET_CATEGORIES: readonly TicketCategory[] = [
  'billing',
  'api',
  'model',
  'account',
  'other',
]
const TICKET_PRIORITIES: readonly TicketPriority[] = ['low', 'normal', 'high']
const TOPUP_METHODS = ['epay', 'stripe', 'creem'] as const
const MAX_TOPUP_AMOUNT = 100_000

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value)
}

function parseStringArray(
  value: unknown,
  maxItems: number,
  maxLength = 256
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null
  const parsed: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const normalized = item.trim()
    if (!normalized || normalized.length > maxLength) return null
    parsed.push(normalized)
  }
  return [...new Set(parsed)]
}

function parseTokenChannels(value: unknown): TokenChannel[] | null {
  if (!Array.isArray(value) || value.length > 50) return null
  const channels: TokenChannel[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const channel = entry as Record<string, unknown>
    const name = typeof channel.name === 'string' ? channel.name.trim() : ''
    if (!name || name.length > 100 || typeof channel.enabled !== 'boolean') {
      return null
    }
    const weight =
      channel.weight === undefined ? undefined : Number(channel.weight)
    if (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) {
      return null
    }
    channels.push({ name, enabled: channel.enabled, weight })
  }
  return channels
}

function creditAccountQuota(amount: number): boolean {
  const stored = readDemoUser()
  if (!stored || !Number.isSafeInteger(amount) || amount <= 0) return false
  const quota = stored.quota + amount
  if (!Number.isSafeInteger(quota) || quota < 0) return false
  writeDemoUser({ ...stored, quota })
  return true
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The request was aborted', 'AbortError'))
      return
    }

    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('The request was aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function ok<T>(data: T, message = ''): ApiResponse<T> {
  return { success: true, message, data }
}

function fail<T = never>(message: string): ApiResponse<T> {
  return { success: false, message, data: undefined as never }
}

function requireAuth(ctx: Ctx) {
  const uid = Number(ctx.headers['X-Ren2Hub-Demo-User'])
  const stored = readDemoUser()
  if (!stored || uid !== stored.id) {
    throw new ApiError('登录状态已失效，请重新登录', { status: 401 })
  }
}

function paginate<T>(items: T[], params: Record<string, unknown>) {
  const requestedPage = Number(params.page ?? 1)
  const requestedPageSize = Number(params.page_size ?? 10)
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1
  const pageSize =
    Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(100, Math.floor(requestedPageSize))
      : 10
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
}

/**
 * Auto tokens don't own a channel list — the router picks the best channels
 * across the platform pool and the user's added market channels at request
 * time. Here we approximate "best" by scoring each candidate deterministically
 * and returning the top slice, so the UI can show what the router would pick.
 */
function computeAutoChannels(): TokenChannel[] {
  const platform = marketSources.map((name, i) => ({
    name,
    // Stable pseudo-score: earlier sources are the primary official routes.
    score: 100 - i * 2,
  }))
  const market = myChannels
    .filter((c) => c.status === 'active')
    .map((c) => {
      const listing = marketListings.find((l) => l.id === c.listingId)
      return {
        name: c.merchantName,
        score: listing
          ? listing.availability * 0.6 + listing.qcScore * 0.4
          : 60,
      }
    })
  const seen = new Set<string>()
  return [...platform, ...market]
    .sort((a, b) => b.score - a.score)
    .filter((c) => !seen.has(c.name) && seen.add(c.name))
    .slice(0, 8)
    .map((c) => ({ name: c.name, enabled: true }))
}

/** Auto tokens carry computed channels in every response. */
function withComputedChannels(item: TokenItem): TokenItem {
  return item.type === 'auto'
    ? { ...item, channels: computeAutoChannels() }
    : item
}

function toTokenSummary(item: TokenItem): TokenSummary {
  const { key, ...summary } = withComputedChannels(item)
  return {
    ...summary,
    key_preview: maskKey(key),
  }
}

type AdminChannelMutableField =
  'name' | 'type' | 'priority' | 'weight' | 'capacity_total' | 'channel_ratio'

const ADMIN_CHANNEL_MUTABLE_FIELDS: readonly AdminChannelMutableField[] = [
  'name',
  'type',
  'priority',
  'weight',
  'capacity_total',
  'channel_ratio',
]

function parseAdminChannelPatch(
  source: Record<string, unknown>,
  current?: AdminChannel,
  requireAll = false
): {
  patch?: Partial<Pick<AdminChannel, AdminChannelMutableField>>
  error?: string
} {
  if (
    requireAll &&
    ADMIN_CHANNEL_MUTABLE_FIELDS.some((field) => !Object.hasOwn(source, field))
  ) {
    return { error: '请填写完整的渠道信息' }
  }

  const patch: Partial<Pick<AdminChannel, AdminChannelMutableField>> = {}
  if (Object.hasOwn(source, 'name')) {
    if (typeof source.name !== 'string' || !source.name.trim()) {
      return { error: '渠道名称不能为空' }
    }
    patch.name = source.name.trim()
  }

  if (Object.hasOwn(source, 'type')) {
    if (
      typeof source.type !== 'number' ||
      !Number.isSafeInteger(source.type) ||
      !Object.hasOwn(ADMIN_CHANNEL_TYPE_META, source.type)
    ) {
      return { error: '渠道类型格式不正确' }
    }
    patch.type = source.type
  }

  for (const field of ['priority', 'weight'] as const) {
    if (!Object.hasOwn(source, field)) continue
    const value = source[field]
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 1_000_000
    ) {
      return {
        error: `${field === 'priority' ? '优先级' : '权重'}格式不正确`,
      }
    }
    patch[field] = value
  }

  if (Object.hasOwn(source, 'capacity_total')) {
    const value = source.capacity_total
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > 1_000_000 ||
      (current !== undefined && value < current.capacity_used)
    ) {
      return { error: '总容量格式不正确' }
    }
    patch.capacity_total = value
  }

  if (Object.hasOwn(source, 'channel_ratio')) {
    const value = source.channel_ratio
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return { error: '渠道倍率格式不正确' }
    }
    patch.channel_ratio = Math.round(value * 100) / 100
  }

  return { patch }
}

type AdminUserMutableField =
  'username' | 'display_name' | 'email' | 'role' | 'status'

const ADMIN_USER_MUTABLE_FIELDS: readonly AdminUserMutableField[] = [
  'username',
  'display_name',
  'email',
  'role',
  'status',
]

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseAdminUserPatch(
  source: Record<string, unknown>,
  current?: AdminUser,
  requireAll = false
): {
  patch?: Partial<Pick<AdminUser, AdminUserMutableField>>
  error?: string
} {
  if (
    requireAll &&
    ADMIN_USER_MUTABLE_FIELDS.some(
      (field) => field !== 'status' && !Object.hasOwn(source, field)
    )
  ) {
    return { error: '请填写完整的用户信息' }
  }

  const patch: Partial<Pick<AdminUser, AdminUserMutableField>> = {}

  if (Object.hasOwn(source, 'username')) {
    const value = String(source.username ?? '').trim()
    if (!USERNAME_PATTERN.test(value)) {
      return { error: '用户名需为 3-32 位字母、数字、点、下划线或连字符' }
    }
    const taken = adminUsers.some(
      (item) =>
        item.username.toLowerCase() === value.toLowerCase() &&
        item.id !== current?.id
    )
    if (taken) return { error: '用户名已被占用' }
    patch.username = value
  }

  if (Object.hasOwn(source, 'display_name')) {
    const value = String(source.display_name ?? '').trim()
    if (value.length > 64) return { error: '昵称长度不能超过 64 个字符' }
    patch.display_name = value
  }

  if (Object.hasOwn(source, 'email')) {
    const value = String(source.email ?? '').trim()
    if (value && !EMAIL_PATTERN.test(value)) {
      return { error: '邮箱格式不正确' }
    }
    const taken =
      value !== '' &&
      adminUsers.some(
        (item) =>
          item.email.toLowerCase() === value.toLowerCase() &&
          item.id !== current?.id
      )
    if (taken) return { error: '邮箱已被占用' }
    patch.email = value
  }

  if (Object.hasOwn(source, 'role')) {
    const value = Number(source.role)
    if (!ADMIN_USER_ROLES.includes(value as AdminUserRole)) {
      return { error: '用户角色格式不正确' }
    }
    patch.role = value as AdminUserRole
  }

  if (Object.hasOwn(source, 'status')) {
    if (source.status !== 1 && source.status !== 2) {
      return { error: '用户状态格式不正确' }
    }
    patch.status = source.status
  }

  return { patch }
}

/**
 * The mock server's view of the caller's authority. It mirrors the auth store's
 * `isAdmin: true` / `isRoot: false` stub through `adminOperatorLevel`, so the
 * client-side guard and this server-side one can never disagree while both are
 * stubs. A real backend derives this from the session instead.
 */
/** Local-day key for grouping orders into the revenue series. */
function orderDayKey(epochSec: number): string {
  const date = new Date(epochSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Revenue counts settled money only, so cancelled and expired orders never
 * inflate it. A refunded order was genuinely collected and then returned, so it
 * is excluded from revenue as well — `refunded_total` reports it separately
 * rather than hiding it.
 */
function buildOrderStats(range: AdminOrderRange): AdminOrderStats {
  const nowSec = Math.floor(Date.now() / 1000)
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const todayStartSec = Math.floor(dayStart.getTime() / 1000)
  const windowStartSec = todayStartSec - (range - 1) * 86_400

  const inWindow = adminOrders.filter(
    (order) => order.created >= windowStartSec
  )
  const earned = inWindow.filter((order) => order.status === 'completed')
  const refunded = inWindow.filter((order) => order.status === 'refunded')

  const revenue = earned.reduce((sum, order) => sum + order.amount, 0)
  const todayEarned = earned.filter((order) => order.created >= todayStartSec)
  const todayRevenue = todayEarned.reduce((sum, order) => sum + order.amount, 0)

  const daily: AdminOrderStats['daily'] = []
  const buckets = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < range; i++) {
    const key = orderDayKey(windowStartSec + i * 86_400)
    buckets.set(key, { revenue: 0, orders: 0 })
  }
  earned.forEach((order) => {
    const bucket = buckets.get(orderDayKey(order.created))
    if (!bucket) return
    bucket.revenue += order.amount
    bucket.orders += 1
  })
  buckets.forEach((bucket, date) => {
    daily.push({
      date,
      revenue: Math.round(bucket.revenue * 100) / 100,
      orders: bucket.orders,
    })
  })

  const methodTotals = new Map<
    AdminOrderMethod,
    { amount: number; count: number }
  >()
  earned.forEach((order) => {
    const entry = methodTotals.get(order.method) ?? { amount: 0, count: 0 }
    entry.amount += order.amount
    entry.count += 1
    methodTotals.set(order.method, entry)
  })
  const payment_share: AdminOrderStats['payment_share'] = [...methodTotals]
    .map(([method, entry]) => ({
      method,
      amount: Math.round(entry.amount * 100) / 100,
      count: entry.count,
    }))
    .sort((left, right) => right.amount - left.amount)

  const spenderTotals = new Map<
    number,
    { email: string; username: string; amount: number; orders: number }
  >()
  earned.forEach((order) => {
    const entry = spenderTotals.get(order.user_id) ?? {
      email: order.email,
      username: order.username,
      amount: 0,
      orders: 0,
    }
    entry.amount += order.amount
    entry.orders += 1
    spenderTotals.set(order.user_id, entry)
  })
  const top_spenders: AdminOrderStats['top_spenders'] = [...spenderTotals]
    .map(([user_id, entry]) => ({
      user_id,
      email: entry.email,
      username: entry.username,
      amount: Math.round(entry.amount * 100) / 100,
      orders: entry.orders,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5)

  return {
    range,
    generated_at: nowSec,
    today_revenue: Math.round(todayRevenue * 100) / 100,
    today_orders: todayEarned.length,
    total_revenue: Math.round(revenue * 100) / 100,
    total_orders: earned.length,
    average_amount:
      earned.length > 0 ? Math.round((revenue / earned.length) * 100) / 100 : 0,
    refunded_total:
      Math.round(refunded.reduce((sum, o) => sum + o.amount, 0) * 100) / 100,
    refunded_orders: refunded.length,
    daily,
    payment_share,
    top_spenders,
  }
}

export const DEMO_OPERATOR_LEVEL = adminOperatorLevel({
  isAdmin: true,
  isRoot: false,
})

/**
 * Server-side mirror of canManageAdminUser(). The console disables these
 * actions in the UI, but the rule must hold here too — the client is not an
 * authorization boundary, and the real backend has to enforce the same check.
 */
function denyAdminUserMutation(target: AdminUser): string | null {
  const operator = readDemoUser()
  if (!operator) return '登录状态已失效，请重新登录'
  if (target.id === operator.id) return '不能对自己的账号执行该操作'
  if (target.role >= DEMO_OPERATOR_LEVEL) {
    return '无权操作同级或更高权限的用户'
  }
  return null
}

export async function dispatchMock<T>(
  method: HttpMethod,
  url: string,
  ctx: Ctx
): Promise<ApiResponse<T>> {
  await sleep(getMockDelay(), ctx.signal)
  const path = url.split('?')[0]
  const params = ctx.params ?? {}
  const body = (ctx.data ?? {}) as Record<string, unknown>

  /* ---------------- public ---------------- */
  if (path === '/api/status' && method === 'GET') {
    return ok({
      version: 'v2.6.1',
      system_name: 'Ren2Hub',
      logo: './favicon.svg',
      register_enabled: true,
      uptime_kuma_enabled: true,
    }) as ApiResponse<T>
  }
  if (path === '/api/notice' && method === 'GET') {
    return ok(
      'gpt-image-2 图像接口已上线；全线模型价格下调，透明计费。'
    ) as ApiResponse<T>
  }

  /* ---------------- auth ---------------- */
  if (path === '/api/user/login' && method === 'POST') {
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    if (!username || password.length < 6) {
      return fail('用户名或密码错误') as ApiResponse<T>
    }
    const user = { ...mockUser, username, display_name: mockUser.display_name }
    return ok({ user, message: '登录成功' }) as ApiResponse<T>
  }
  if (path === '/api/user/register' && method === 'POST') {
    const username = String(body.username ?? '').trim()
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    if (!username || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return fail('注册信息不完整或密码不足 8 位') as ApiResponse<T>
    }
    return ok({ message: '注册成功，请查收验证邮件' }) as ApiResponse<T>
  }
  if (path === '/api/user/reset' && method === 'POST') {
    const email = String(body.email ?? '').trim()
    if (!/^\S+@\S+\.\S+$/.test(email))
      return fail('邮箱格式不正确') as ApiResponse<T>
    return ok({ message: '重置链接已发送至邮箱' }) as ApiResponse<T>
  }
  if (path === '/api/user/logout' && method === 'POST') {
    requireAuth(ctx)
    return ok({ message: '已退出登录' }) as ApiResponse<T>
  }

  /* ---------------- protected: everything below needs auth ---------------- */
  requireAuth(ctx)

  if (path === '/api/user/self' && method === 'GET') {
    const stored = readDemoUser()
    return ok(stored) as ApiResponse<T>
  }
  if (path === '/api/user/self' && method === 'PUT') {
    const stored = readDemoUser()!
    const next: UserInfo = { ...stored }
    if (body.display_name !== undefined) {
      if (typeof body.display_name !== 'string') {
        return fail('显示名称格式不正确') as ApiResponse<T>
      }
      const displayName = body.display_name.trim()
      if (!displayName || displayName.length > 64) {
        return fail('显示名称长度为 1-64 字符') as ApiResponse<T>
      }
      next.display_name = displayName
    }
    if (body.email !== undefined) {
      if (typeof body.email !== 'string') {
        return fail('邮箱格式不正确') as ApiResponse<T>
      }
      const email = body.email.trim()
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
        return fail('邮箱格式不正确') as ApiResponse<T>
      }
      next.email = email
    }
    writeDemoUser(next)
    return ok({ user: next, message: '资料已更新' }) as ApiResponse<T>
  }
  if (path === '/api/user/self' && method === 'DELETE') {
    // The client clears the demo session after a successful response.
    return ok({ message: '账户已删除' }) as ApiResponse<T>
  }
  if (path === '/api/user/self/password' && method === 'PUT') {
    if (String(body.new_password ?? '').length < 8) {
      return fail('新密码至少 8 位') as ApiResponse<T>
    }
    return ok({ message: '密码已更新' }) as ApiResponse<T>
  }

  /* ---------------- dashboard & logs ---------------- */
  if (path === '/api/data/self' && method === 'GET') {
    const stored = readDemoUser()!
    return ok({
      ...dashboardStats,
      quota: stored.quota,
      used_quota: stored.used_quota,
      model_share: modelShare,
      limits: buildDashboardLimits(stored.group ?? 'default'),
      discounts: buildDashboardDiscounts(stored.group ?? 'default'),
    }) as ApiResponse<T>
  }
  if (path === '/api/data/flow/self' && method === 'GET') {
    return ok(flowSeries) as ApiResponse<T>
  }
  if (path === '/api/data/route' && method === 'GET') {
    const { routingChannels } = await import('./routing')
    return ok(routingChannels) as ApiResponse<T>
  }
  if (path === '/api/data/stats' && method === 'GET') {
    const { statsData, buildStatsRange } = await import('./statsData')
    const rangeKey = String(ctx.params?.range ?? '30d')
    if (rangeKey === 'custom') {
      const start = String(ctx.params?.start ?? '')
      const end = String(ctx.params?.end ?? '')
      return ok(buildStatsRange(start, end)) as ApiResponse<T>
    }
    const data = statsData[rangeKey] ?? statsData['30d']
    return ok(data) as ApiResponse<T>
  }
  if (path === '/api/data/tokens' && method === 'GET') {
    const { tokenTrend } = await import('./overview')
    return ok(tokenTrend) as ApiResponse<T>
  }
  if (path === '/api/data/system' && method === 'GET') {
    const { systemMetrics } = await import('./overview')
    return ok(systemMetrics) as ApiResponse<T>
  }
  if (path === '/api/log/self' && method === 'GET') {
    const type = String(params.type ?? '') as LogType | ''
    const keyword = String(params.keyword ?? '').toLowerCase()
    const start = Number(params.start ?? 0)
    const end = Number(params.end ?? 0)
    const filtered = logs.filter((l) => {
      if (type && l.type !== type) return false
      if (keyword && !l.model.toLowerCase().includes(keyword)) return false
      if (start && l.created < start) return false
      if (end && l.created > end) return false
      return true
    })
    return ok(paginate(filtered, params)) as ApiResponse<T>
  }
  if (path === '/api/log/self/stat' && method === 'GET') {
    return ok({
      total_requests: dashboardStats.total_requests,
      total_quota: dashboardStats.used_quota,
      today_requests: dashboardStats.today_requests,
      today_quota: dashboardStats.today_quota,
    }) as ApiResponse<T>
  }

  /* ---------------- administrator channels ---------------- */
  if (
    (path === '/api/channel/' || path === '/api/channel/search') &&
    method === 'GET'
  ) {
    const keyword =
      path === '/api/channel/search'
        ? String(params.keyword ?? '')
            .trim()
            .toLowerCase()
        : ''
    const status = String(params.status ?? '').toLowerCase()
    const requestedType = Number(params.type)
    const hasType =
      params.type !== undefined && Number.isSafeInteger(requestedType)

    let filtered = adminChannels.filter((channel) => {
      if (
        keyword &&
        !channel.name.toLowerCase().includes(keyword) &&
        !channel.supplier.toLowerCase().includes(keyword) &&
        !String(channel.id).includes(keyword)
      ) {
        return false
      }
      if (status === 'enabled' && channel.status !== 1) return false
      if (status === 'disabled' && channel.status === 1) return false
      return true
    })

    const typeCounts: Record<string, number> = {}
    filtered.forEach((channel) => {
      const key = String(channel.type)
      typeCounts[key] = (typeCounts[key] ?? 0) + 1
    })

    if (hasType) {
      filtered = filtered.filter((channel) => channel.type === requestedType)
    }

    const rawSortBy = String(params.sort_by ?? 'id') as AdminChannelSortBy
    const sortBy = ADMIN_CHANNEL_SORT_FIELDS.includes(rawSortBy)
      ? rawSortBy
      : 'id'
    const sortOrder: AdminChannelSortOrder =
      String(params.sort_order).toLowerCase() === 'asc' ? 'asc' : 'desc'
    const direction = sortOrder === 'asc' ? 1 : -1
    filtered = [...filtered].sort((left, right) => {
      const leftValue = left[sortBy]
      const rightValue = right[sortBy]
      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return leftValue.localeCompare(rightValue) * direction
      }
      return (Number(leftValue) - Number(rightValue)) * direction
    })

    const requestedPage = Number(params.p ?? 1)
    const requestedPageSize = Number(params.page_size ?? 20)
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1
    const pageSize =
      Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(100, requestedPageSize)
        : 20
    const start = (page - 1) * pageSize

    return ok({
      items: filtered
        .slice(start, start + pageSize)
        .map((channel) => ({ ...channel })),
      total: filtered.length,
      page,
      page_size: pageSize,
      type_counts: typeCounts,
    }) as ApiResponse<T>
  }

  if (path === '/api/channel/' && method === 'POST') {
    if (body.mode !== 'single') {
      return fail('当前仅支持新建单个渠道') as ApiResponse<T>
    }
    if (
      body.channel === null ||
      typeof body.channel !== 'object' ||
      Array.isArray(body.channel)
    ) {
      return fail('渠道信息格式不正确') as ApiResponse<T>
    }

    const input = body.channel as Record<string, unknown>
    const parsed = parseAdminChannelPatch(input, undefined, true)
    if (!parsed.patch) return fail(parsed.error ?? '渠道信息格式不正确')

    if (input.status !== 1 && input.status !== 2) {
      return fail('渠道状态格式不正确') as ApiResponse<T>
    }

    const patch = parsed.patch as Pick<AdminChannel, AdminChannelMutableField>
    const channel: AdminChannel = {
      id: mockRuntime.nextAdminChannelId++,
      name: patch.name,
      type: patch.type,
      supplier: adminChannelTypeMeta(patch.type).supplier,
      status: input.status,
      priority: patch.priority,
      weight: patch.weight,
      capacity_used: 0,
      capacity_total: patch.capacity_total,
      used_quota: 0,
      channel_ratio: patch.channel_ratio,
      balance: 0,
      upstream_ratio: 1,
      response_time: 0,
      test_time: 0,
    }
    adminChannels.push(channel)
    return ok({ ...channel }, '渠道已创建') as ApiResponse<T>
  }

  if (path === '/api/channel/' && method === 'PUT') {
    const id = Number(body.id)
    const channel = adminChannels.find((item) => item.id === id)
    if (!channel) return fail('渠道不存在') as ApiResponse<T>

    const parsed = parseAdminChannelPatch(body, channel)
    if (!parsed.patch) return fail(parsed.error ?? '渠道参数格式不正确')
    if (Object.keys(parsed.patch).length === 0) {
      return fail('没有可更新的渠道字段') as ApiResponse<T>
    }

    Object.assign(channel, parsed.patch)
    channel.supplier = adminChannelTypeMeta(channel.type).supplier
    return ok({ ...channel }, '渠道参数已更新') as ApiResponse<T>
  }

  if (path === '/api/channel/batch' && method === 'POST') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return fail('渠道 ID 列表格式不正确') as ApiResponse<T>
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return fail('渠道 ID 列表格式不正确') as ApiResponse<T>
    }
    const uniqueIds = [...new Set(ids)]
    let deleted = 0
    for (let index = adminChannels.length - 1; index >= 0; index -= 1) {
      if (uniqueIds.includes(adminChannels[index]!.id)) {
        adminChannels.splice(index, 1)
        deleted += 1
      }
    }
    return ok(deleted, `已删除 ${deleted} 条渠道`) as ApiResponse<T>
  }

  if (path === '/api/channel/status/batch' && method === 'POST') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return fail('渠道 ID 列表格式不正确') as ApiResponse<T>
    }
    if (body.status !== 1 && body.status !== 2) {
      return fail('渠道状态格式不正确') as ApiResponse<T>
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return fail('渠道 ID 列表格式不正确') as ApiResponse<T>
    }
    let changed = 0
    for (const channel of adminChannels) {
      if (ids.includes(channel.id) && channel.status !== body.status) {
        channel.status = body.status
        changed += 1
      }
    }
    return ok(changed, `已更新 ${changed} 条渠道状态`) as ApiResponse<T>
  }

  const adminChannelDeleteMatch = path.match(/^\/api\/channel\/(\d+)$/)
  if (adminChannelDeleteMatch && method === 'DELETE') {
    const id = Number(adminChannelDeleteMatch[1])
    const index = adminChannels.findIndex((item) => item.id === id)
    if (index < 0) return fail('渠道不存在') as ApiResponse<T>
    adminChannels.splice(index, 1)
    return ok({ id }, '渠道已删除') as ApiResponse<T>
  }

  const adminChannelStatusMatch = path.match(/^\/api\/channel\/(\d+)\/status$/)
  if (adminChannelStatusMatch && method === 'POST') {
    const channel = adminChannels.find(
      (item) => item.id === Number(adminChannelStatusMatch[1])
    )
    if (!channel) return fail('渠道不存在') as ApiResponse<T>
    if (body.status !== 1 && body.status !== 2) {
      return fail('渠道状态格式不正确') as ApiResponse<T>
    }
    channel.status = body.status
    return ok(
      { ...channel },
      channel.status === 1 ? '渠道已启用' : '渠道已禁用'
    ) as ApiResponse<T>
  }

  const adminChannelBalanceMatch = path.match(
    /^\/api\/channel\/update_balance\/(\d+)$/
  )
  if (adminChannelBalanceMatch && method === 'GET') {
    const channel = adminChannels.find(
      (item) => item.id === Number(adminChannelBalanceMatch[1])
    )
    if (!channel) return fail('渠道不存在') as ApiResponse<T>
    channel.balance =
      Math.round((channel.balance + 1.25 + (channel.id % 9) * 0.37) * 100) / 100
    const nextRatio = Math.round(channel.upstream_ratio * 100) + 7
    channel.upstream_ratio = (nextRatio > 120 ? 52 : nextRatio) / 100
    return ok({ ...channel }, '上游额度与倍率已同步') as ApiResponse<T>
  }

  const adminChannelTestMatch = path.match(/^\/api\/channel\/test\/(\d+)$/)
  if (adminChannelTestMatch && method === 'GET') {
    const channel = adminChannels.find(
      (item) => item.id === Number(adminChannelTestMatch[1])
    )
    if (!channel) return fail('渠道不存在') as ApiResponse<T>
    channel.response_time = 180 + ((channel.id * 73) % 3_900)
    channel.test_time = Math.floor(Date.now() / 1_000)
    return ok({ ...channel }, '渠道测试完成') as ApiResponse<T>
  }

  /* ---------------- administrator users ---------------- */
  if (
    (path === '/api/user/' || path === '/api/user/search') &&
    method === 'GET'
  ) {
    const keyword =
      path === '/api/user/search'
        ? String(params.keyword ?? '')
            .trim()
            .toLowerCase()
        : ''
    const requestedRole = Number(params.role)
    const hasRole =
      params.role !== undefined &&
      params.role !== '' &&
      ADMIN_USER_ROLES.includes(requestedRole as AdminUserRole)
    const status = String(params.status ?? '').toLowerCase()

    const matched = adminUsers.filter((user) => {
      if (!keyword) return true
      return (
        user.username.toLowerCase().includes(keyword) ||
        user.display_name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        String(user.id).includes(keyword)
      )
    })

    // Facet counts come from the keyword-only set, so each facet shows totals
    // that don't shift when the other facet is narrowed.
    const roleCounts: Record<string, number> = {}
    const statusCounts: Record<string, number> = {}
    matched.forEach((user) => {
      const roleKey = String(user.role)
      const statusKey = user.status === 1 ? 'enabled' : 'disabled'
      roleCounts[roleKey] = (roleCounts[roleKey] ?? 0) + 1
      statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1
    })

    let filtered = matched.filter((user) => {
      if (hasRole && user.role !== requestedRole) return false
      if (status === 'enabled' && user.status !== 1) return false
      if (status === 'disabled' && user.status !== 2) return false
      return true
    })

    const rawSortBy = String(params.sort_by ?? 'id') as AdminUserSortBy
    const sortBy = ADMIN_USER_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'id'
    const sortOrder: AdminUserSortOrder =
      String(params.sort_order).toLowerCase() === 'asc' ? 'asc' : 'desc'
    const direction = sortOrder === 'asc' ? 1 : -1
    filtered = [...filtered].sort((left, right) => {
      const leftValue = left[sortBy]
      const rightValue = right[sortBy]
      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return leftValue.localeCompare(rightValue) * direction
      }
      return (Number(leftValue) - Number(rightValue)) * direction
    })

    const requestedPage = Number(params.p ?? 1)
    const requestedPageSize = Number(params.page_size ?? 20)
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1
    const pageSize =
      Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(100, requestedPageSize)
        : 20
    const start = (page - 1) * pageSize

    return ok({
      items: filtered
        .slice(start, start + pageSize)
        .map((user) => ({ ...user })),
      total: filtered.length,
      page,
      page_size: pageSize,
      role_counts: roleCounts,
      status_counts: statusCounts,
    }) as ApiResponse<T>
  }

  if (path === '/api/user/' && method === 'POST') {
    const parsed = parseAdminUserPatch(body, undefined, true)
    if (!parsed.patch) return fail(parsed.error ?? '用户参数格式不正确')

    const role = parsed.patch.role ?? 1
    if (role >= DEMO_OPERATOR_LEVEL) {
      return fail('无权创建同级或更高权限的用户') as ApiResponse<T>
    }
    if (adminUsers.some((item) => item.username === parsed.patch!.username)) {
      return fail('用户名已存在') as ApiResponse<T>
    }

    // Starting balance is optional and separate from the mutable-field patch;
    // every later change goes through /api/user/quota.
    let initialQuota = 0
    if (Object.hasOwn(body, 'quota')) {
      const value = Number(body.quota)
      if (!Number.isSafeInteger(value) || value < 0) {
        return fail('初始额度格式不正确') as ApiResponse<T>
      }
      initialQuota = value
    }

    const created: AdminUser = {
      id: mockRuntime.nextAdminUserId++,
      username: parsed.patch.username!,
      display_name: parsed.patch.display_name ?? '',
      email: parsed.patch.email ?? '',
      role,
      status: parsed.patch.status ?? 1,
      quota: initialQuota,
      used_quota: 0,
      request_count: 0,
      invited_count: 0,
      affiliate_quota: 0,
      inviter_id: 0,
      created_time: Math.floor(Date.now() / 1_000),
      last_login_time: 0,
    }
    adminUsers.unshift(created)
    return ok({ ...created }, '用户已创建') as ApiResponse<T>
  }

  if (path === '/api/user/' && method === 'PUT') {
    const id = Number(body.id)
    const user = adminUsers.find((item) => item.id === id)
    if (!user) return fail('用户不存在') as ApiResponse<T>

    const denied = denyAdminUserMutation(user)
    if (denied) return fail(denied) as ApiResponse<T>

    const parsed = parseAdminUserPatch(body, user)
    if (!parsed.patch) return fail(parsed.error ?? '用户参数格式不正确')
    if (Object.keys(parsed.patch).length === 0) {
      return fail('没有可更新的用户字段') as ApiResponse<T>
    }

    // Promotion is bounded by the operator's own level, so an admin can never
    // mint a peer or a superior by editing an existing row.
    if (
      parsed.patch.role !== undefined &&
      parsed.patch.role >= DEMO_OPERATOR_LEVEL
    ) {
      return fail('无权将用户提升到同级或更高权限') as ApiResponse<T>
    }
    if (
      parsed.patch.username !== undefined &&
      adminUsers.some(
        (item) =>
          item.id !== user.id && item.username === parsed.patch!.username
      )
    ) {
      return fail('用户名已存在') as ApiResponse<T>
    }

    Object.assign(user, parsed.patch)
    return ok({ ...user }, '用户资料已更新') as ApiResponse<T>
  }

  if (path === '/api/user/quota' && method === 'POST') {
    const user = adminUsers.find((item) => item.id === Number(body.id))
    if (!user) return fail('用户不存在') as ApiResponse<T>

    const denied = denyAdminUserMutation(user)
    if (denied) return fail(denied) as ApiResponse<T>

    const delta = Number(body.delta)
    if (!Number.isSafeInteger(delta) || delta === 0) {
      return fail('额度变更值格式不正确') as ApiResponse<T>
    }
    if (Math.abs(delta) > 1_000_000_000) {
      return fail('单次额度变更不能超过 10 亿') as ApiResponse<T>
    }
    if (user.quota + delta < 0) {
      return fail('扣减后的额度不能为负') as ApiResponse<T>
    }

    user.quota += delta
    return ok(
      { ...user },
      delta > 0 ? '额度已增加' : '额度已扣减'
    ) as ApiResponse<T>
  }

  if (path === '/api/user/status/batch' && method === 'POST') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return fail('用户 ID 列表格式不正确') as ApiResponse<T>
    }
    if (body.status !== 1 && body.status !== 2) {
      return fail('用户状态格式不正确') as ApiResponse<T>
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return fail('用户 ID 列表格式不正确') as ApiResponse<T>
    }

    let changed = 0
    for (const user of adminUsers) {
      if (!ids.includes(user.id) || user.status === body.status) continue
      // Unmanageable rows are skipped rather than failing the whole batch, so a
      // stale selection can't block the operator's legitimate targets.
      if (denyAdminUserMutation(user)) continue
      user.status = body.status
      changed += 1
    }
    return ok(changed, `已更新 ${changed} 位用户状态`) as ApiResponse<T>
  }

  if (path === '/api/user/batch' && method === 'POST') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return fail('用户 ID 列表格式不正确') as ApiResponse<T>
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return fail('用户 ID 列表格式不正确') as ApiResponse<T>
    }
    const uniqueIds = [...new Set(ids)]

    let deleted = 0
    for (let index = adminUsers.length - 1; index >= 0; index -= 1) {
      const user = adminUsers[index]!
      if (!uniqueIds.includes(user.id)) continue
      if (denyAdminUserMutation(user)) continue
      adminUsers.splice(index, 1)
      deleted += 1
    }
    return ok(deleted, `已删除 ${deleted} 位用户`) as ApiResponse<T>
  }

  const adminUserStatusMatch = path.match(/^\/api\/user\/(\d+)\/status$/)
  if (adminUserStatusMatch && method === 'POST') {
    const user = adminUsers.find(
      (item) => item.id === Number(adminUserStatusMatch[1])
    )
    if (!user) return fail('用户不存在') as ApiResponse<T>

    const denied = denyAdminUserMutation(user)
    if (denied) return fail(denied) as ApiResponse<T>

    if (body.status !== 1 && body.status !== 2) {
      return fail('用户状态格式不正确') as ApiResponse<T>
    }
    user.status = body.status
    return ok(
      { ...user },
      user.status === 1 ? '用户已启用' : '用户已禁用'
    ) as ApiResponse<T>
  }

  const adminUserDeleteMatch = path.match(/^\/api\/user\/(\d+)$/)
  if (adminUserDeleteMatch && method === 'DELETE') {
    const id = Number(adminUserDeleteMatch[1])
    const index = adminUsers.findIndex((item) => item.id === id)
    if (index < 0) return fail('用户不存在') as ApiResponse<T>

    const denied = denyAdminUserMutation(adminUsers[index]!)
    if (denied) return fail(denied) as ApiResponse<T>

    adminUsers.splice(index, 1)
    return ok({ id }, '用户已删除') as ApiResponse<T>
  }

  /* ---------------- administrator orders ---------------- */
  if (
    (path === '/api/order/' || path === '/api/order/search') &&
    method === 'GET'
  ) {
    const keyword =
      path === '/api/order/search'
        ? String(params.keyword ?? '')
            .trim()
            .toLowerCase()
        : ''
    // Unknown filter values are ignored rather than returning an empty page, so
    // a stale querystring degrades to "unfiltered" instead of "no results".
    const rawStatus = String(params.status ?? '')
    const status = oneOf(rawStatus, ADMIN_ORDER_STATUSES) ? rawStatus : ''
    const rawMethod = String(params.method ?? '')
    const requestedMethod = oneOf(rawMethod, ADMIN_ORDER_METHODS)
      ? rawMethod
      : ''
    const rawType = String(params.type ?? '')
    const requestedType = oneOf(rawType, ADMIN_ORDER_TYPES) ? rawType : ''

    const matched = adminOrders.filter((order) => {
      if (!keyword) return true
      return (
        order.order_no.toLowerCase().includes(keyword) ||
        order.email.toLowerCase().includes(keyword) ||
        order.username.toLowerCase().includes(keyword) ||
        String(order.id).includes(keyword)
      )
    })

    // Facet counts come from the keyword-only set so narrowing one facet does
    // not move the numbers shown on the others — same contract as users.
    const statusCounts: Record<string, number> = {}
    const methodCounts: Record<string, number> = {}
    const typeCounts: Record<string, number> = {}
    matched.forEach((order) => {
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1
      methodCounts[order.method] = (methodCounts[order.method] ?? 0) + 1
      typeCounts[order.type] = (typeCounts[order.type] ?? 0) + 1
    })

    let filtered = matched.filter((order) => {
      if (status && order.status !== status) return false
      if (requestedMethod && order.method !== requestedMethod) return false
      if (requestedType && order.type !== requestedType) return false
      return true
    })

    const rawSortBy = String(params.sort_by ?? 'created') as AdminOrderSortBy
    const sortBy = ADMIN_ORDER_SORT_FIELDS.includes(rawSortBy)
      ? rawSortBy
      : 'created'
    const sortOrder: AdminOrderSortOrder =
      String(params.sort_order).toLowerCase() === 'asc' ? 'asc' : 'desc'
    const direction = sortOrder === 'asc' ? 1 : -1
    filtered = [...filtered].sort(
      (left, right) => (left[sortBy] - right[sortBy]) * direction
    )

    // Revenue spans the whole filtered set, not the page, so the header total
    // stays stable while paginating.
    const filteredRevenue =
      Math.round(
        filtered
          .filter((order) => order.status === 'completed')
          .reduce((sum, order) => sum + order.amount, 0) * 100
      ) / 100

    const requestedPage = Number(params.p ?? 1)
    const requestedPageSize = Number(params.page_size ?? 20)
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1
    const pageSize =
      Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(100, requestedPageSize)
        : 20
    const start = (page - 1) * pageSize

    return ok({
      items: filtered
        .slice(start, start + pageSize)
        .map((order) => ({ ...order })),
      total: filtered.length,
      page,
      page_size: pageSize,
      status_counts: statusCounts,
      method_counts: methodCounts,
      type_counts: typeCounts,
      filtered_revenue: filteredRevenue,
    }) as ApiResponse<T>
  }

  if (path === '/api/order/stats' && method === 'GET') {
    const range = isAdminOrderRange(params.range)
      ? (Number(params.range) as AdminOrderRange)
      : ADMIN_ORDER_DEFAULT_RANGE

    return ok(buildOrderStats(range)) as ApiResponse<T>
  }

  const orderRefundMatch = path.match(/^\/api\/order\/(\d+)\/refund$/)
  if (orderRefundMatch && method === 'POST') {
    const id = Number(orderRefundMatch[1])
    const order = adminOrders.find((item) => item.id === id)
    if (!order) return fail('订单不存在') as ApiResponse<T>
    if (!canRefundAdminOrder(order)) {
      return fail('仅已完成的订单可以退款') as ApiResponse<T>
    }

    order.status = 'refunded'
    order.refunded_at = Math.floor(Date.now() / 1000)

    // Reverse the credited quota where the payer is still on file. A real
    // refund also reverses the payment channel; this prototype only moves the
    // ledger state and the local balance.
    const payer = adminUsers.find((user) => user.id === order.user_id)
    if (payer) payer.quota = Math.max(0, payer.quota - order.quota)
    if (order.user_id === readDemoUser()?.id) {
      const stored = readDemoUser()!
      writeDemoUser({
        ...stored,
        quota: Math.max(0, stored.quota - order.quota),
      })
    }

    return ok({ ...order }, '订单已退款') as ApiResponse<T>
  }

  /* ---------------- tokens (API keys) ---------------- */
  if (path === '/api/token/' && method === 'GET') {
    const keyword = String(params.keyword ?? '').toLowerCase()
    const filtered = tokens
      .filter((t) => (keyword ? t.name.toLowerCase().includes(keyword) : true))
      .map(toTokenSummary)
    return ok(paginate(filtered, params)) as ApiResponse<T>
  }
  if (path === '/api/token/' && method === 'POST') {
    const name = String(body.name ?? '').trim()
    if (!name || name.length > 64) {
      return fail('令牌名称长度为 1-64 字符') as ApiResponse<T>
    }
    const rawType = String(body.type ?? 'auto')
    if (!oneOf(rawType, TOKEN_TYPES)) {
      return fail('无效的令牌类型') as ApiResponse<T>
    }
    const type = rawType
    // Custom key: optional; must be unique and follow the sk- prefix format.
    const customKey = String(body.key ?? '').trim()
    if (customKey) {
      if (!/^sk-[A-Za-z0-9_-]{8,64}$/.test(customKey)) {
        return fail(
          '自定义密钥需以 sk- 开头，8-64 位字母数字'
        ) as ApiResponse<T>
      }
      if (tokens.some((t) => t.key === customKey)) {
        return fail('该密钥已存在，请更换') as ApiResponse<T>
      }
    }
    const modelLimits = parseStringArray(body.model_limits ?? [], 100)
    const ipLimits = parseStringArray(body.ip_limits ?? [], 100)
    const channels = parseTokenChannels(body.channels ?? [])
    if (!modelLimits || !ipLimits || !channels) {
      return fail('令牌限制配置格式不正确') as ApiResponse<T>
    }
    const remainQuota = Number(body.remain_quota ?? 0)
    const rateLimit = Number(body.rate_limit ?? 0)
    const expiredTime = Number(body.expired_time ?? -1)
    if (!Number.isSafeInteger(remainQuota) || remainQuota < 0) {
      return fail('令牌额度格式不正确') as ApiResponse<T>
    }
    if (!Number.isSafeInteger(rateLimit) || rateLimit < 0) {
      return fail('速率限制格式不正确') as ApiResponse<T>
    }
    if (
      !Number.isSafeInteger(expiredTime) ||
      (expiredTime !== -1 && expiredTime <= 0)
    ) {
      return fail('过期时间格式不正确') as ApiResponse<T>
    }
    if (body.unlimited !== undefined && typeof body.unlimited !== 'boolean') {
      return fail('无限额度配置格式不正确') as ApiResponse<T>
    }
    if (
      body.load_balance !== undefined &&
      typeof body.load_balance !== 'boolean'
    ) {
      return fail('负载均衡配置格式不正确') as ApiResponse<T>
    }
    const group = String(body.group ?? 'default').trim()
    if (!group || group.length > 64) {
      return fail('分组格式不正确') as ApiResponse<T>
    }
    let maxRatio: number | undefined
    if (body.max_ratio !== undefined) {
      const value = Number(body.max_ratio)
      if (!Number.isFinite(value) || value <= 0 || value > 1_000) {
        return fail('最高倍率格式不正确') as ApiResponse<T>
      }
      maxRatio = value
    }
    const item: TokenItem = {
      id: mockRuntime.nextTokenId++,
      name,
      key:
        customKey ||
        `sk-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(
          0,
          43
        ),
      type,
      status: 1,
      used_quota: 0,
      remain_quota: remainQuota,
      unlimited: body.unlimited ?? false,
      group,
      model_limits: modelLimits,
      ip_limits: ipLimits,
      rate_limit: rateLimit,
      max_ratio: maxRatio,
      load_balance: body.load_balance ?? false,
      channels: type === 'auto' ? [] : channels,
      expired_time: expiredTime,
      created_time: Math.floor(Date.now() / 1000),
    }
    tokens.unshift(item)
    return ok({
      item: toTokenSummary(item),
      message: '令牌已创建',
    }) as ApiResponse<T>
  }
  const tokenIdMatch = path.match(/^\/api\/token\/(\d+)(\/key)?$/)
  if (tokenIdMatch) {
    const id = Number(tokenIdMatch[1])
    const item = tokens.find((t) => t.id === id)
    if (!item) return fail('令牌不存在') as ApiResponse<T>

    if (tokenIdMatch[2] === '/key' && method === 'GET') {
      // Full-key read: rate-limited + cache-disabled on the real backend.
      return ok({ key: item.key }) as ApiResponse<T>
    }
    if (method === 'PUT') {
      if (body.channels !== undefined && item.type === 'auto') {
        return fail('自动令牌的渠道由系统计算，不可编辑') as ApiResponse<T>
      }
      const next: TokenItem = { ...item }
      if (body.name !== undefined) {
        const name = String(body.name).trim()
        if (!name || name.length > 64) {
          return fail('令牌名称长度为 1-64 字符') as ApiResponse<T>
        }
        next.name = name
      }
      if (body.status !== undefined) {
        const status = Number(body.status)
        if (status !== 1 && status !== 2) {
          return fail('无效的令牌状态') as ApiResponse<T>
        }
        next.status = status
      }
      if (body.remain_quota !== undefined) {
        const remainQuota = Number(body.remain_quota)
        if (!Number.isSafeInteger(remainQuota) || remainQuota < 0) {
          return fail('令牌额度格式不正确') as ApiResponse<T>
        }
        next.remain_quota = remainQuota
      }
      if (body.unlimited !== undefined) {
        if (typeof body.unlimited !== 'boolean') {
          return fail('无限额度配置格式不正确') as ApiResponse<T>
        }
        next.unlimited = body.unlimited
      }
      if (body.group !== undefined) {
        const group = String(body.group).trim()
        if (!group || group.length > 64) {
          return fail('分组格式不正确') as ApiResponse<T>
        }
        next.group = group
      }
      if (body.model_limits !== undefined) {
        const limits = parseStringArray(body.model_limits, 100)
        if (!limits) return fail('模型限制格式不正确') as ApiResponse<T>
        next.model_limits = limits
      }
      if (body.ip_limits !== undefined) {
        const limits = parseStringArray(body.ip_limits, 100)
        if (!limits) return fail('IP 限制格式不正确') as ApiResponse<T>
        next.ip_limits = limits
      }
      if (body.rate_limit !== undefined) {
        const rateLimit = Number(body.rate_limit)
        if (!Number.isSafeInteger(rateLimit) || rateLimit < 0) {
          return fail('速率限制格式不正确') as ApiResponse<T>
        }
        next.rate_limit = rateLimit
      }
      if (body.max_ratio !== undefined) {
        const maxRatio = Number(body.max_ratio)
        if (!Number.isFinite(maxRatio) || maxRatio <= 0 || maxRatio > 1_000) {
          return fail('最高倍率格式不正确') as ApiResponse<T>
        }
        next.max_ratio = maxRatio
      }
      if (body.load_balance !== undefined) {
        if (typeof body.load_balance !== 'boolean') {
          return fail('负载均衡配置格式不正确') as ApiResponse<T>
        }
        next.load_balance = body.load_balance
      }
      if (body.channels !== undefined) {
        const channels = parseTokenChannels(body.channels)
        if (!channels) return fail('渠道配置格式不正确') as ApiResponse<T>
        next.channels = channels
      }
      if (body.expired_time !== undefined) {
        const expiredTime = Number(body.expired_time)
        if (
          !Number.isSafeInteger(expiredTime) ||
          (expiredTime !== -1 && expiredTime <= 0)
        ) {
          return fail('过期时间格式不正确') as ApiResponse<T>
        }
        next.expired_time = expiredTime
      }
      Object.assign(item, next)
      return ok({
        item: toTokenSummary(item),
        message: '令牌已更新',
      }) as ApiResponse<T>
    }
    if (method === 'DELETE') {
      tokens.splice(tokens.indexOf(item), 1)
      return ok({ message: '令牌已删除' }) as ApiResponse<T>
    }
  }
  if (path === '/api/token/batch' && method === 'POST') {
    if (!Array.isArray(body.ids)) {
      return fail('令牌 ID 列表格式不正确') as ApiResponse<T>
    }
    const ids = [
      ...new Set(
        body.ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
      ),
    ]
    let deleted = 0
    ids.forEach((id) => {
      const idx = tokens.findIndex((t) => t.id === id)
      if (idx >= 0) {
        tokens.splice(idx, 1)
        deleted += 1
      }
    })
    return ok({
      message: `已删除 ${deleted} 个令牌`,
      deleted,
    }) as ApiResponse<T>
  }

  /* ---------------- wallet & topup ---------------- */
  if (path === '/api/user/topup/records' && method === 'GET') {
    return ok(paginate(topupRecords, params)) as ApiResponse<T>
  }
  if (path === '/api/user/topup/redeem/records' && method === 'GET') {
    const redeemOnly = topupRecords.filter((r) => r.method === 'redeem')
    return ok(paginate(redeemOnly, params)) as ApiResponse<T>
  }
  if (path === '/api/user/topup' && method === 'POST') {
    const amount = Number(body.amount ?? 0)
    if (!Number.isFinite(amount) || amount < 1 || amount > MAX_TOPUP_AMOUNT) {
      return fail(`充值金额需在 $1-$${MAX_TOPUP_AMOUNT} 之间`) as ApiResponse<T>
    }
    const paymentMethod = String(body.method ?? '')
    if (!oneOf(paymentMethod, TOPUP_METHODS)) {
      return fail('无效的支付方式') as ApiResponse<T>
    }
    const quota = Math.round(amount * 500_000)
    if (!Number.isSafeInteger(quota)) {
      return fail('充值金额超出安全范围') as ApiResponse<T>
    }
    // Payment confirmation is server-callback driven on the real backend;
    // here we simulate a pending order that the records list later confirms.
    topupRecords.unshift({
      id: 1000 + topupRecords.length,
      trade_no: `T${Date.now()}`,
      amount,
      money: quota,
      method: paymentMethod,
      status: 'pending',
      created: Math.floor(Date.now() / 1000),
    })
    return ok({
      message: '支付单已创建，到账以服务端回调为准',
      trade_no: topupRecords[0].trade_no,
    }) as ApiResponse<T>
  }
  if (path === '/api/user/topup/redeem' && method === 'POST') {
    const code = String(body.code ?? '')
      .trim()
      .toUpperCase()
    if (
      !/^[A-Z0-9-]{8,64}$/.test(code) ||
      mockRuntime.redeemedCodes.has(code)
    ) {
      return fail('兑换码无效或已被使用') as ApiResponse<T>
    }
    const redeemedQuota = 5_000_000
    if (!creditAccountQuota(redeemedQuota)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    mockRuntime.redeemedCodes.add(code)
    topupRecords.unshift({
      id: 1000 + topupRecords.length,
      trade_no: `R${Date.now()}`,
      amount: 10,
      money: redeemedQuota,
      method: 'redeem',
      status: 'success',
      created: Math.floor(Date.now() / 1000),
    })
    return ok({
      message: '兑换成功，$10 已入账',
      quota: redeemedQuota,
    }) as ApiResponse<T>
  }

  /* ---------------- subscription ---------------- */
  if (path === '/api/subscription/plans' && method === 'GET') {
    return ok(plans) as ApiResponse<T>
  }
  if (path === '/api/subscription/self' && method === 'GET') {
    return ok({ ...currentSubscription }) as ApiResponse<T>
  }
  if (path === '/api/subscription/self' && method === 'PUT') {
    if (body.auto_renew !== undefined)
      currentSubscription.auto_renew = Boolean(body.auto_renew)
    return ok({
      ...currentSubscription,
      message: '订阅设置已更新',
    }) as ApiResponse<T>
  }
  if (path === '/api/subscription/purchase' && method === 'POST') {
    const plan = plans.find((p) => p.id === Number(body.plan_id))
    if (!plan) return fail('套餐不存在') as ApiResponse<T>
    return ok({
      message: `已创建「${plan.name}」支付单，到账以回调为准`,
    }) as ApiResponse<T>
  }

  /* ---------------- invite & rebate ---------------- */
  if (path === '/api/invite/self' && method === 'GET') {
    // Return a fresh object each call (like a real JSON response) so the
    // caller's `ref` sees a new reference after a mutating action (transfer)
    // and reliably re-renders — returning the singleton would be a no-op set.
    return ok({ ...inviteInfo }) as ApiResponse<T>
  }
  if (path === '/api/invite/transfer' && method === 'POST') {
    const amount = Number(body.amount ?? 0)
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > inviteInfo.transferable
    ) {
      return fail('转出额度超出可转余额') as ApiResponse<T>
    }
    if (!creditAccountQuota(amount)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    inviteInfo.transferable -= amount
    return ok({ message: '已转入账户余额' }) as ApiResponse<T>
  }

  /* ---------------- meta ---------------- */
  if (path === '/api/models/available' && method === 'GET') {
    return ok({ models: MODELS, groups: GROUPS }) as ApiResponse<T>
  }

  /* ---------------- model plaza ---------------- */
  if (path === '/api/models/market' && method === 'GET') {
    requireAuth(ctx)
    // Channels are linked to the marketplace: every model routes through the
    // platform, plus any added (active) market channel whose merchant supports it.
    const activeMine = myChannels.filter((c) => c.status === 'active')
    const models = marketModels.map((m) => {
      const merchantNames = [
        ...new Set(
          activeMine
            .filter((c) => c.supportedModels.includes(m.name))
            .map((c) => c.merchantName)
        ),
      ]
      return { ...m, channels: [PLATFORM_CHANNEL_NAME, ...merchantNames] }
    })
    const channels = [
      PLATFORM_CHANNEL_NAME,
      ...new Set(activeMine.map((c) => c.merchantName)),
    ]
    return ok({
      models,
      channels,
      vendors: marketVendors,
    }) as ApiResponse<T>
  }

  /* ---------------- tickets (support ledger) ---------------- */
  if (path === '/api/ticket/' && method === 'GET') {
    const status = String(params.status ?? '') as TicketStatus | ''
    const keyword = String(params.keyword ?? '').toLowerCase()
    const filtered = tickets
      .filter((t) => {
        if (status && t.status !== status) return false
        if (keyword && !t.title.toLowerCase().includes(keyword)) return false
        return true
      })
      .sort((a, b) => b.updated - a.updated)
      // The list must not carry each ticket's full message thread.
      .map(({ messages, ...rest }) => {
        void messages
        return rest
      })
    return ok(paginate(filtered, params)) as ApiResponse<T>
  }
  if (path === '/api/ticket/' && method === 'POST') {
    const title = String(body.title ?? '').trim()
    const content = String(body.content ?? '').trim()
    if (!title || title.length > 100)
      return fail('标题长度为 1-100 字符') as ApiResponse<T>
    if (!content || content.length > 2000)
      return fail('描述长度为 1-2000 字符') as ApiResponse<T>
    const rawCategory = String(body.category ?? 'other')
    const rawPriority = String(body.priority ?? 'normal')
    if (!oneOf(rawCategory, TICKET_CATEGORIES)) {
      return fail('无效的工单分类') as ApiResponse<T>
    }
    if (!oneOf(rawPriority, TICKET_PRIORITIES)) {
      return fail('无效的工单优先级') as ApiResponse<T>
    }
    const images = parseStringArray(body.images ?? [], 4, 2_048)
    if (!images) return fail('工单图片格式不正确') as ApiResponse<T>
    const modelId = body.model_id ? String(body.model_id).trim() : ''
    const requestId = body.request_id ? String(body.request_id).trim() : ''
    if (modelId.length > 128 || requestId.length > 128) {
      return fail('模型或请求标识过长') as ApiResponse<T>
    }
    const ts = Math.floor(Date.now() / 1000)
    const ticket: TicketItem = {
      id: mockRuntime.nextTicketId++,
      title,
      category: rawCategory,
      priority: rawPriority,
      status: 'open',
      reply_count: 1,
      last_reply_role: 'user',
      model_id: modelId || undefined,
      request_id: requestId || undefined,
      created: ts,
      updated: ts,
      messages: [
        {
          id: mockRuntime.nextMessageId++,
          role: 'user',
          content,
          images,
          created: ts,
        },
      ],
    }
    tickets.unshift(ticket)
    return ok({ id: ticket.id, ticket }) as ApiResponse<T>
  }

  const ticketIdMatch = path.match(/^\/api\/ticket\/(\d+)(\/reply|\/status)?$/)
  if (ticketIdMatch) {
    const id = Number(ticketIdMatch[1])
    const ticket = tickets.find((t) => t.id === id)
    if (!ticket) return fail('工单不存在') as ApiResponse<T>
    const sub = ticketIdMatch[2]

    if (!sub && method === 'GET') {
      const { messages, ...rest } = ticket
      return ok({ ticket: rest, messages }) as ApiResponse<T>
    }

    if (sub === '/reply' && method === 'POST') {
      if (ticket.status === 'closed') {
        return fail('工单已关闭，无法回复') as ApiResponse<T>
      }
      const content = String(body.content ?? '').trim()
      if (!content || content.length > 2000) {
        return fail('回复长度为 1-2000 字符') as ApiResponse<T>
      }
      const images = parseStringArray(body.images ?? [], 4, 2_048)
      if (!images) return fail('回复图片格式不正确') as ApiResponse<T>
      const message: TicketMessage = {
        id: mockRuntime.nextMessageId++,
        role: 'user',
        content,
        images,
        created: Math.floor(Date.now() / 1000),
      }
      ticket.messages.push(message)
      ticket.status = 'open'
      ticket.last_reply_role = 'user'
      ticket.reply_count = ticket.messages.length
      ticket.updated = message.created
      return ok({ message }) as ApiResponse<T>
    }

    if (sub === '/status' && method === 'PUT') {
      const next = String(body.status ?? '') as 'open' | 'closed'
      if (next !== 'open' && next !== 'closed') {
        return fail('无效的工单状态') as ApiResponse<T>
      }
      const ts = Math.floor(Date.now() / 1000)
      ticket.status = next
      ticket.updated = ts
      ticket.messages.push({
        id: mockRuntime.nextMessageId++,
        role: 'system',
        content: next === 'closed' ? '工单已关闭' : '工单已重新开启',
        images: [],
        created: ts,
      })
      ticket.reply_count = ticket.messages.length
      const { messages, ...rest } = ticket
      void messages
      return ok({ ticket: rest }) as ApiResponse<T>
    }
  }

  /* ---------------- activity center ---------------- */
  if (path === '/api/activity/self' && method === 'GET') {
    requireAuth(ctx)
    return ok({ activities, summary: activitySummary }) as ApiResponse<T>
  }
  if (path === '/api/activity/checkin' && method === 'POST') {
    requireAuth(ctx)
    const id = Number(body.activity_id)
    const act = activities.find((a) => a.kind === 'checkin' && a.id === id)
    if (!act || act.kind !== 'checkin')
      return fail('活动不存在') as ApiResponse<T>
    if (act.checkin.todayClaimed) return fail('今日已签到') as ApiResponse<T>
    const day = act.checkin.days[act.checkin.streak % act.checkin.days.length]
    if (!creditAccountQuota(day.reward)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    day.done = true
    act.checkin.streak += 1
    act.checkin.todayClaimed = true
    act.checkin.total_days += 1
    act.checkin.month_days += 1
    act.checkin.total_reward += day.reward
    act.checkin.month_reward += day.reward
    // Mark today's week entry as claimed
    const todayEntry = act.checkin.week_entries.find((e) => e.today)
    if (todayEntry) {
      todayEntry.claimed = true
      todayEntry.reward = day.reward
    }
    activitySummary.claimable = Math.max(0, activitySummary.claimable - 1)
    activitySummary.reward_earned += day.reward
    return ok({
      reward: day.reward,
      streak: act.checkin.streak,
    }) as ApiResponse<T>
  }
  if (path === '/api/activity/claim' && method === 'POST') {
    requireAuth(ctx)
    const id = Number(body.activity_id)
    const act = activities.find((a) => a.id === id)
    if (!act) return fail('活动不存在') as ApiResponse<T>

    if (act.kind === 'newcomer') {
      const taskId = body.task_id ? String(body.task_id) : null
      if (taskId) {
        const task = act.newcomer.tasks.find((t) => t.id === taskId)
        if (!task) return fail('任务不存在') as ApiResponse<T>
        if (task.done) return fail('该任务已领取') as ApiResponse<T>
        if (!creditAccountQuota(task.reward)) {
          return fail('账户余额更新失败') as ApiResponse<T>
        }
        task.done = true
        activitySummary.reward_earned += task.reward
        return ok({
          message: '领取成功',
          reward: task.reward,
        }) as ApiResponse<T>
      }
      if (act.newcomer.claimed) return fail('礼包已领取') as ApiResponse<T>
      const reward = act.newcomer.tasks
        .filter((t) => !t.done)
        .reduce((s, t) => s + t.reward, 0)
      if (reward <= 0) return fail('暂无可领取奖励') as ApiResponse<T>
      if (!creditAccountQuota(reward)) {
        return fail('账户余额更新失败') as ApiResponse<T>
      }
      act.newcomer.tasks.forEach((t) => (t.done = true))
      act.newcomer.claimed = true
      activitySummary.claimable = Math.max(0, activitySummary.claimable - 1)
      activitySummary.reward_earned += reward
      return ok({ message: '领取成功', reward }) as ApiResponse<T>
    }

    return fail('该活动不支持领取') as ApiResponse<T>
  }

  /* ---------------- marketplace (buy / sell) ---------------- */
  if (path === '/api/market/catalog' && method === 'GET') {
    // Buy side: only listed (active) public offers; the user's own listings are
    // served separately via /self/listings so the sell console owns their state.
    const listings = marketListings.filter(
      (l) => l.status === 'active' && l.ownerUid == null
    )
    return ok({
      listings,
      merchants: marketMerchants,
      channels: marketplaceChannels,
      vendors: [...new Set(listings.flatMap((l) => l.modelVendors))].sort(),
      // Full-catalog stats: computed over ALL public active listings, so they
      // stay stable regardless of client-side filtering.
      meta: {
        merchantCount: new Set(listings.map((l) => l.merchantId)).size,
        channelCount: listings.length,
        avgAvailability:
          listings.length > 0
            ? Math.round(
                (listings.reduce((s, l) => s + l.availability, 0) /
                  listings.length) *
                  10
              ) / 10
            : 0,
      },
    }) as ApiResponse<T>
  }

  /* ---------------- marketplace (my channels) ---------------- */
  if (path === '/api/market/my-channels' && method === 'GET') {
    return ok({ channels: myChannels }) as ApiResponse<T>
  }

  const myChannelMatch = path.match(/^\/api\/market\/my-channels\/(\d+)$/)
  if (myChannelMatch) {
    const channel = myChannels.find((c) => c.id === Number(myChannelMatch[1]))
    if (!channel) return fail('渠道不存在') as ApiResponse<T>

    if (method === 'PUT') {
      channel.status = channel.status === 'active' ? 'disabled' : 'active'
      return ok({
        channel,
        message: channel.status === 'active' ? '渠道已启用' : '渠道已禁用',
      }) as ApiResponse<T>
    }

    if (method === 'DELETE') {
      myChannels.splice(myChannels.indexOf(channel), 1)
      return ok({ message: '渠道已移除' }) as ApiResponse<T>
    }
  }

  const addAllMatch = path.match(/^\/api\/market\/merchant\/(\d+)\/add-all$/)
  if (addAllMatch && method === 'POST') {
    const merchantId = Number(addAllMatch[1])
    if (!marketMerchants.some((m) => m.id === merchantId)) {
      return fail('商家不存在') as ApiResponse<T>
    }
    const candidates = marketListings.filter(
      (l) =>
        l.merchantId === merchantId &&
        l.status === 'active' &&
        l.ownerUid == null &&
        !myChannels.some((c) => c.listingId === l.id)
    )
    if (candidates.length === 0)
      return fail('该商家渠道均已添加') as ApiResponse<T>
    candidates.forEach((l) => {
      addMyChannel(l)
      l.reviewCount += 1
    })
    return ok({ added: candidates.length }) as ApiResponse<T>
  }

  if (path === '/api/market/self/listings' && method === 'GET') {
    const uid = Number(ctx.headers['X-Ren2Hub-Demo-User'])
    const mine = marketListings.filter((l) => l.ownerUid === uid)
    const active = mine.filter((l) => l.status === 'active')
    return ok({
      listings: mine,
      stats: {
        active: active.length,
        totalSales: mine.reduce((s, l) => s + l.reviewCount, 0),
        // Pending settlement earnings, in quota units (see /api/market/settle).
        pendingEarnings: mockRuntime.marketSelfEarnings,
        rating:
          mine.length > 0
            ? Math.round(
                (mine.reduce((s, l) => s + l.rating, 0) / mine.length) * 10
              ) / 10
            : 0,
      },
    }) as ApiResponse<T>
  }

  if (path === '/api/market/listing' && method === 'POST') {
    const uid = Number(ctx.headers['X-Ren2Hub-Demo-User'])
    const title = String(body.title ?? '').trim()
    if (!title || title.length > 60)
      return fail('商品名称长度为 1-60 字符') as ApiResponse<T>
    const priceUSD = Number(body.priceUSD ?? 0)
    if (!Number.isFinite(priceUSD) || priceUSD <= 0 || priceUSD > 1_000_000) {
      return fail('价格需在 $0-$1,000,000 之间') as ApiResponse<T>
    }
    const models = parseStringArray(body.supportedModels, 100)
    if (
      !models ||
      models.length === 0 ||
      models.some((m) => !MODELS.includes(m))
    ) {
      return fail('请至少选择一个支持模型') as ApiResponse<T>
    }
    const tags = parseStringArray(body.tags ?? [], 10, 32)
    if (!tags) return fail('标签格式不正确') as ApiResponse<T>
    const rawType = String(body.type ?? 'chat')
    if (!oneOf(rawType, MARKET_MODEL_TYPES)) {
      return fail('无效的供货类型') as ApiResponse<T>
    }
    const summary = String(body.summary ?? '').trim()
    if (summary.length > 280) {
      return fail('供货说明不能超过 280 字符') as ApiResponse<T>
    }
    const source = String(body.source ?? marketplaceChannels[0]).trim()
    if (!marketplaceChannels.includes(source)) {
      return fail('无效的渠道来源') as ApiResponse<T>
    }
    const ts = Math.floor(Date.now() / 1000)
    const listing: MarketListing = {
      id: mockRuntime.nextListingId++,
      merchantId: 1,
      title,
      summary,
      source,
      availability: 99,
      supportedModels: models,
      qcScore: 95,
      tags,
      priceUSD,
      type: rawType,
      listedAt: ts,
      rating: 0,
      reviewCount: 0,
      // New offers enter review before going live, mirroring the real backend.
      status: 'reviewing',
      ownerUid: uid,
      modelVendors: [
        ...new Set(models.map((m) => modelVendorMap[m]).filter(Boolean)),
      ],
    }
    marketListings.unshift(listing)
    return ok({ listing, message: '供货已提交审核' }) as ApiResponse<T>
  }

  const listingIdMatch = path.match(/^\/api\/market\/listing\/(\d+)(\/add)?$/)
  if (listingIdMatch) {
    const id = Number(listingIdMatch[1])
    const listing = marketListings.find((l) => l.id === id)
    if (!listing) return fail('供货不存在') as ApiResponse<T>
    const uid = Number(ctx.headers['X-Ren2Hub-Demo-User'])

    if (listingIdMatch[2] === '/add' && method === 'POST') {
      // Buyer adds a listing to their manageable channel list (我的渠道).
      if (listing.ownerUid != null || listing.status !== 'active') {
        return fail('该供货当前不可添加') as ApiResponse<T>
      }
      if (myChannels.some((c) => c.listingId === listing.id)) {
        return fail('该渠道已添加') as ApiResponse<T>
      }
      addMyChannel(listing)
      listing.reviewCount += 1
      return ok({
        message: `已添加「${listing.title}」到我的渠道`,
      }) as ApiResponse<T>
    }

    // Owner-only mutations below.
    if (listing.ownerUid !== uid)
      return fail('无权操作该供货') as ApiResponse<T>

    if (method === 'PUT') {
      const next: MarketListing = { ...listing }
      if (body.title !== undefined) {
        const title = String(body.title).trim()
        if (!title || title.length > 60) {
          return fail('商品名称长度为 1-60 字符') as ApiResponse<T>
        }
        next.title = title
      }
      if (body.summary !== undefined) {
        const summary = String(body.summary).trim()
        if (summary.length > 280) {
          return fail('供货说明不能超过 280 字符') as ApiResponse<T>
        }
        next.summary = summary
      }
      if (body.source !== undefined) {
        const source = String(body.source).trim()
        if (!marketplaceChannels.includes(source)) {
          return fail('无效的渠道来源') as ApiResponse<T>
        }
        next.source = source
      }
      if (body.supportedModels !== undefined) {
        const models = parseStringArray(body.supportedModels, 100)
        if (
          !models ||
          models.length === 0 ||
          models.some((model) => !MODELS.includes(model))
        ) {
          return fail('请至少选择一个有效模型') as ApiResponse<T>
        }
        next.supportedModels = models
        next.modelVendors = [
          ...new Set(
            models.map((model) => modelVendorMap[model]).filter(Boolean)
          ),
        ]
      }
      if (body.tags !== undefined) {
        const tags = parseStringArray(body.tags, 10, 32)
        if (!tags) return fail('标签格式不正确') as ApiResponse<T>
        next.tags = tags
      }
      if (body.priceUSD !== undefined) {
        const priceUSD = Number(body.priceUSD)
        if (
          !Number.isFinite(priceUSD) ||
          priceUSD <= 0 ||
          priceUSD > 1_000_000
        ) {
          return fail('价格需在 $0-$1,000,000 之间') as ApiResponse<T>
        }
        next.priceUSD = priceUSD
      }
      if (body.type !== undefined) {
        const type = String(body.type)
        if (!oneOf(type, MARKET_MODEL_TYPES)) {
          return fail('无效的供货类型') as ApiResponse<T>
        }
        next.type = type
      }
      if (body.status !== undefined) {
        const status = String(body.status)
        if (!oneOf(status, LISTING_STATUSES)) {
          return fail('无效的供货状态') as ApiResponse<T>
        }
        if (listing.status === 'reviewing' || status === 'reviewing') {
          return fail('审核状态只能由平台更新') as ApiResponse<T>
        }
        next.status = status
      }
      Object.assign(listing, next)
      return ok({ listing, message: '供货已更新' }) as ApiResponse<T>
    }

    if (method === 'DELETE') {
      marketListings.splice(marketListings.indexOf(listing), 1)
      return ok({ message: '供货已下架' }) as ApiResponse<T>
    }
  }

  if (path === '/api/market/settle' && method === 'POST') {
    if (mockRuntime.marketSelfEarnings <= 0)
      return fail('暂无可结算收益') as ApiResponse<T>
    const settled = mockRuntime.marketSelfEarnings
    if (!creditAccountQuota(settled)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    mockRuntime.marketSelfEarnings = 0
    return ok({
      message: '收益已转入账户余额',
      quota: settled,
    }) as ApiResponse<T>
  }

  /* ---------------- alchemy lab (UI prototype) ---------------- */
  // Chat: landing needs model picks + starter cards + the conversation list;
  // opening a conversation fetches its messages by id. Contract §lab.
  if (path === '/api/lab/chat/landing' && method === 'GET') {
    requireAuth(ctx)
    return ok({
      models: labModelPicks,
      starters: labStarters,
      conversations: chatConversations.map(({ messages, ...rest }) => {
        void messages
        return rest
      }),
    }) as ApiResponse<T>
  }
  if (path.startsWith('/api/lab/chat/conversation/') && method === 'GET') {
    requireAuth(ctx)
    const id = path.split('/').pop()
    const convo = chatConversations.find((c) => c.id === id)
    if (!convo) return fail('对话不存在') as ApiResponse<T>
    return ok(convo) as ApiResponse<T>
  }

  // Studio: shared image+video gallery plus the quick-tool shortcuts.
  if (path === '/api/lab/studio' && method === 'GET') {
    requireAuth(ctx)
    const kind = params.kind as string | undefined
    const works =
      kind === 'image' || kind === 'video'
        ? studioGallery.filter((w) => w.kind === kind)
        : studioGallery
    return ok({ works, tools: studioTools }) as ApiResponse<T>
  }

  // Assets: filter by kind tab; header shows the storage meter.
  if (path === '/api/lab/assets' && method === 'GET') {
    requireAuth(ctx)
    const kind = params.kind as string | undefined
    const items =
      kind && kind !== 'all'
        ? assetItems.filter((a) =>
            kind === 'media'
              ? a.kind === 'image' || a.kind === 'video'
              : a.kind === kind
          )
        : assetItems
    return ok({ items, storage: assetStorage }) as ApiResponse<T>
  }

  if (path === '/api/lab/notes' && method === 'GET') {
    requireAuth(ctx)
    return ok({ items: noteItems }) as ApiResponse<T>
  }

  if (path === '/api/lab/community' && method === 'GET') {
    requireAuth(ctx)
    const category = params.category as CommunityCategory | 'all' | undefined
    const sort = params.sort as string | undefined
    let works = communityWorks.slice()
    if (category && category !== 'all')
      works = works.filter((w) => w.category === category)
    if (sort === 'featured') works = works.filter((w) => w.featured)
    return ok({ works }) as ApiResponse<T>
  }

  if (path === '/api/lab/plugins' && method === 'GET') {
    requireAuth(ctx)
    return ok({
      plugins: installedPlugins,
      mcp: mcpServers,
      skills: skillItems,
      market: marketPlugins,
    }) as ApiResponse<T>
  }

  /* ---------------- invoices (fapiao / 开票) ---------------- */

  if (path === '/api/invoice/self' && method === 'GET') {
    requireAuth(ctx)
    const result = paginate(invoices, params)
    return ok(result) as ApiResponse<T>
  }

  if (path === '/api/invoice/apply' && method === 'POST') {
    requireAuth(ctx)
    const title = String(body.title ?? '').trim()
    const amount = Number(body.amount ?? 0)
    if (!title) return fail('发票抬头不能为空') as ApiResponse<T>
    if (!Number.isFinite(amount) || amount < 200 || amount > 10_000_000)
      return fail('开票金额最低 200 元') as ApiResponse<T>
    const item = addInvoice({
      title,
      tax_id: String(body.tax_id ?? '').trim(),
      amount,
      email: String(body.email ?? '').trim(),
      note: String(body.note ?? '').trim(),
    })
    return ok({
      invoice: item,
      message: '申请已提交，等待管理员审核',
    }) as ApiResponse<T>
  }

  if (
    path.startsWith('/api/invoice/') &&
    path.endsWith('/pdf') &&
    method === 'GET'
  ) {
    requireAuth(ctx)
    const id = Number(path.split('/')[3])
    const inv = invoices.find((i) => i.id === id)
    if (!inv) return fail('开票记录不存在') as ApiResponse<T>
    if (inv.status !== 'issued') return fail('发票尚未开具') as ApiResponse<T>
    return ok({ pdf_url: inv.pdf_url }) as ApiResponse<T>
  }

  /* ---------------- farm (RT农家乐) ---------------- */
  if (path === '/api/farm/self' && method === 'GET') {
    return ok({
      state: farmState,
      plots: farmPlots,
      animals: ranchAnimals,
      fishing: fishingState,
      pet: myPet,
      mine: mineState,
    }) as ApiResponse<T>
  }

  if (path === '/api/farm/leader' && method === 'GET') {
    const period = String(params.period ?? 'day')
    if (!oneOf(period, ['day', 'week', 'all'] as const)) {
      return fail('无效的排行榜周期') as ApiResponse<T>
    }
    return ok({ entries: leaderboard, period }) as ApiResponse<T>
  }

  if (path === '/api/farm/rebate' && method === 'GET') {
    return ok({ tiers: rebateTiers, state: rebateState }) as ApiResponse<T>
  }

  const farmHarvestMatch = path.match(/^\/api\/farm\/harvest\/(\d+)$/)
  if (farmHarvestMatch && method === 'POST') {
    const plotId = Number(farmHarvestMatch[1])
    const plot = farmPlots.find((p) => p.id === plotId)
    if (!plot) return fail('地块不存在') as ApiResponse<T>
    if (plot.stage !== 'ready') return fail('作物尚未成熟') as ApiResponse<T>
    const gained = plot.yield_quota
    farmState.coins += gained
    plot.stage = 'empty'
    plot.seed = null
    plot.planted_at = null
    plot.harvest_at = null
    plot.yield_quota = 0
    return ok({ coins: farmState.coins, gained }) as ApiResponse<T>
  }

  const farmFeedAnimalMatch = path.match(/^\/api\/farm\/feed\/animal\/(\d+)$/)
  if (farmFeedAnimalMatch && method === 'POST') {
    const animalId = Number(farmFeedAnimalMatch[1])
    const animal = ranchAnimals.find((a) => a.id === animalId)
    if (!animal) return fail('动物不存在') as ApiResponse<T>
    animal.fed_at = Math.floor(Date.now() / 1000)
    animal.mood = 100
    return ok({ animal }) as ApiResponse<T>
  }

  const farmCollectAnimalMatch = path.match(
    /^\/api\/farm\/collect\/animal\/(\d+)$/
  )
  if (farmCollectAnimalMatch && method === 'POST') {
    const animalId = Number(farmCollectAnimalMatch[1])
    const animal = ranchAnimals.find((a) => a.id === animalId)
    if (!animal) return fail('动物不存在') as ApiResponse<T>
    if (!animal.yield_ready) return fail('暂无可收取的产出') as ApiResponse<T>
    const gained = animal.yield_quota
    farmState.coins += gained
    animal.yield_ready = false
    return ok({ coins: farmState.coins, gained }) as ApiResponse<T>
  }

  if (path === '/api/farm/fish' && method === 'POST') {
    if (fishingState.daily_left <= 0)
      return fail('今日钓鱼次数已用完') as ApiResponse<T>
    const catchPool = [
      { name: '小鱼干', quota: 5000, rarity: 'common' as const, emoji: '🐟' },
      { name: '草鱼', quota: 15000, rarity: 'common' as const, emoji: '🐠' },
      { name: '鲤鱼', quota: 30000, rarity: 'common' as const, emoji: '🐡' },
      { name: '金鲤鱼', quota: 80000, rarity: 'rare' as const, emoji: '🐠' },
      { name: '锦鲤', quota: 200000, rarity: 'rare' as const, emoji: '🎏' },
      {
        name: '龙鱼',
        quota: 1000000,
        rarity: 'legendary' as const,
        emoji: '🐉',
      },
    ]
    // Pick rarity first: common 70%, rare 25%, legendary 5%
    const rarityRoll = Math.random() * 100
    const rarity =
      rarityRoll < 70 ? 'common' : rarityRoll < 95 ? 'rare' : 'legendary'
    const pool = catchPool.filter((f) => f.rarity === rarity)
    const caught = pool[Math.floor(Math.random() * pool.length)]
    fishingState.daily_left -= 1
    fishingState.last_catch = caught
    farmState.coins += caught.quota
    return ok({
      catch: fishingState.last_catch,
      daily_left: fishingState.daily_left,
      coins: farmState.coins,
    }) as ApiResponse<T>
  }

  if (path === '/api/farm/feed/pet' && method === 'POST') {
    myPet.fed_today = true
    myPet.energy = 100
    return ok({ pet: myPet }) as ApiResponse<T>
  }

  /* ---------------- bigame (无趣大游戏) ---------------- */
  if (path === '/api/bigame/self' && method === 'GET') {
    return ok({
      wallet: gameWallet,
      milestones,
      prizes: spinPrizes,
      records: prizeRecords,
    }) as ApiResponse<T>
  }

  if (path === '/api/bigame/spin' && method === 'POST') {
    const SPIN_COST = 5
    if (gameWallet.balance < SPIN_COST)
      return fail('游戏币不足，无法转盘') as ApiResponse<T>
    // Weighted random pick
    const totalWeight = spinPrizes.reduce((s, p) => s + p.weight, 0)
    let roll = Math.random() * totalWeight
    const prize =
      spinPrizes.find((p) => (roll -= p.weight) < 0) ?? spinPrizes[0]
    if (prize.type === 'quota' && !creditAccountQuota(prize.value)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    gameWallet.balance -= SPIN_COST
    gameWallet.total_spent += SPIN_COST
    if (prize.type === 'coins') {
      gameWallet.balance += prize.value
      gameWallet.total_earned += prize.value
    }
    const record: PrizeRecord = {
      id: prizeRecords.length + 1,
      source: 'spin',
      prize_label: prize.label,
      rarity: 'common',
      value: prize.value,
      type: prize.type === 'nothing' ? 'coins' : prize.type,
      created: Math.floor(Date.now() / 1000),
    }
    prizeRecords.unshift(record)
    return ok({ prize, wallet: gameWallet }) as ApiResponse<T>
  }

  if (path === '/api/bigame/box' && method === 'POST') {
    const BOX_COST = 10
    if (gameWallet.balance < BOX_COST)
      return fail('游戏币不足，无法开盲盒') as ApiResponse<T>
    // Pick rarity tier first by weight: common 70%, rare 20%, epic 8%, legendary 2%
    const rarityRoll = Math.random() * 100
    const rarity =
      rarityRoll < 70
        ? 'common'
        : rarityRoll < 90
          ? 'rare'
          : rarityRoll < 98
            ? 'epic'
            : 'legendary'
    const pool = blindBoxPrizes.filter((p) => p.rarity === rarity)
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0)
    let roll = Math.random() * totalWeight
    const prize = pool.find((p) => (roll -= p.weight) < 0) ?? pool[0]
    if (prize.type === 'quota' && !creditAccountQuota(prize.value)) {
      return fail('账户余额更新失败') as ApiResponse<T>
    }
    gameWallet.balance -= BOX_COST
    gameWallet.total_spent += BOX_COST
    if (prize.type === 'coins') {
      gameWallet.balance += prize.value
      gameWallet.total_earned += prize.value
    }
    const record: PrizeRecord = {
      id: prizeRecords.length + 1,
      source: 'box',
      prize_label: prize.label,
      rarity: prize.rarity,
      value: prize.value,
      type: prize.type,
      created: Math.floor(Date.now() / 1000),
    }
    prizeRecords.unshift(record)
    return ok({ prize, wallet: gameWallet }) as ApiResponse<T>
  }

  if (path === '/api/bigame/milestone/claim' && method === 'POST') {
    const id = String(body.id ?? '')
    const milestone = milestones.find((m) => m.id === id)
    if (!milestone) return fail('里程碑不存在') as ApiResponse<T>
    if (milestone.claimed) return fail('该里程碑奖励已领取') as ApiResponse<T>
    if (milestone.current < milestone.target)
      return fail('尚未达成该里程碑') as ApiResponse<T>
    milestone.claimed = true
    gameWallet.balance += milestone.reward
    gameWallet.total_earned += milestone.reward
    return ok({ wallet: gameWallet }) as ApiResponse<T>
  }

  /* ---------------- admin redemption codes ---------------- */
  if (
    (path === '/api/redemption/' || path === '/api/redemption/search') &&
    method === 'GET'
  ) {
    const keyword =
      path === '/api/redemption/search'
        ? String(params.keyword ?? '')
            .trim()
            .toLowerCase()
        : String(params.keyword ?? '')
            .trim()
            .toLowerCase()
    const typeFilter = String(params.type ?? '').toLowerCase()
    const statusFilter = String(params.status ?? '').toLowerCase()

    // Compute type & status counts before secondary filters.
    let base = adminRedemptionCodes.filter((c) => {
      if (!keyword) return true
      return (
        c.code.toLowerCase().includes(keyword) ||
        c.name.toLowerCase().includes(keyword) ||
        c.redeemer_email.toLowerCase().includes(keyword) ||
        String(c.id).includes(keyword)
      )
    })

    const typeCounts: Record<string, number> = {}
    const statusCounts: Record<string, number> = {}
    base.forEach((c) => {
      typeCounts[c.type] = (typeCounts[c.type] ?? 0) + 1
      statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1
    })

    if (typeFilter) base = base.filter((c) => c.type === typeFilter)
    if (statusFilter) base = base.filter((c) => c.status === statusFilter)

    const rawSort = String(params.sort_by ?? 'id')
    const sortBy = ['id', 'created_time', 'used_time'].includes(rawSort)
      ? rawSort
      : 'id'
    const sortOrder = String(params.sort_order).toLowerCase() === 'asc' ? 1 : -1
    const sorted = [...base].sort((a, b) => {
      const av = a[sortBy as keyof AdminRedemptionCode] as number
      const bv = b[sortBy as keyof AdminRedemptionCode] as number
      return (Number(av) - Number(bv)) * sortOrder
    })

    const p = Number(params.p ?? 1)
    const ps = Math.min(100, Number(params.page_size ?? 20))
    const page = Number.isFinite(p) && p > 0 ? Math.floor(p) : 1
    const pageSize = Number.isFinite(ps) && ps > 0 ? Math.floor(ps) : 20
    const start = (page - 1) * pageSize

    return ok({
      items: sorted.slice(start, start + pageSize).map((c) => ({ ...c })),
      total: sorted.length,
      page,
      page_size: pageSize,
      type_counts: typeCounts,
      status_counts: statusCounts,
    }) as ApiResponse<T>
  }

  if (path === '/api/redemption/' && method === 'POST') {
    const type = String(body.type ?? '') as AdminRedemptionCode['type']
    if (!['quota', 'concurrency', 'subscription', 'invite'].includes(type)) {
      return fail('无效的兑换码类型') as ApiResponse<T>
    }
    const count = Number(body.count ?? 1)
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
      return fail('数量需在 1-100 之间') as ApiResponse<T>
    }
    const expiredTime = Number(body.expired_time ?? -1)
    if (
      !Number.isSafeInteger(expiredTime) ||
      (expiredTime !== -1 && expiredTime <= Math.floor(Date.now() / 1000))
    ) {
      return fail('过期时间格式不正确') as ApiResponse<T>
    }

    let amount: number | undefined
    let quota: number | undefined
    let concurrency: number | undefined
    let planId: number | undefined
    let name: string

    if (type === 'quota') {
      const a = Number(body.amount ?? 0)
      if (!Number.isFinite(a) || a <= 0 || a > 100_000) {
        return fail('金额需在 $0-$100,000 之间') as ApiResponse<T>
      }
      amount = Math.round(a * 100) / 100
      quota = Math.round(amount * 500_000)
      name = `$${amount.toFixed(2)}`
    } else if (type === 'concurrency') {
      const n = Number(body.concurrency ?? 0)
      if (!Number.isSafeInteger(n) || n < 1 || n > 10_000) {
        return fail('并发数需在 1-10,000 之间') as ApiResponse<T>
      }
      concurrency = n
      name = `${n} 并发`
    } else if (type === 'subscription') {
      const pid = Number(body.plan_id ?? 0)
      const plan = plans.find((p) => p.id === pid)
      if (!plan) return fail('套餐不存在') as ApiResponse<T>
      planId = pid
      name = plan.name
    } else {
      name = '邀请码'
    }

    // Generate N random hex codes.
    const codes: string[] = []
    const now = Math.floor(Date.now() / 1000)
    const newItems: AdminRedemptionCode[] = Array.from(
      { length: count },
      () => {
        const rawHex = Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')
        codes.push(rawHex)
        const item: AdminRedemptionCode = {
          id: mockRuntime.nextRedemptionCodeId++,
          name,
          code: rawHex,
          type,
          status: 'unused',
          quota,
          amount,
          concurrency,
          plan_id: planId,
          redeemer_id: 0,
          redeemer_email: '',
          created_time: now,
          used_time: 0,
          expired_time: expiredTime,
        }
        adminRedemptionCodes.unshift(item)
        return item
      }
    )

    return ok(
      { codes, items: newItems.map((c) => ({ ...c })) },
      `已生成 ${count} 个兑换码`
    ) as ApiResponse<T>
  }

  if (path === '/api/redemption/batch' && method === 'POST') {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return fail('兑换码 ID 列表格式不正确') as ApiResponse<T>
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return fail('兑换码 ID 列表格式不正确') as ApiResponse<T>
    }
    const unique = [...new Set(ids)]
    let deleted = 0
    for (let i = adminRedemptionCodes.length - 1; i >= 0; i--) {
      if (unique.includes(adminRedemptionCodes[i]!.id)) {
        adminRedemptionCodes.splice(i, 1)
        deleted++
      }
    }
    return ok(deleted, `已删除 ${deleted} 个兑换码`) as ApiResponse<T>
  }

  const redemptionIdMatch = path.match(/^\/api\/redemption\/(\d+)(\/status)?$/)
  if (redemptionIdMatch) {
    const id = Number(redemptionIdMatch[1])
    const code = adminRedemptionCodes.find((c) => c.id === id)
    if (!code) return fail('兑换码不存在') as ApiResponse<T>

    if (redemptionIdMatch[2] === '/status' && method === 'POST') {
      if (code.status === 'used' || code.status === 'expired') {
        return fail('已使用或已过期的兑换码不可更改状态') as ApiResponse<T>
      }
      code.status = code.status === 'disabled' ? 'unused' : 'disabled'
      return ok(
        { ...code },
        code.status === 'disabled' ? '兑换码已禁用' : '兑换码已启用'
      ) as ApiResponse<T>
    }

    if (method === 'DELETE') {
      const index = adminRedemptionCodes.indexOf(code)
      adminRedemptionCodes.splice(index, 1)
      return ok({ id }, '兑换码已删除') as ApiResponse<T>
    }
  }

  throw new ApiError(`接口不存在：${method} ${path}`, { status: 404 })
}
