// ============================================================================
// Profile Constants
// ============================================================================

/**
 * Default quota warning threshold (percentage)
 */
export const DEFAULT_QUOTA_WARNING_THRESHOLD = 20

/**
 * Notification methods
 */
export const NOTIFICATION_METHODS = [
  { value: 'email' as const, label: 'Email' },
  { value: 'webhook' as const, label: 'Webhook' },
  { value: 'bark' as const, label: 'Bark' },
  { value: 'gotify' as const, label: 'Gotify' },
  { value: 'feishu_app' as const, label: 'Feishu App Bot' },
] as const
