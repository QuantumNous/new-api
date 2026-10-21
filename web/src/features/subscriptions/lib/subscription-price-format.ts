import { formatLocalCurrencyAmount } from '@/lib/currency'

export function formatSubscriptionPlanPrice(value: number) {
  return formatLocalCurrencyAmount(Number(value || 0))
}
