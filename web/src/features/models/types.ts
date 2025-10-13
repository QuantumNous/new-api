import { z } from 'zod'

// ============================================================================
// Model Schema & Types
// ============================================================================

export const modelSchema = z.object({
  id: z.number(),
  model_name: z.string(),
  name_rule: z.number(), // 0: exact, 1: prefix, 2: contains, 3: suffix
  description: z.string().nullish().default(''),
  icon: z.string().nullish().default(''),
  tags: z.string().nullish().default(''), // comma-separated
  vendor_id: z.number().nullish(),
  vendor: z.string().nullish().default(''),
  vendor_icon: z.string().nullish().default(''),
  endpoints: z.string().nullish().default(''), // JSON string
  status: z.number(), // 0: disabled, 1: enabled
  sync_official: z.number(), // 0: no, 1: yes
  matched_count: z.number().optional(),
  matched_models: z.array(z.string()).optional(),
  bound_channels: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        type: z.number(),
      })
    )
    .optional(),
  enable_groups: z.array(z.string()).optional(),
  quota_types: z.array(z.number()).optional(),
  created_time: z.number(),
  updated_time: z.number(),
})

export type Model = z.infer<typeof modelSchema>

// ============================================================================
// Vendor Schema & Types
// ============================================================================

export const vendorSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullish().default(''),
  icon: z.string().nullish().default(''),
  status: z.number(), // 0: disabled, 1: enabled
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
})

export type Vendor = z.infer<typeof vendorSchema>

// ============================================================================
// Prefill Group Schema & Types
// ============================================================================

export const prefillGroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['model', 'tag', 'endpoint']),
  description: z.string().nullish().default(''),
  items: z.union([z.string(), z.array(z.string())]), // string for endpoint (JSON), array for model/tag
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
})

export type PrefillGroup = z.infer<typeof prefillGroupSchema>

export type PrefillGroupType = 'model' | 'tag' | 'endpoint'

// ============================================================================
// Name Rule Enum
// ============================================================================

export const NAME_RULE = {
  EXACT: 0,
  PREFIX: 1,
  CONTAINS: 2,
  SUFFIX: 3,
} as const

export type NameRule = (typeof NAME_RULE)[keyof typeof NAME_RULE]

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

// Model APIs
export interface GetModelsParams {
  p?: number
  page_size?: number
  vendor?: string | number
}

export interface GetModelsResponse {
  success: boolean
  message?: string
  data?: {
    items: Model[]
    total: number
    page: number
    page_size: number
    vendor_counts?: Record<string, number>
  }
}

export interface SearchModelsParams {
  keyword?: string
  vendor?: string
  p?: number
  page_size?: number
}

export interface ModelFormData {
  model_name: string
  name_rule: number
  description: string
  icon: string
  tags: string
  vendor_id?: number
  vendor?: string
  vendor_icon?: string
  endpoints: string
  status: number
  sync_official: number
}

// Vendor APIs
export interface GetVendorsParams {
  page_size?: number
}

export interface VendorFormData {
  name: string
  description: string
  icon: string
  status: number
}

// Prefill Group APIs
export interface GetPrefillGroupsParams {
  type?: PrefillGroupType
}

export interface PrefillGroupFormData {
  name: string
  type: PrefillGroupType
  description: string
  items: string | string[]
}

// Sync APIs
export interface SyncUpstreamParams {
  locale?: string
  overwrite?: {
    model_name: string
    fields: string[]
  }[]
}

export interface SyncUpstreamResponse {
  success: boolean
  message?: string
  data?: {
    created_models: number
    updated_models: number
    created_vendors: number
    skipped_models: string[]
  }
}

export interface UpstreamDiffResponse {
  success: boolean
  message?: string
  data?: {
    missing: string[]
    conflicts: {
      model_name: string
      fields: {
        field: string
        local: unknown
        upstream: unknown
      }[]
    }[]
  }
}

// ============================================================================
// Dialog Types
// ============================================================================

export type ModelsDialogType =
  | 'create-model'
  | 'update-model'
  | 'create-vendor'
  | 'update-vendor'
  | 'prefill-groups'
  | 'create-prefill-group'
  | 'update-prefill-group'
  | 'missing-models'
  | 'sync-wizard'
  | 'upstream-conflict'
  | 'batch-delete-models'
  | null

// ============================================================================
// Context Types
// ============================================================================

export type CurrentRowType = Model | Vendor | PrefillGroup | null
