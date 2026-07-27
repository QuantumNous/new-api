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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import type { ApiKey, ApiKeyFormData } from '../types'

export const SYSTEM_ROUTING_VALUE = '__system_routing__'
export const MAX_GROUP_CANDIDATES = 8

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
      model_limits: z.array(z.string()),
      allow_ips: z.string().optional(),
      group_candidates: z
        .array(z.string())
        .min(1, t('Select at least one group'))
        .max(
          MAX_GROUP_CANDIDATES,
          t('Select no more than {{count}} groups', {
            count: MAX_GROUP_CANDIDATES,
          })
        )
        .refine(
          (groups) => new Set(groups).size === groups.length,
          t('The same group cannot be selected more than once')
        )
        .refine(
          (groups) =>
            !groups.includes('auto') &&
            (!groups.includes(SYSTEM_ROUTING_VALUE) || groups.length === 1),
          t('System routing must be used on its own')
        ),
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
  model_limits: [],
  allow_ips: '',
  group_candidates: [],
  cross_group_retry: false,
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(): ApiKeyFormValues {
  return { ...API_KEY_FORM_DEFAULT_VALUES }
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
  const groups = data.group_candidates
  const usesSystemRouting = groups[0] === SYSTEM_ROUTING_VALUE
  const usesOrderedGroups = groups.length > 1
  let group = groups[0] || ''
  if (usesSystemRouting || usesOrderedGroups) {
    group = 'auto'
  }

  let groupCandidates: string[] | undefined = groups
  if (usesSystemRouting) {
    groupCandidates = []
  }

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
    group,
    group_candidates: groupCandidates,
    cross_group_retry:
      usesSystemRouting || usesOrderedGroups ? !!data.cross_group_retry : false,
  }
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey,
  defaultGroup = ''
): ApiKeyFormValues {
  let groups = apiKey.group_candidates
  if (groups.length === 0) {
    if (apiKey.group === 'auto') {
      groups = [SYSTEM_ROUTING_VALUE]
    } else if (apiKey.group) {
      groups = [apiKey.group]
    } else if (defaultGroup) {
      groups = [defaultGroup]
    }
  }

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
    model_limits: apiKey.model_limits
      ? apiKey.model_limits.split(',').filter(Boolean)
      : [],
    allow_ips: apiKey.allow_ips || '',
    group_candidates: groups,
    cross_group_retry: !!apiKey.cross_group_retry,
    tokenCount: 1,
  }
}
