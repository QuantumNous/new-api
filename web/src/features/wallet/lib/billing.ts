import type { TopupStatus } from '../types'

// ============================================================================
// Billing Utility Functions
// ============================================================================

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface StatusConfig {
  variant: BadgeVariant
  label: string
}

/**
 * Status badge configuration
 */
export const STATUS_CONFIG: Record<TopupStatus, StatusConfig> = {
  success: {
    variant: 'default',
    label: 'Success',
  },
  pending: {
    variant: 'secondary',
    label: 'Pending',
  },
  expired: {
    variant: 'destructive',
    label: 'Expired',
  },
}

/**
 * Get status badge configuration
 */
export function getStatusConfig(status: TopupStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending
}

/**
 * Payment method display names
 */
export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(method: string): string {
  return PAYMENT_METHOD_NAMES[method] || method
}

/**
 * Format timestamp to readable date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}
