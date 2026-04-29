import { type ManageUserAction } from '../types'

// ============================================================================
// User Action Messages
// ============================================================================

const ACTION_MESSAGES: Record<ManageUserAction, string> = {
  enable: 'User enabled successfully',
  disable: 'User disabled successfully',
  promote: 'User promoted to admin successfully',
  demote: 'User demoted to regular user successfully',
  delete: 'User deleted successfully',
  add_quota: 'Quota adjusted successfully',
}

/**
 * Get success message for user management action
 */
export function getUserActionMessage(action: ManageUserAction): string {
  return ACTION_MESSAGES[action]
}
