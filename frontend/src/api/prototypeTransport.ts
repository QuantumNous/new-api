import {
  activities,
  activitySummary,
  adminChannels,
  adminOrders,
  adminPlans,
  adminRedemptionCodes,
  adminUsers,
  inviteInfo,
  invoices,
  marketListings,
  marketMerchants,
  marketModels,
  marketVendors,
  marketplaceChannels,
  myChannels,
  tickets,
} from './mock/data'
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
} from './mock/lab'
import {
  farmPlots,
  farmState,
  fishingState,
  leaderboard,
  mineState,
  myPet,
  ranchAnimals,
  rebateState,
  rebateTiers,
} from './mock/farm'
import { gameWallet, milestones, prizeRecords, spinPrizes } from './mock/bigame'
import { ApiError, type ApiResponse } from './types'
import type { HttpMethod, RequestOptions } from './transport'

const PROTOTYPE_PREFIXES = [
  '/api/market',
  '/api/order',
  '/api/ticket',
  '/api/invoice',
  '/api/invite',
  '/api/activity',
  '/api/lab',
  '/api/farm',
  '/api/bigame',
  '/api/channel',
  '/api/redemption',
  '/api/plan',
  '/api/models/market',
] as const

function isAdminUserEndpoint(url: string): boolean {
  return (
    url === '/api/user/' ||
    url === '/api/user/search' ||
    url === '/api/user/quota' ||
    url === '/api/user/status/batch' ||
    url === '/api/user/batch' ||
    /^\/api\/user\/\d+(?:\/status)?$/.test(url)
  )
}

export function isPrototypeEndpoint(url: string): boolean {
  return (
    PROTOTYPE_PREFIXES.some(
      (prefix) => url === prefix || url.startsWith(`${prefix}/`)
    ) || isAdminUserEndpoint(url)
  )
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, message: '', data: clone(data) }
}

function paginate<T>(items: readonly T[], params: Record<string, unknown>) {
  const requestedPage = Number(params.p ?? params.page ?? 1)
  const requestedPageSize = Number(params.page_size ?? 20)
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageSize =
    Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(100, requestedPageSize)
      : 20
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  }
}

function counts<T>(items: readonly T[], key: (item: T) => string) {
  return items.reduce<Record<string, number>>((result, item) => {
    const value = key(item)
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
}

function listFixture(url: string, params: Record<string, unknown>): unknown {
  if (url === '/api/market/catalog') {
    const listings = marketListings.filter(
      (item) => item.status === 'active' && item.ownerUid == null
    )
    return {
      listings,
      merchants: marketMerchants,
      channels: marketplaceChannels,
      vendors: [
        ...new Set(listings.flatMap((item) => item.modelVendors)),
      ].sort(),
      meta: {
        merchantCount: new Set(listings.map((item) => item.merchantId)).size,
        channelCount: listings.length,
        avgAvailability:
          listings.length === 0
            ? 0
            : listings.reduce((sum, item) => sum + item.availability, 0) /
              listings.length,
      },
    }
  }
  if (url === '/api/market/my-channels') return { channels: myChannels }
  if (url === '/api/market/self/listings') {
    const listings = marketListings.filter((item) => item.ownerUid != null)
    return {
      listings,
      stats: {
        active: listings.filter((item) => item.status === 'active').length,
        totalSales: listings.reduce((sum, item) => sum + item.reviewCount, 0),
        pendingEarnings: 0,
        rating: 0,
      },
    }
  }
  if (url === '/api/models/market') {
    return { models: marketModels, channels: ['平台'], vendors: marketVendors }
  }
  if (url === '/api/activity/self') {
    return { activities, summary: activitySummary }
  }
  if (url === '/api/invite/self') return inviteInfo
  if (url === '/api/invoice/self') return paginate(invoices, params)
  if (/^\/api\/invoice\/\d+\/pdf$/.test(url)) {
    const id = Number(url.split('/')[3])
    return { pdf_url: invoices.find((item) => item.id === id)?.pdf_url ?? '' }
  }
  if (url === '/api/ticket/') {
    const rows = tickets.map(({ messages: _messages, ...item }) => item)
    return paginate(rows, params)
  }
  const ticketMatch = url.match(/^\/api\/ticket\/(\d+)$/)
  if (ticketMatch)
    return tickets.find((item) => item.id === Number(ticketMatch[1]))
  if (url === '/api/lab/chat/landing') {
    return {
      models: labModelPicks,
      starters: labStarters,
      conversations: chatConversations.map(
        ({ messages: _messages, ...item }) => item
      ),
    }
  }
  if (url.startsWith('/api/lab/chat/conversation/')) {
    return chatConversations.find((item) => item.id === url.split('/').pop())
  }
  if (url === '/api/lab/studio') {
    const kind = String(params.kind ?? '')
    return {
      works:
        kind === 'image' || kind === 'video'
          ? studioGallery.filter((item) => item.kind === kind)
          : studioGallery,
      tools: studioTools,
    }
  }
  if (url === '/api/lab/assets') {
    const kind = String(params.kind ?? 'all')
    return {
      items:
        kind === 'all'
          ? assetItems
          : assetItems.filter((item) =>
              kind === 'media'
                ? item.kind === 'image' || item.kind === 'video'
                : item.kind === kind
            ),
      storage: assetStorage,
    }
  }
  if (url === '/api/lab/notes') return { items: noteItems }
  if (url === '/api/lab/community') return { works: communityWorks }
  if (url === '/api/lab/plugins') {
    return {
      plugins: installedPlugins,
      mcp: mcpServers,
      skills: skillItems,
      market: marketPlugins,
    }
  }
  if (url === '/api/farm/self') {
    return {
      state: farmState,
      plots: farmPlots,
      animals: ranchAnimals,
      fishing: fishingState,
      pet: myPet,
      mine: mineState,
    }
  }
  if (url === '/api/farm/leader') {
    return { entries: leaderboard, period: params.period ?? 'week' }
  }
  if (url === '/api/farm/rebate')
    return { tiers: rebateTiers, state: rebateState }
  if (url === '/api/bigame/self') {
    return {
      wallet: gameWallet,
      milestones,
      prizes: spinPrizes,
      records: prizeRecords,
    }
  }

  if (url === '/api/channel/' || url === '/api/channel/search') {
    return {
      ...paginate(adminChannels, params),
      type_counts: counts(adminChannels, (item) => String(item.type)),
    }
  }
  if (url === '/api/user/' || url === '/api/user/search') {
    return {
      ...paginate(adminUsers, params),
      role_counts: counts(adminUsers, (item) => String(item.role)),
      status_counts: counts(adminUsers, (item) =>
        item.status === 1 ? 'enabled' : 'disabled'
      ),
    }
  }
  if (url === '/api/order/' || url === '/api/order/search') {
    return {
      ...paginate(adminOrders, params),
      status_counts: counts(adminOrders, (item) => item.status),
      method_counts: counts(adminOrders, (item) => item.method),
      type_counts: counts(adminOrders, (item) => item.type),
      filtered_revenue: adminOrders
        .filter((item) => item.status === 'completed')
        .reduce((sum, item) => sum + item.amount, 0),
    }
  }
  if (url === '/api/order/stats') {
    const completed = adminOrders.filter((item) => item.status === 'completed')
    return {
      range: Number(params.range ?? 30),
      generated_at: 0,
      today_revenue: 0,
      today_orders: 0,
      total_revenue: completed.reduce((sum, item) => sum + item.amount, 0),
      total_orders: completed.length,
      average_amount:
        completed.length === 0
          ? 0
          : completed.reduce((sum, item) => sum + item.amount, 0) /
            completed.length,
      refunded_total: adminOrders
        .filter((item) => item.status === 'refunded')
        .reduce((sum, item) => sum + item.amount, 0),
      refunded_orders: adminOrders.filter((item) => item.status === 'refunded')
        .length,
      daily: [],
      payment_share: [],
      top_spenders: [],
    }
  }
  if (url === '/api/plan/') {
    return {
      ...paginate(adminPlans, params),
      status_counts: counts(adminPlans, (item) => item.status),
      kind_counts: counts(adminPlans, (item) => item.kind),
      filtered_subscribers: adminPlans.reduce(
        (sum, item) => sum + item.subscribers,
        0
      ),
      filtered_revenue: adminPlans.reduce((sum, item) => sum + item.revenue, 0),
    }
  }
  if (url === '/api/redemption/' || url === '/api/redemption/search') {
    return {
      ...paginate(adminRedemptionCodes, params),
      status_counts: counts(adminRedemptionCodes, (item) => item.status),
      type_counts: counts(adminRedemptionCodes, (item) => item.type),
    }
  }
  throw new ApiError('该只读原型没有可用的固定数据', {
    status: 404,
    code: 'PROTOTYPE_FIXTURE_NOT_FOUND',
  })
}

export function prototypeRequest<T>(
  method: HttpMethod,
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  if (method !== 'GET') {
    return Promise.reject(
      new ApiError('该功能当前仅提供只读原型，未向后端提交数据', {
        status: 501,
        code: 'PROTOTYPE_READ_ONLY',
      })
    )
  }
  try {
    return Promise.resolve(ok(listFixture(url, options.params ?? {}) as T))
  } catch (error) {
    return Promise.reject(error)
  }
}
