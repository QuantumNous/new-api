/**
 * Token routing types:
 * - manual: the user selects platform and marketplace channels
 * - auto:   the system computes the best channels across both pools
 */
export type TokenType = 'manual' | 'auto'

/** One upstream channel bound to a token; array order = routing priority. */
export interface TokenChannel {
  name: string
  enabled: boolean
  weight?: number // load-balance weight (only meaningful when load_balance)
}

export interface TokenItem {
  id: number
  name: string
  /** Real backend routing group; preserved verbatim on edit. */
  group?: string
  key: string
  type: TokenType
  status: 1 | 2 // 1 enabled · 2 disabled
  used_quota: number
  remain_quota: number
  unlimited: boolean
  model_limits: string[]
  ip_limits: string[]
  rate_limit: number // requests / minute, 0 = unlimited
  max_ratio?: number // max accepted channel price ratio
  load_balance: boolean
  channels: TokenChannel[] // order = priority (auto: computed server-side)
  expired_time: number // -1 = never
  created_time: number
}

export type AdminChannelStatus = 1 | 2 | 3

export type AdminChannelSortBy =
  'id' | 'name' | 'priority' | 'balance' | 'response_time'

export type AdminChannelSortOrder = 'asc' | 'desc'

export interface AdminChannel extends Record<string, unknown> {
  id: number
  name: string
  type: number
  supplier: string
  status: AdminChannelStatus
  priority: number
  weight: number
  capacity_used: number
  capacity_total: number
  used_quota: number
  channel_ratio: number
  balance: number
  upstream_ratio: number
  response_time: number
  test_time: number
}

export interface AdminChannelCreateInput {
  name: string
  type: number
  status: Extract<AdminChannelStatus, 1 | 2>
  priority: number
  weight: number
  capacity_total: number
  channel_ratio: number
}

export type AdminChannelUpdateInput = Omit<AdminChannelCreateInput, 'status'>

export interface AdminChannelPage {
  items: AdminChannel[]
  total: number
  page: number
  page_size: number
  type_counts: Record<string, number>
}

/**
 * Mirrors the backend role ladder in `common/constants.go`:
 * RoleGuestUser=0 · RoleCommonUser=1 · RoleAdminUser=10 · RoleRootUser=100.
 */
export type AdminUserRole = 0 | 1 | 10 | 100

/** 1 enabled · 2 disabled — same convention as channels and tokens. */
export type AdminUserStatus = 1 | 2

export type AdminUserSortBy =
  | 'id'
  | 'username'
  | 'quota'
  | 'used_quota'
  | 'created_time'
  | 'last_login_time'

export type AdminUserSortOrder = 'asc' | 'desc'

export interface AdminUser extends Record<string, unknown> {
  id: number
  username: string
  display_name: string
  email: string
  role: AdminUserRole
  status: AdminUserStatus
  quota: number
  used_quota: number
  request_count: number
  invited_count: number
  affiliate_quota: number
  /** 0 = registered without an inviter. */
  inviter_id: number
  created_time: number
  /** 0 = never signed in. */
  last_login_time: number
}

export interface AdminUserCreateInput {
  username: string
  display_name: string
  email: string
  role: AdminUserRole
  status: AdminUserStatus
}

/** Status is owned by the dedicated toggle route, not by the edit form. */
export type AdminUserUpdateInput = Omit<AdminUserCreateInput, 'status'>

export interface AdminUserPage {
  items: AdminUser[]
  total: number
  page: number
  page_size: number
  role_counts: Record<string, number>
  status_counts: Record<string, number>
}

/* ---------------- administrator orders ---------------- */

/**
 * Payment lifecycle. `completed` is the only state a refund may act on;
 * `cancelled` and `expired` are both terminal unpaid outcomes, distinguished
 * because one is a user action and the other a gateway timeout.
 */
export type AdminOrderStatus =
  'completed' | 'pending' | 'cancelled' | 'expired' | 'refunded'

/** The three sellable paths in this console: wallet, plan, marketplace. */
export type AdminOrderType = 'topup' | 'subscription' | 'market'

/**
 * Alipay and WeChat are the two channels behind the wallet's `epay`
 * aggregator (see TopupRecord.method). Orders record the channel the payer
 * actually used, because that is what a revenue breakdown has to answer.
 */
export type AdminOrderMethod = 'alipay' | 'wechat' | 'stripe' | 'creem'

export type AdminOrderSortBy = 'id' | 'amount' | 'created'

export type AdminOrderSortOrder = 'asc' | 'desc'

/** Trailing window the statistics tab aggregates over, in days. */
export type AdminOrderRange = 7 | 30 | 90

export interface AdminOrder extends Record<string, unknown> {
  id: number
  /** Gateway trade number, e.g. `sub2_20260725RHcR5xPa`. */
  order_no: string
  user_id: number
  username: string
  email: string
  /** Amount actually paid, in USD. */
  amount: number
  /** Quota credited on completion. 0 for orders that never completed. */
  quota: number
  type: AdminOrderType
  method: AdminOrderMethod
  status: AdminOrderStatus
  /** Human-readable line item, e.g. `专业版 · 30 天`. */
  subject: string
  created: number
  /** 0 = never paid. */
  paid_at: number
  /** 0 = never refunded. */
  refunded_at: number
}

export interface AdminOrderPage {
  items: AdminOrder[]
  total: number
  page: number
  page_size: number
  status_counts: Record<string, number>
  method_counts: Record<string, number>
  type_counts: Record<string, number>
  /** Paid revenue across the whole filtered set, not just the page. */
  filtered_revenue: number
}

export interface AdminOrderDailyPoint {
  /** `YYYY-MM-DD`, local time. */
  date: string
  revenue: number
  orders: number
}

export interface AdminOrderMethodShare {
  method: AdminOrderMethod
  amount: number
  count: number
}

export interface AdminOrderSpender {
  user_id: number
  username: string
  email: string
  amount: number
  orders: number
}

export interface AdminOrderStats {
  range: AdminOrderRange
  /** Server clock when the window was aggregated. */
  generated_at: number
  today_revenue: number
  today_orders: number
  /** Revenue over the requested window, not all-time. */
  total_revenue: number
  total_orders: number
  /** Mean paid order value over the window; 0 when the window has no sales. */
  average_amount: number
  /**
   * Money collected and then returned. Held separately rather than netted into
   * `total_revenue`, so a refund never silently rewrites a past day's takings.
   */
  refunded_total: number
  refunded_orders: number
  daily: AdminOrderDailyPoint[]
  payment_share: AdminOrderMethodShare[]
  top_spenders: AdminOrderSpender[]
}

export type LogType =
  'consume' | 'topup' | 'refund' | 'manage' | 'error' | 'system'

export type LogRequestMode = 'stream' | 'sync'

export type LogOther = string | Record<string, unknown> | null

export interface LogItem {
  id: number
  type: LogType
  token_name: string // 使用的 API 令牌名称
  model: string
  channel: string // 渠道名称
  prompt_tokens: number
  completion_tokens: number
  /** Cache-token fields are optional until the production log API exposes them. */
  cache_read_tokens?: number | null
  cache_write_tokens?: number | null
  cache_ttl?: string | null
  /** Raw request metadata. Production logs currently expose this as JSON. */
  other?: LogOther
  /** Optional flattened metadata accepted by alternate API adapters. */
  reasoning_effort?: string | null
  fast_mode?: boolean | null
  service_tier?: string | null
  speed?: string | null
  quota: number
  latency: number // 延迟（秒）
  first_token_latency: number | null // 首字延迟（秒），仅流式请求适用
  request_mode: LogRequestMode | null // 非请求类日志为 null
  tps: number // tokens per second (0 表示不适用)
  content: string
  created: number
}

export interface TopupRecord {
  id: number
  trade_no: string
  amount: number // USD purchased
  money: number // quota credited
  method: 'epay' | 'stripe' | 'creem' | 'redeem'
  provider?: string
  payment_method?: string
  status: 'success' | 'pending' | 'failed'
  created: number
}

/* ------------------------------------------------------------------ */
/* plan catalogue — traffic packs and subscription packs                 */
/* ------------------------------------------------------------------ */

/**
 * Two sellable shapes, deliberately modelled as a discriminated union so a
 * traffic pack can never carry period fields and vice versa:
 *   traffic      — grants a fixed quota once, optionally expiring
 *   subscription — meters quota per period for the length of a term
 */
export type PlanKind = 'traffic' | 'subscription'

export type DurationUnit = 'hour' | 'day' | 'week' | 'month' | 'year' | 'custom'

/** A quantity of time. Rendered through formatDuration() for i18n plurals. */
export interface Duration {
  value: number
  unit: DurationUnit
}

/**
 * How a subscription's per-period allowance behaves:
 *   refill — each period grants `period_quota`; unused quota does not carry over
 *   cap    — each period allows at most `period_quota`; nothing is granted
 * The stored shape is identical; only settlement differs.
 */
export type SubscriptionMeter = 'refill' | 'cap'

/**
 * Plan accent colour. Semantic tokens follow the active theme; `custom` pins a
 * literal hex in both themes and is restricted to emphasis marks (never text or
 * surface fills) — see docs/THEMES.md.
 */
export interface PlanAccent {
  token: 'accent' | 'signal' | 'support' | 'custom'
  /** Required when token === 'custom'; normalized to #rrggbb on write. */
  hex?: string
}

interface PlanBase {
  id: number
  name: string
  price: number
  features: string[]
  accent: PlanAccent
  recommended?: boolean
  /**
   * Platform channel granted exclusively to holders, referencing
   * AdminChannel.id. null = no exclusive channel.
   */
  exclusive_channel_id: number | null
  /** Billing multiplier; replaces the retired per-group ratio. undefined = 1.0 */
  ratio?: number
  /** Whether the real backend permits wallet-balance purchase. */
  balance_pay_enabled?: boolean
}

export interface TrafficPlan extends PlanBase {
  kind: 'traffic'
  /** Granted once on purchase. */
  quota: number
  /** Validity of the granted quota; null = never expires. */
  validity: Duration | null
}

export interface SubscriptionPlan extends PlanBase {
  kind: 'subscription'
  /** Settlement period, e.g. { value: 1, unit: 'day' }. */
  period: Duration
  meter: SubscriptionMeter
  /** Granted per period when `refill`, allowed per period when `cap`. */
  period_quota: number
  /** Total subscription length, e.g. { value: 3, unit: 'month' }. */
  term: Duration
  /** Requests allowed per period; replaces the retired per-group RPM. */
  rate_limit?: number
}

export type Plan = TrafficPlan | SubscriptionPlan

/* ------------------------------------------------------------------ */
/* admin plan catalogue                                                 */
/* ------------------------------------------------------------------ */

/**
 * Shelf state of a plan:
 *   active   — purchasable, listed on the subscription page
 *   hidden   — delisted but still honoured for existing subscribers
 *   archived — retired; kept only so historical orders keep resolving a name
 */
export type AdminPlanStatus = 'active' | 'hidden' | 'archived'

/**
 * Sortable columns are deliberately kind-agnostic. A one-off quota and a
 * per-period allowance are not comparable, so the quota column renders per kind
 * but never sorts.
 */
export type AdminPlanSortBy = 'id' | 'price' | 'sort_order' | 'subscribers'

export type AdminPlanSortOrder = 'asc' | 'desc'

/** Admin-only bookkeeping layered onto either plan kind. */
export interface AdminPlanFields {
  status: AdminPlanStatus
  /** Ascending display weight on the subscription page. */
  sort_order: number
  /** Live subscriber count — read-only, owned by the billing side. */
  subscribers: number
  /** Lifetime revenue in USD, read-only. */
  revenue: number
  created_time: number
  updated_time: number
}

/**
 * The catalogue row behind a `Plan`. The storefront only ever receives the
 * `Plan` half of an `active` record, so shelf state and the commercial counters
 * stay admin-side. Intersecting (rather than extending) keeps the union
 * distributed, so each kind still satisfies DataTable's row constraint.
 */
export type AdminPlan = Plan & AdminPlanFields & Record<string, unknown>

export type AdminTrafficPlan = TrafficPlan &
  AdminPlanFields &
  Record<string, unknown>

export type AdminSubscriptionPlan = SubscriptionPlan &
  AdminPlanFields &
  Record<string, unknown>

export interface AdminPlanPage {
  items: AdminPlan[]
  total: number
  page: number
  page_size: number
  status_counts: Record<string, number>
  kind_counts: Record<string, number>
  /** Subscribers across the whole filtered set, not just the page. */
  filtered_subscribers: number
  /** Revenue across the whole filtered set, not just the page. */
  filtered_revenue: number
}

/** Fields shared by both kinds on create/update. */
interface AdminPlanInputBase {
  name: string
  price: number
  features: string[]
  accent: PlanAccent
  recommended: boolean
  exclusive_channel_id: number | null
  ratio?: number
  sort_order: number
}

export type AdminPlanCreateInput = AdminPlanInputBase &
  (
    | { kind: 'traffic'; quota: number; validity: Duration | null }
    | {
        kind: 'subscription'
        period: Duration
        meter: SubscriptionMeter
        period_quota: number
        term: Duration
        rate_limit?: number
      }
  ) & { status: AdminPlanStatus }

/**
 * Union-preserving Omit. The built-in `Omit` treats a union as a single object
 * and collapses the discriminant, which would let a caller mix a traffic
 * `quota` with a subscription `period`.
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

/** The create body minus shelf state — what both create and edit validate to. */
export type AdminPlanInput = DistributiveOmit<AdminPlanCreateInput, 'status'>

/**
 * Status is owned by the dedicated toggle route, not by the edit form. `kind` is
 * immutable after creation: switching it would leave existing holders pointing
 * at an entitlement shape their record cannot express.
 */
export type AdminPlanUpdateInput = DistributiveOmit<
  AdminPlanCreateInput,
  'status' | 'kind'
>

/* ---------------- model plaza (market) ---------------- */

export type MarketModelType =
  'chat' | 'image' | 'embedding' | 'rerank' | 'audio' | 'video'

export type MarketBilling = 'token' | 'per_call' | 'tiered'

export interface MarketPriceTier {
  label: string
  input: number
  output: number
}

export interface MarketModelPrice {
  input?: number // $ / 1M tokens
  output?: number // $ / 1M tokens
  cache_read?: number // $ / 1M tokens
  per_call?: number // $ / call
  tiers?: MarketPriceTier[] // tiered billing breakdown
}

export interface MarketModel {
  id: number
  name: string
  vendor: string
  type: MarketModelType
  billing: MarketBilling
  price: MarketModelPrice
  context: number // context window in tokens (0 = n/a)
  tagline: string
  latency: number // seconds, snapshot
  tps: number // tokens/s, snapshot (0 = n/a)
  health: number // 0-100 → drives the health meter + tone
  channels: string[]
}

export type InviteRecordStatus = 'valid' | 'pending' | 'invalid'

export interface InviteRecord {
  id: number
  invitee: string
  reward: number
  status: InviteRecordStatus
  created: number
}

export interface InviteQualification {
  token_used: number
  token_required: number
  topup_total: number
  topup_required: number
  qualified: boolean
}

export interface InviteUnlockChannel {
  id: string
  name: string
  detail: string
  unlocked: boolean
}

export interface InviteMonthPoint {
  month: string
  new_count: number
  cumulative: number
}

export interface InviteInfo {
  code: string
  invited: number
  rate: number // rebate ratio, e.g. 0.02 = 2%
  reward_total: number // lifetime reward quota earned
  transferable: number // reward quota available to move into balance
  pending_reward: number // reward quota awaiting settlement
  qualification: InviteQualification
  unlock_channels: InviteUnlockChannel[]
  monthly_series: InviteMonthPoint[]
  records: InviteRecord[]
}

/* ---------------- tickets (support ledger) ---------------- */

export type TicketStatus = 'open' | 'replied' | 'closed'

export type TicketCategory = 'billing' | 'api' | 'model' | 'account' | 'other'

export type TicketPriority = 'low' | 'normal' | 'high'

export type TicketRole = 'user' | 'support' | 'system'

// Which team a support reply comes from. Shown as the message author label;
// user messages carry no department (their name is intentionally hidden).
export type TicketDepartment = 'support' | 'tech' | 'finance' | 'legal'

export interface TicketMessage {
  id: number
  role: TicketRole
  // Only meaningful when role === 'support'; falls back to 'support' (客服).
  department?: TicketDepartment
  content: string
  images: string[]
  created: number
}

export interface TicketItem {
  id: number
  title: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  reply_count: number
  last_reply_role: 'user' | 'support'
  model_id?: string
  request_id?: string
  created: number
  updated: number
  messages: TicketMessage[]
}

/* ---------------- activity center ---------------- */

export type ActivityKind = 'checkin' | 'newcomer' | 'invite'

export type ActivityStatus = 'ongoing' | 'upcoming' | 'ended'

export type ActivityGradient = 'accent' | 'signal' | 'support'

export interface ActivityBase {
  id: number
  kind: ActivityKind
  title: string
  tagline: string
  status: ActivityStatus
  gradient: ActivityGradient
  badgeKey?: 'hot' | 'new' | 'ending'
  start: number // epoch seconds
  end: number // epoch seconds
  icon: string // 24×24 lucide path
}

export interface CheckinDay {
  done: boolean
  reward: number
}

export interface WeekEntry {
  date: string // "07/21"
  weekday: string // "MON" | "TUE" | ...
  reward: number // quota units; 0 = not claimed
  claimed: boolean
  today: boolean
}

export interface CheckinPayload {
  days: CheckinDay[]
  todayClaimed: boolean
  streak: number
  total_days: number
  month_days: number
  month_days_total: number
  total_reward: number
  month_reward: number
  best_streak: number
  week_entries: WeekEntry[]
}

export interface NewcomerTask {
  id: string
  labelKey: string
  reward: number
  done: boolean
}

export interface NewcomerPayload {
  tasks: NewcomerTask[]
  claimed: boolean
}

export interface InviteActivityPayload {
  invited: number
  reward_total: number
  rate: number
}

export type Activity = ActivityBase &
  (
    | { kind: 'checkin'; checkin: CheckinPayload }
    | { kind: 'newcomer'; newcomer: NewcomerPayload }
    | { kind: 'invite'; invite: InviteActivityPayload }
  )

export interface ActivitySummary {
  claimable: number
  reward_earned: number
  ongoing: number
}

/* ---------------- marketplace (channel-supply trading market) ---------------- */

/**
 * The "market" nav entry is a two-sided trading market (buy / sell), distinct
 * from the read-only Model Plaza (models). Merchants list channel-supply
 * offers; buyers browse, compare and add them. Base prices are stored in USD
 * and converted for display via USD_TO_CNY. qcScore is a 0–100 stability score.
 */
export type MarketSide = 'buy' | 'sell' | 'mine'

/**
 * Merchant scale tiers (ascending size): vendor(摊贩) < workshop(作坊) <
 * studio(工作室) < empire(夯可败国). `platform` is the official first-party
 * supply and sits outside the third-party ladder.
 */
export type MerchantScale =
  'platform' | 'vendor' | 'workshop' | 'studio' | 'empire'

export type ListingStatus = 'active' | 'reviewing' | 'delisted'

export type Currency = 'CNY' | 'USD'

export interface MerchantComment {
  id: number
  user: string
  content: string
  createdAt: number
}

export interface Merchant {
  id: number
  name: string
  scale: MerchantScale
  comments: MerchantComment[] // newest first
  channelCount: number
  joinedAt: number
  verified: boolean
}

export interface MarketListing {
  id: number
  merchantId: number
  title: string
  summary: string
  source: string // upstream channel the supply routes through
  availability: number // uptime %
  supportedModels: string[]
  qcScore: number // 0–100 stability score
  tags: string[]
  priceUSD: number // $ / 1M tokens (chat, embedding) or $ / call (image, audio, video)
  type: MarketModelType
  listedAt: number
  rating: number // 0–5 listing rating
  reviewCount: number
  status: ListingStatus
  ownerUid?: number // set when the listing belongs to the current user (sell side)
  earningsUSD?: number // cumulative seller earnings (sell side only)
  modelVendors: string[] // distinct AI vendors derived from supportedModels
  qcImages?: string[] // QC test screenshots attached under the QC score
}

/* ------------------------------------------------------------------ */
/* my channels — marketplace listings the user added to their account  */
/* ------------------------------------------------------------------ */

export type MyChannelStatus = 'active' | 'disabled'

export interface MyChannel {
  id: number
  listingId: number
  merchantId: number
  merchantName: string
  title: string // listing title, for display
  supportedModels: string[]
  status: MyChannelStatus
  addedAt: number
}

/* ------------------------------------------------------------------ */
/* invoices — online invoicing / fapiao requests                        */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = 'pending' | 'issued' | 'rejected'

export interface InvoiceItem {
  id: number
  title: string // 发票抬头（公司名或个人姓名）
  tax_id: string // 税号（企业填纳税人识别号，个人可留空）
  amount: number // 开票金额，单位：元（CNY）
  email: string // 接收发票的邮箱（可选）
  note: string // 备注
  status: InvoiceStatus
  pdf_url: string // 仅 issued 状态时非空
  reject_reason: string // 仅 rejected 状态时非空
  created: number
  updated: number
}
export type TokenSummary = Omit<TokenItem, 'key'> & {
  key_preview: string
}

/* ------------------------------------------------------------------ */
/* entitlements — what a caller actually holds                          */
/* ------------------------------------------------------------------ */

/** The exclusive channel resolved for display; absent once it is deleted. */
export interface EntitlementChannel {
  id: number
  name: string
}

/**
 * One purchased traffic pack. Held per grant rather than folded into the wallet
 * balance, because each grant expires on its own schedule.
 */
export interface TrafficEntitlement {
  id: number
  plan_id: number
  name: string
  total_quota: number
  remain_quota: number
  granted_at: number
  /** -1 = never expires. */
  expire_time: number
  accent: PlanAccent
  exclusive_channel?: EntitlementChannel
}

/** The caller's single active subscription, if any. */
export interface SubscriptionEntitlement {
  plan_id: number
  name: string
  meter: SubscriptionMeter
  period: Duration
  /** Granted (refill) or allowed (cap) within the current period. */
  period_quota: number
  period_used: number
  period_start: number
  period_end: number
  /** When the subscription itself lapses. */
  expire_time: number
  auto_renew: boolean
  rate_limit?: number
  accent: PlanAccent
  exclusive_channel?: EntitlementChannel
}

/** Full entitlement picture: at most one subscription, any number of packs. */
export interface EntitlementSummary {
  subscription: SubscriptionEntitlement | null
  traffic: TrafficEntitlement[]
}

/* ------------------------------------------------------------------ */
/* admin redemption codes                                               */
/* ------------------------------------------------------------------ */

/** Code type mirrors the backend redeem_type enum. */
export type AdminRedemptionType =
  | 'quota' // credit user balance
  | 'concurrency' // unlock extra concurrent request slots
  | 'subscription' // activate a plan
  | 'invite' // act as an invite code

/**
 * Four lifecycle states:
 *   unused   — never redeemed, within validity window
 *   used     — redeemed by exactly one user
 *   expired  — validity window has passed without being used
 *   disabled — manually deactivated by an admin
 */
export type AdminRedemptionStatus = 'unused' | 'used' | 'expired' | 'disabled'

export type AdminRedemptionSortBy = 'id' | 'created_time' | 'used_time'

export type AdminRedemptionSortOrder = 'asc' | 'desc'

export interface AdminRedemptionCode extends Record<string, unknown> {
  id: number
  name: string // display label (e.g. "$5.00", "claude", admin-set)
  code: string // raw code string (32-char hex in mock)
  type: AdminRedemptionType
  status: AdminRedemptionStatus
  // face-value fields — populated by type; others are undefined
  quota?: number // type=quota  : internal quota units
  amount?: number // type=quota  : display USD value
  concurrency?: number // type=concurrency : slot count
  plan_id?: number // type=subscription : plan id
  // redemption record
  redeemer_id: number // 0 = not yet redeemed
  redeemer_email: string // '' = not yet redeemed
  created_time: number // unix epoch seconds
  used_time: number // 0 = not yet redeemed
  expired_time: number // -1 = never
}

export interface AdminRedemptionPage {
  items: AdminRedemptionCode[]
  total: number
  page: number
  page_size: number
  type_counts: Record<string, number>
  status_counts: Record<string, number>
}

export interface AdminRedemptionCreateInput {
  type: AdminRedemptionType
  count: number // 1–100
  amount?: number // type=quota (USD dollars)
  concurrency?: number // type=concurrency
  plan_id?: number // type=subscription
  expired_time: number // -1 = never; future unix epoch = deadline
}
