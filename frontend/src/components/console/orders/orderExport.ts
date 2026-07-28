import type { AdminOrder } from '@/types/console'
import { formatTime } from '@/utils/format'

/**
 * Export column order, mirroring `log-ui/logExport.ts`. Amounts ship as bare
 * numbers rather than `$`-prefixed strings so a spreadsheet can sum them; the
 * `_usd` suffix names the unit instead. Timestamps ship formatted, because an
 * epoch integer is unreadable in the one place this file gets opened.
 */
export const ORDER_EXPORT_HEADERS = [
  'id',
  'order_no',
  'username',
  'email',
  'subject',
  'type',
  'method',
  'status',
  'amount_usd',
  'quota',
  'created',
  'paid_at',
  'refunded_at',
] as const

/** `0` stamps mean "never happened", so they export blank, not `1970-01-01`. */
function stampOrBlank(epochSec: number): string {
  return epochSec > 0 ? formatTime(epochSec) : ''
}

export function getOrderExportValues(
  order: AdminOrder
): Array<string | number> {
  return [
    order.id,
    order.order_no,
    order.username,
    order.email,
    order.subject,
    order.type,
    order.method,
    order.status,
    order.amount,
    order.quota,
    formatTime(order.created),
    stampOrBlank(order.paid_at),
    stampOrBlank(order.refunded_at),
  ]
}
