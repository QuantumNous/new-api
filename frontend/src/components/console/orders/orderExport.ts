import type { AdminOrder } from '@/types/console'
import { formatTime } from '@/utils/format'

export const ORDER_EXPORT_HEADERS = [
  'id',
  'order_no',
  'username',
  'email',
  'type',
  'payment_provider',
  'payment_method',
  'status',
  'amount',
  'currency',
  'quota',
  'created',
  'paid_at',
] as const

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
    order.type,
    order.method,
    order.payment_method,
    order.status,
    order.amount,
    order.currency,
    order.quota,
    formatTime(order.created),
    stampOrBlank(order.paid_at),
  ]
}
