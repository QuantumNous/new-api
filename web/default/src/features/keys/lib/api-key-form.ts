import { z } from 'zod'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { DEFAULT_GROUP } from '../constants'
import {
  type ApiKeyFormData,
  type ApiKey,
  type TokenEntitlementAssignment,
} from '../types'

// ============================================================================
// Form Schema
// ============================================================================

export const apiKeyFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  remain_quota_dollars: z.number().min(0).optional(),
  expired_time: z.date().optional(),
  unlimited_quota: z.boolean(),
  model_limits: z.array(z.string()),
  allow_ips: z.string().optional(),
  group: z.string().optional(),
  cross_group_retry: z.boolean().optional(),
  entitlement_package_ids: z.array(z.string()),
  tokenCount: z.number().min(1).optional(),
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
  entitlement_package_ids: [],
  tokenCount: 1,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean
): ApiKeyFormValues {
  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group: defaultUseAutoGroup ? 'auto' : DEFAULT_GROUP,
    cross_group_retry: defaultUseAutoGroup,
  }
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
type ApiKeyPayloadOptions = {
  includeEntitlementPackageIds?: boolean
}

export function transformFormDataToPayload(
  data: ApiKeyFormValues,
  options: ApiKeyPayloadOptions = {}
): ApiKeyFormData {
  const payload: ApiKeyFormData = {
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

  if (options.includeEntitlementPackageIds !== false) {
    payload.entitlement_package_ids = [
      ...new Set(
        data.entitlement_package_ids
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0)
      ),
    ]
  }

  return payload
}

export function getActiveEntitlementPackageIds(
  assignments: TokenEntitlementAssignment[]
): number[] {
  return [
    ...new Set(
      assignments
        .filter((item) => item.status === 1)
        .map((item) => item.package_id)
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ]
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey,
  entitlementPackageIds: number[] = []
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
    entitlement_package_ids: entitlementPackageIds.map(String),
    tokenCount: 1,
  }
}
