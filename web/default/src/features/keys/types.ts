import { z } from 'zod'

// ============================================================================
// API Key Schema & Types
// ============================================================================

export const apiKeySchema = z.object({
  id: z.number(),
  name: z.string(),
  key: z.string(),
  status: z.number(), // 1: enabled, 2: disabled, 3: expired, 4: exhausted
  remain_quota: z.number(),
  used_quota: z.number(),
  unlimited_quota: z.boolean(),
  expired_time: z.number(), // -1 for never expires
  created_time: z.number(),
  accessed_time: z.number(),
  group: z.string().nullish().default(''),
  cross_group_retry: z
    .preprocess((v) => {
      if (v === 1) return true
      if (v === 0) return false
      return v
    }, z.boolean())
    .optional()
    .default(false),
  model_limits_enabled: z.boolean(),
  model_limits: z.string().nullish().default(''),
  allow_ips: z.string().nullish().default(''),
})

export type ApiKey = z.infer<typeof apiKeySchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetApiKeysParams {
  p?: number
  size?: number
}

export interface GetApiKeysResponse {
  success: boolean
  message?: string
  data?: {
    items: ApiKey[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchApiKeysParams {
  keyword?: string
  token?: string
  p?: number
  size?: number
}

/**
 * A directed entitlement package currently granted to the signed-in user.
 *
 * The self-service endpoint returns package records while token assignments
 * only carry package IDs. Keep these response types separate so the key form
 * never needs admin-only package APIs.
 */
export interface EntitlementPackage {
  id: number
  name: string
  description?: string
  status?: number
  group?: string
  models?: string
  priority?: number
  allow_public_fallback?: boolean
  start_time?: number
  end_time?: number
  daily_quota?: number
  daily_request_limit?: number
  total_quota?: number
  total_request_limit?: number
}

export interface TokenEntitlementAssignment {
  id: number
  package_id: number
  token_id: number
  user_id: number
  status: number
  start_time?: number
  end_time?: number
}

export interface ApiKeyFormData {
  name: string
  remain_quota: number
  expired_time: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string
  group: string
  cross_group_retry: boolean
  // Omission is meaningful for updates: the backend preserves assignments.
  entitlement_package_ids?: number[]
}

// ============================================================================
// Dialog Types
// ============================================================================

export type ApiKeysDialogType =
  | 'create'
  | 'update'
  | 'delete'
  | 'batch-delete'
  | 'cc-switch'
