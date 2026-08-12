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
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { DEFAULT_GROUP, PLG_GROUP } from '../constants'
import { type ApiKeyFormData, type ApiKey } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export function getApiKeyFormSchema(t: TFunction) {
  return z
    .object({
      name: z.string().min(1, t('Please enter a name')),
      remain_quota_dollars: z.number().optional(),
      expired_time: z.date().optional(),
      unlimited_quota: z.boolean(),
      model_limits_enabled: z.boolean(),
      model_limits: z.array(z.string()),
      model_blacklist_enabled: z.boolean(),
      model_blacklist: z.array(z.string()),
      allow_ips: z.string().optional(),
      group: z.string().optional(),
      cross_group_retry: z.boolean().optional(),
      tokenCount: z.number().min(1).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.unlimited_quota) {
        return
      }

      if (
        data.remain_quota_dollars === undefined ||
        data.remain_quota_dollars < 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['remain_quota_dollars'],
          message: t('Quota must be zero or greater'),
        })
      }
    })
}

export type ApiKeyFormValues = z.infer<ReturnType<typeof getApiKeyFormSchema>>

// ============================================================================
// Form Defaults
// ============================================================================

export const API_KEY_FORM_DEFAULT_VALUES: ApiKeyFormValues = {
  name: '',
  remain_quota_dollars: 10,
  expired_time: undefined,
  unlimited_quota: true,
  model_limits_enabled: false,
  model_limits: [],
  model_blacklist_enabled: false,
  model_blacklist: [],
  allow_ips: '',
  group: DEFAULT_GROUP,
  cross_group_retry: true,
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean,
  createDefaultScope?: string | null
): ApiKeyFormValues {
  let group: string
  if (createDefaultScope === undefined) {
    group = defaultUseAutoGroup ? 'auto' : DEFAULT_GROUP
  } else {
    group = createDefaultScope ?? ''
  }

  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group,
    cross_group_retry: group === 'auto',
  }
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 *
 * PLG users have the group concept hidden; their keys are always forced to the `plg`
 * group (cross-group retry never applies).
 */
export function transformFormDataToPayload(
  data: ApiKeyFormValues,
  canUseGroups = true
): ApiKeyFormData {
  const group = canUseGroups ? data.group || '' : PLG_GROUP
  return {
    name: data.name,
    remain_quota: data.unlimited_quota
      ? 0
      : parseQuotaFromDollars(data.remain_quota_dollars || 0),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : -1,
    unlimited_quota: data.unlimited_quota,
    model_limits_enabled: data.model_limits_enabled,
    model_limits: data.model_limits.join(','),
    model_blacklist_enabled: data.model_blacklist_enabled,
    model_blacklist: data.model_blacklist.join(','),
    allow_ips: data.allow_ips || '',
    group,
    cross_group_retry: group === 'auto' ? !!data.cross_group_retry : false,
  }
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey
): ApiKeyFormValues {
  return {
    name: apiKey.name,
    remain_quota_dollars: apiKey.unlimited_quota
      ? 0
      : quotaUnitsToDollars(apiKey.remain_quota),
    expired_time:
      apiKey.expired_time > 0
        ? new Date(apiKey.expired_time * 1000)
        : undefined,
    unlimited_quota: apiKey.unlimited_quota,
    model_limits_enabled: apiKey.model_limits_enabled,
    model_limits: apiKey.model_limits
      ? apiKey.model_limits.split(',').filter(Boolean)
      : [],
    model_blacklist_enabled: apiKey.model_blacklist_enabled,
    model_blacklist: apiKey.model_blacklist
      ? apiKey.model_blacklist.split(',').filter(Boolean)
      : [],
    allow_ips: apiKey.allow_ips || '',
    group: apiKey.group ?? '',
    cross_group_retry: !!apiKey.cross_group_retry,
    tokenCount: 1,
  }
}
