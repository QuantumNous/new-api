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

import { DEFAULT_GROUP } from '../constants'
import type { ApiKey, ApiKeyFormData } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export function getApiKeyFormSchema(t: TFunction, maxAutoGroups = 5) {
  const autoGroupLimit =
    Number.isInteger(maxAutoGroups) && maxAutoGroups > 0 ? maxAutoGroups : 5

  return z
    .object({
      name: z.string().min(1, t('Please enter a name')),
      remain_quota_dollars: z.number().optional(),
      expired_time: z.date().optional(),
      unlimited_quota: z.boolean(),
      model_limits: z.array(z.string()),
      allow_ips: z.string().optional(),
      group: z.string().optional(),
      auto_groups_mode: z.enum(['inherit', 'custom']),
      auto_groups: z.array(z.string()),
      // 有序分组列表（openLUX group_ids 对齐）：非智能路由且非 auto 分组时生效
      group_order: z.array(z.string()),
      cross_group_retry: z.boolean().optional(),
      routing_priority: z.string().optional(),
      tokenCount: z.number().min(1).optional(),
    })
    .superRefine((data, ctx) => {
      // 智能路由模式下忽略指定分组，不做 auto_groups 校验；quota 校验对所有模式生效
      if (!data.routing_priority && data.group === 'auto') {
        if (
          data.auto_groups_mode === 'custom' &&
          data.auto_groups.length === 0
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['auto_groups'],
            message: t(
              'Select at least one Auto group or restore global Auto.'
            ),
          })
        }

        if (data.auto_groups.length > autoGroupLimit) {
          ctx.addIssue({
            code: 'custom',
            path: ['auto_groups'],
            message: t('Select at most {{max}} Auto groups', {
              max: autoGroupLimit,
            }),
          })
        }

        if (new Set(data.auto_groups).size !== data.auto_groups.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['auto_groups'],
            message: t('Auto groups must not contain duplicates'),
          })
        }
      }

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
  group: DEFAULT_GROUP,
  auto_groups_mode: 'inherit',
  auto_groups: [],
  group_order: [],
  cross_group_retry: true,
  routing_priority: '',
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean
): ApiKeyFormValues {
  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group: defaultUseAutoGroup ? 'auto' : DEFAULT_GROUP,
    auto_groups_mode: 'inherit',
    auto_groups: [],
    cross_group_retry: defaultUseAutoGroup,
    routing_priority: '',
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
  // 二选一：智能路由忽略指定分组，强制 group=auto + 跨分组重试
  const isSmartRouting = !!data.routing_priority
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
    group: isSmartRouting ? 'auto' : data.group || '',
    auto_groups: isSmartRouting
      ? []
      : data.group === 'auto' && data.auto_groups_mode === 'custom'
        ? data.auto_groups
        : [],
    // 有序分组列表（openLUX group_ids）：非智能路由且非 auto 分组时生效
    group_order:
      isSmartRouting || data.group === 'auto'
        ? ''
        : (data.group_order || []).join(','),
    cross_group_retry: isSmartRouting
      ? true
      : data.group === 'auto'
        ? !!data.cross_group_retry
        : false,
    routing_priority: isSmartRouting ? data.routing_priority || '' : '',
    // 开启智能路由时把原分组带给后端存为 manual_group，切回手动时恢复
    manual_group: isSmartRouting ? data.group || '' : '',
  }
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey,
  availableAutoGroups: string[] = [],
  maxAutoGroups = 5
): ApiKeyFormValues {
  const availableSet = new Set(availableAutoGroups)
  const storedAutoGroups = apiKey.auto_groups ?? []
  const autoGroups = storedAutoGroups
    .filter((group) => availableSet.has(group))
    .slice(0, Math.max(0, maxAutoGroups))
  const autoGroupsMode = storedAutoGroups.length > 0 ? 'custom' : 'inherit'

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
    // 智能路由令牌的 group 在库里是 "auto"，用 manual_group 恢复原分组显示，
    // 这样关闭开关时表单提交的 group 就是原分组，不会丢失。
    group:
      apiKey.group === 'auto' && apiKey.manual_group
        ? apiKey.manual_group
        : apiKey.group || DEFAULT_GROUP,
    auto_groups_mode: autoGroupsMode,
    auto_groups: autoGroups,
    group_order: apiKey.group_order
      ? apiKey.group_order.split(',').filter(Boolean)
      : [],
    cross_group_retry: !!apiKey.cross_group_retry,
    routing_priority: apiKey.routing_priority || '',
    tokenCount: 1,
  }
}
