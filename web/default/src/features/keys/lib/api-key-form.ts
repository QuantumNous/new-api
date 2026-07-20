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
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { DEFAULT_GROUP } from '../constants'
import { type ApiKeyFormData, type ApiKey } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const apiKeyFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    remain_quota_dollars: z.number().optional(),
    expired_time: z.date().optional(),
    unlimited_quota: z.boolean(),
    model_limits: z.array(z.string()),
    allow_ips: z.string().optional(),
    group: z.string().optional(),
    cross_group_retry: z.boolean().optional(),
    tokenCount: z.number().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    // remain_quota_dollars is only relevant (and shown) when quota isn't
    // unlimited. A key can carry a stale negative balance (e.g. overspend)
    // while unlimited_quota is on; don't block saving on that hidden value.
    if (
      !data.unlimited_quota &&
      data.remain_quota_dollars !== undefined &&
      data.remain_quota_dollars < 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Too small: expected number to be >=0',
        path: ['remain_quota_dollars'],
      })
    }
  })

export type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>

// ============================================================================
// Form Defaults
// ============================================================================

export const API_KEY_FORM_DEFAULT_VALUES: ApiKeyFormValues = {
  name: '',
  remain_quota_dollars: 10,
  expired_time: undefined,
  unlimited_quota: true,
  model_limits: [],
  allow_ips: '',
  group: DEFAULT_GROUP,
  cross_group_retry: true,
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean,
  preferredGroup?: string
): ApiKeyFormValues {
  // apimaster: ignore defaultUseAutoGroup; we always default to auto-cheapest
  // (newapi's "auto" cross-group routing isn't useful when apimaster only ships
  // a single meaningful group). cross_group_retry kept for behavioural parity.
  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group: preferredGroup || DEFAULT_GROUP,
    cross_group_retry: defaultUseAutoGroup,
  }
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: ApiKeyFormValues
): ApiKeyFormData {
  return {
    name: data.name,
    remain_quota: data.unlimited_quota
      ? 0
      : parseQuotaFromDollars(data.remain_quota_dollars || 0),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : -1,
    unlimited_quota: data.unlimited_quota,
    model_limits_enabled: data.model_limits.length > 0,
    model_limits: data.model_limits.join(','),
    allow_ips: data.allow_ips || '',
    group: data.group || '',
    cross_group_retry: data.group === 'auto' ? !!data.cross_group_retry : false,
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
    remain_quota_dollars: quotaUnitsToDollars(apiKey.remain_quota),
    expired_time:
      apiKey.expired_time > 0
        ? new Date(apiKey.expired_time * 1000)
        : undefined,
    unlimited_quota: apiKey.unlimited_quota,
    model_limits: apiKey.model_limits
      ? apiKey.model_limits.split(',').filter(Boolean)
      : [],
    allow_ips: apiKey.allow_ips || '',
    group: apiKey.group || DEFAULT_GROUP,
    cross_group_retry: !!apiKey.cross_group_retry,
    tokenCount: 1,
  }
}
