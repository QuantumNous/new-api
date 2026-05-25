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
// ============================================================================
// Profile Constants
// ============================================================================

/**
 * Default quota warning threshold (500,000 = $1)
 */
export const DEFAULT_QUOTA_WARNING_THRESHOLD = 500000

/**
 * Notification methods
 */
export const NOTIFICATION_METHODS = [
  { value: 'email' as const, label: 'Email' },
  { value: 'webhook' as const, label: 'Webhook' },
  { value: 'bark' as const, label: 'Bark' },
  { value: 'gotify' as const, label: 'Gotify' },
] as const

/** Demo UI: only email is shown; other methods remain in settings payload. */
export const UI_VISIBLE_NOTIFICATION_METHODS = NOTIFICATION_METHODS.filter(
  (method) => method.value === 'email'
)

/** Demo UI: hide third-party OAuth bindings on the account profile page. */
export const PROFILE_THIRD_PARTY_BINDINGS_VISIBLE = false

const UI_HIDDEN_NOTIFY_TYPES = new Set(['webhook', 'bark', 'gotify'])

/** Map stored notify_type to the method shown in the demo UI (email only). */
export function normalizeNotifyTypeForUi(
  notifyType?: (typeof NOTIFICATION_METHODS)[number]['value']
): 'email' {
  if (!notifyType || UI_HIDDEN_NOTIFY_TYPES.has(notifyType)) {
    return 'email'
  }
  return 'email'
}
