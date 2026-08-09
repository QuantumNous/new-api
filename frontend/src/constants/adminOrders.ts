import type {
  AdminOrderCurrency,
  AdminOrderMethod,
  AdminOrderPaymentRail,
  AdminOrderRange,
  AdminOrderSortBy,
  AdminOrderStatus,
  AdminOrderType,
} from '@/types/console'

export const ADMIN_ORDER_STATUSES: readonly AdminOrderStatus[] = [
  'completed',
  'pending',
  'failed',
]

export const ADMIN_ORDER_TYPES: readonly AdminOrderType[] = ['topup']

export const ADMIN_ORDER_METHODS: readonly AdminOrderMethod[] = [
  'epay',
  'stripe',
  'creem',
  'waffo',
  'waffo_pancake',
  'balance',
  'other',
]

export const ADMIN_ORDER_SORT_FIELDS: readonly AdminOrderSortBy[] = [
  'id',
  'amount',
  'created',
]

export const ADMIN_ORDER_RANGES: readonly AdminOrderRange[] = [7, 30, 90]

export const ADMIN_ORDER_DEFAULT_RANGE: AdminOrderRange = 30

export function isAdminOrderRange(value: unknown): value is AdminOrderRange {
  return ADMIN_ORDER_RANGES.includes(Number(value) as AdminOrderRange)
}

export function adminOrderStatusTone(
  status: AdminOrderStatus
): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'pending':
      return 'warning'
    case 'failed':
      return 'danger'
  }
}

export function adminOrderStatusLabelKey(status: AdminOrderStatus): string {
  return `orders.status.${status}`
}

export function adminOrderTypeLabelKey(type: AdminOrderType): string {
  return `orders.type.${type}`
}

export function adminOrderMethodLabelKey(method: AdminOrderMethod): string {
  return `orders.method.${method}`
}

export function adminOrderPaymentRailLabelKey(
  method: AdminOrderPaymentRail
): string {
  return `orders.paymentRail.${method}`
}

export function isAdminOrderPaymentRail(
  value: string
): value is AdminOrderPaymentRail {
  return value === 'alipay' || value === 'wechat' || value === 'other'
}

export function formatAdminOrderAmount(
  amount: number,
  currency: AdminOrderCurrency
): string {
  const symbol = currency === 'CNY' ? '¥' : '$'
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function adminOrderRankStyle(rank: number): {
  background: string
  color: string
} {
  switch (rank) {
    case 1:
      return { background: 'var(--accent)', color: 'var(--accent-contrast)' }
    case 2:
      return {
        background: 'var(--signal-strong)',
        color: 'var(--on-colored)',
      }
    case 3:
      return { background: 'var(--support)', color: 'var(--accent-contrast)' }
    default:
      return {
        background: 'var(--surface-muted)',
        color: 'var(--text-tertiary)',
      }
  }
}
