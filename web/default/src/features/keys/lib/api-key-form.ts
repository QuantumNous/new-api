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

export const SIMPLE_PURPOSE_IDS = [
  'chat',
  'coding',
  'image',
  'video',
  'voice',
  'all',
] as const

export const SIMPLE_BRANDS = [
  'claude',
  'openai',
  'gemini',
  'deepseek',
] as const

export const SIMPLE_PRICE_TIERS = [
  'economy',
  'standard',
  'premium',
  'ultra',
] as const

export const apiKeyFormSchema = z
  .object({
    name: z.string().optional(),
    remain_quota_dollars: z.number().min(0).optional(),
    expired_time: z.date().optional(),
    unlimited_quota: z.boolean(),
    model_limits: z.array(z.string()),
    allow_ips: z.string().optional(),
    group: z.string().optional(),
    cross_group_retry: z.boolean().optional(),
    tokenCount: z.number().min(1).optional(),
    // Simple-mode bindings — see PRD §3.2. When mode='simple' the picker
    // populates these; backend derives model_limits from the purpose's
    // whitelist automatically, so the user never sees model names.
    mode: z.enum(['simple', 'advanced']),
    simple_purpose: z.enum(SIMPLE_PURPOSE_IDS).optional(),
    simple_brand: z.enum(SIMPLE_BRANDS).optional(),
    simple_price_tier: z.enum(SIMPLE_PRICE_TIERS).optional(),
    // DR-13: per-token rate limits (0 = unlimited)
    rpm_limit: z.number().min(0).optional(),
    tpm_limit: z.number().min(0).optional(),
    monthly_limit: z.number().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'simple') {
      if (!data.simple_purpose) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['simple_purpose'],
          message: 'Please choose what you will use this key for',
        })
      }
      if (data.simple_purpose === 'all' && !data.simple_price_tier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['simple_price_tier'],
          message: 'Please choose a price tier for Auto mode',
        })
      }
    } else {
      if (!data.name || data.name.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['name'],
          message: 'Name is required',
        })
      }
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
  mode: 'simple',
  simple_purpose: undefined,
  simple_brand: undefined,
  simple_price_tier: undefined,
  rpm_limit: 0,
  tpm_limit: 0,
  monthly_limit: 0,
}

export function getApiKeyFormDefaultValues(
  defaultUseAutoGroup: boolean,
  mode: 'simple' | 'advanced' = 'simple'
): ApiKeyFormValues {
  return {
    ...API_KEY_FORM_DEFAULT_VALUES,
    group: defaultUseAutoGroup ? 'auto' : DEFAULT_GROUP,
    cross_group_retry: defaultUseAutoGroup,
    mode,
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
  const isSimple = data.mode === 'simple'
  return {
    // Auto-name Simple keys so users don't have to invent one.
    name:
      data.name && data.name.trim() !== ''
        ? data.name
        : isSimple && data.simple_purpose
          ? `my-${data.simple_purpose}-key`
          : (data.name ?? ''),
    remain_quota: data.unlimited_quota
      ? 0
      : parseQuotaFromDollars(data.remain_quota_dollars || 0),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : -1,
    unlimited_quota: data.unlimited_quota,
    // In Simple mode the backend derives model_limits from the purpose's
    // whitelist — frontend sends empty so backend owns it.
    model_limits_enabled: isSimple ? false : data.model_limits.length > 0,
    model_limits: isSimple ? '' : data.model_limits.join(','),
    allow_ips: data.allow_ips || '',
    group: data.group || '',
    cross_group_retry: data.group === 'auto' ? !!data.cross_group_retry : false,
    simple_purpose: isSimple ? data.simple_purpose : '',
    simple_brand: isSimple ? data.simple_brand : '',
    simple_price_tier: isSimple ? data.simple_price_tier : '',
    rpm_limit: data.rpm_limit ?? 0,
    tpm_limit: data.tpm_limit ?? 0,
    monthly_limit: data.monthly_limit ?? 0,
  }
}

/**
 * Transform API key data to form defaults
 */
export function transformApiKeyToFormDefaults(
  apiKey: ApiKey
): ApiKeyFormValues {
  const purpose = (apiKey.simple_purpose || '') as ApiKeyFormValues['simple_purpose']
  const brand = (apiKey.simple_brand || '') as ApiKeyFormValues['simple_brand']
  const tier = (apiKey.simple_price_tier || '') as ApiKeyFormValues['simple_price_tier']
  // A token created in Simple mode opens in Simple mode for edit, so user
  // sees the same picker; switching to Advanced reveals the derived
  // model_limits and lets them customise freely.
  const mode: 'simple' | 'advanced' = purpose ? 'simple' : 'advanced'
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
    mode,
    simple_purpose: purpose || undefined,
    simple_brand: brand || undefined,
    simple_price_tier: tier || undefined,
    rpm_limit: apiKey.rpm_limit ?? 0,
    tpm_limit: apiKey.tpm_limit ?? 0,
    monthly_limit: apiKey.monthly_limit ?? 0,
  }
}

// ============================================================================
// Simple / Advanced mode (DeepRouter UX)
// ============================================================================

export type CreateMode = 'simple' | 'advanced'

/**
 * Simple-mode fields: name, expired_time, unlimited_quota, remain_quota_dollars.
 * Advanced-mode adds: group, cross_group_retry, tokenCount, model_limits,
 * allow_ips.
 *
 * detectAdvancedMode returns true if a token has ANY non-default Advanced
 * field set — used when opening the edit drawer so we don't accidentally
 * hide existing restrictions behind the Simple tab.
 */
export function detectAdvancedMode(
  apiKey: ApiKey,
  userDefaultGroup: string
): boolean {
  if (apiKey.model_limits_enabled) return true
  if (apiKey.model_limits && apiKey.model_limits.length > 0) return true
  if (apiKey.allow_ips && apiKey.allow_ips.length > 0) return true
  // group is "non-default" if it's set AND different from the user's group.
  // empty string = use user's group → still Simple.
  if (apiKey.group && apiKey.group !== '' && apiKey.group !== userDefaultGroup) {
    return true
  }
  // cross_group_retry is meaningful only when group=auto; if it's explicitly
  // off there, that's a deliberate Advanced setting.
  if (apiKey.group === 'auto' && apiKey.cross_group_retry === false) {
    return true
  }
  if (apiKey.rpm_limit && apiKey.rpm_limit > 0) return true
  if (apiKey.tpm_limit && apiKey.tpm_limit > 0) return true
  if (apiKey.monthly_limit && apiKey.monthly_limit > 0) return true
  return false
}

/**
 * Where the user's last-used mode is remembered between drawer opens.
 * Single key shared across all browsers tabs in the same origin.
 */
export const MODE_STORAGE_KEY = 'apiKey.createMode'

export function loadPreferredMode(): CreateMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY)
    return v === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

export function savePreferredMode(mode: CreateMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    // localStorage may be unavailable (private browsing, quota); silently
    // skip — mode just resets to Simple next time, no harm.
  }
}
