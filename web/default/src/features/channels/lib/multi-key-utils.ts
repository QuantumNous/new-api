import {
  MULTI_KEY_STATUS_CONFIG,
  MULTI_KEY_CONFIRM_MESSAGES,
} from '../constants'
import type { MultiKeyConfirmAction } from '../types'

/**
 * Get status badge configuration for multi-key status
 */
export function getMultiKeyStatusConfig(status: number) {
  return (
    MULTI_KEY_STATUS_CONFIG[status as keyof typeof MULTI_KEY_STATUS_CONFIG] || {
      variant: 'neutral' as const,
      label: 'Unknown',
    }
  )
}

/**
 * Get confirmation message for multi-key action
 */
export function getMultiKeyConfirmMessage(
  action: MultiKeyConfirmAction | null
): string {
  if (!action) return ''

  switch (action.type) {
    case 'delete':
      return MULTI_KEY_CONFIRM_MESSAGES.DELETE
    case 'enable':
      return MULTI_KEY_CONFIRM_MESSAGES.ENABLE
    case 'disable':
      return MULTI_KEY_CONFIRM_MESSAGES.DISABLE
    case 'enable-all':
      return MULTI_KEY_CONFIRM_MESSAGES.ENABLE_ALL
    case 'disable-all':
      return MULTI_KEY_CONFIRM_MESSAGES.DISABLE_ALL
    case 'delete-disabled':
      return MULTI_KEY_CONFIRM_MESSAGES.DELETE_DISABLED
    default:
      return ''
  }
}

/**
 * Check if action is destructive
 */
export function isDestructiveAction(
  action: MultiKeyConfirmAction | null
): boolean {
  if (!action) return false
  return (
    action.type === 'delete' ||
    action.type === 'delete-disabled' ||
    action.type === 'disable-all'
  )
}
