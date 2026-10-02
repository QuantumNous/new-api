/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { isPersianIntlLocale } from '@/i18n/languages'

import type { ManageUserAction } from '../types'

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

const ACTION_LABEL_KEYS: Record<string, string> = {
  enable: 'Enable',
  disable: 'Disable',
  promote: 'Promote',
  demote: 'Demote',
  delete: 'Delete',
}

/**
 * How a user management action is named inside a message ("Failed to
 * {{action}} user", the audit summary): its translated button label in
 * Persian, the recorded action (enable, promote …) in every other language,
 * as upstream shows it. Unknown actions stay as recorded.
 */
export function userActionName(
  action: string,
  t: (key: string) => string,
  locale?: string
): string {
  const labelKey = ACTION_LABEL_KEYS[action]
  if (!labelKey || !isPersianIntlLocale(locale)) return action
  return t(labelKey)
}
