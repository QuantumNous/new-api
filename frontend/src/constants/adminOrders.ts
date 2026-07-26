import type {
  AdminOrder,
  AdminOrderMethod,
  AdminOrderRange,
  AdminOrderSortBy,
  AdminOrderStatus,
  AdminOrderType,
} from '@/types/console'

export const ADMIN_ORDER_STATUSES: readonly AdminOrderStatus[] = [
  'completed',
  'pending',
  'cancelled',
  'expired',
  'refunded',
]

export const ADMIN_ORDER_TYPES: readonly AdminOrderType[] = [
  'topup',
  'subscription',
  'market',
]

export const ADMIN_ORDER_METHODS: readonly AdminOrderMethod[] = [
  'alipay',
  'wechat',
  'stripe',
  'creem',
]

export const ADMIN_ORDER_SORT_FIELDS: readonly AdminOrderSortBy[] = [
  'id',
  'amount',
  'created',
]

/** Trailing windows offered by the statistics tab, in days. */
export const ADMIN_ORDER_RANGES: readonly AdminOrderRange[] = [7, 30, 90]

export const ADMIN_ORDER_DEFAULT_RANGE: AdminOrderRange = 30

export function isAdminOrderRange(value: unknown): value is AdminOrderRange {
  return ADMIN_ORDER_RANGES.includes(Number(value) as AdminOrderRange)
}

/**
 * Status → StatusChip tone. `cancelled` and `expired` both resolve to neutral
 * because neither is a fault worth colouring — they are simply orders that
 * never became revenue.
 */
export function adminOrderStatusTone(
  status: AdminOrderStatus
): 'success' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'pending':
      return 'warning'
    case 'refunded':
      return 'info'
    default:
      return 'neutral'
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

/**
 * Only a completed order can be refunded. Every other state either never took
 * money (pending/cancelled/expired) or already gave it back (refunded).
 *
 * UI affordance only — the server must reject the same cases independently.
 */
export function canRefundAdminOrder(
  order: Pick<AdminOrder, 'status'>
): boolean {
  return order.status === 'completed'
}

/**
 * Podium colours for the spender ranking. Beyond third place the row carries
 * no accent, so the top three stay readable at a glance.
 *
 * Every pairing below was measured against WCAG AA for normal-size text (the
 * badge is 12px, so 4.5:1 applies, not the 3:1 large-text allowance):
 *
 *   1  --accent        + --accent-contrast   4.74 light / 9.56 dark
 *   2  --signal-strong + --on-colored        5.96 light / 7.11 dark
 *   3  --support       + --accent-contrast   5.57 light / 8.71 dark
 *
 * Rank 2 deliberately uses `--signal-strong` rather than `--signal`: the plain
 * token pairs with `--on-colored` at only 4.18 light / 2.96 dark, failing in
 * both themes. Rank 3 pairs `--support` with `--accent-contrast` for the same
 * reason — `--support` shifts hue across themes (gold → pink) but stays light
 * in both, so it needs dark text, not `--on-colored` (1.70 in dark).
 */
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
