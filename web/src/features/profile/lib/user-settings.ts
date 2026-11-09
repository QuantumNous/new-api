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
import { NOTIFICATION_METHODS } from '../constants'
import type { NotifyType, UpdateUserSettingsRequest } from '../types'
import { parseUserSettings } from './format'

/** Switches whose absence means "never chosen", which the server resolves */
type DefaultedSwitch = 'quota_warning_enabled' | 'channel_notify_enabled'

type NormalizedUserSettings = Required<
  Omit<UpdateUserSettingsRequest, DefaultedSwitch>
> &
  Pick<UpdateUserSettingsRequest, DefaultedSwitch> & { notify_type: NotifyType }

/**
 * Settings sent back on every save. A switch the user never chose stays
 * undefined, so the save leaves it unset and its default keeps applying. A
 * threshold of 0 means the site default.
 */
export function normalizeUserSettings(
  setting?: string
): NormalizedUserSettings {
  const parsed = parseUserSettings(setting)
  const notifyType =
    NOTIFICATION_METHODS.find((method) => method.value === parsed.notify_type)
      ?.value ?? 'email'
  return {
    notify_type: notifyType,
    quota_warning_threshold: parsed.quota_warning_threshold ?? 0,
    quota_warning_enabled: parsed.quota_warning_enabled,
    notification_email: parsed.notification_email ?? '',
    webhook_url: parsed.webhook_url ?? '',
    webhook_secret: parsed.webhook_secret ?? '',
    bark_url: parsed.bark_url ?? '',
    gotify_url: parsed.gotify_url ?? '',
    gotify_token: parsed.gotify_token ?? '',
    gotify_priority: parsed.gotify_priority ?? 5,
    accept_unset_model_ratio_model:
      parsed.accept_unset_model_ratio_model || false,
    record_ip_log: parsed.record_ip_log || false,
    upstream_model_update_notify_enabled:
      parsed.upstream_model_update_notify_enabled || false,
    channel_notify_enabled: parsed.channel_notify_enabled,
  }
}
