import { z } from 'zod'

// ============================================================================
// Model Schema & Types
// ============================================================================

/**
 * Model entity schema
 * Represents a configured model with its metadata and settings
 */
export const modelSchema = z.object({
  /** Unique model identifier */
  id: z.number(),

  /** Model name/identifier (e.g., "gpt-4", "claude-3-opus") */
  model_name: z.string(),

  /** Name matching rule: 0=exact, 1=prefix, 2=contains, 3=suffix */
  name_rule: z.number(),

  /** Human-readable description of the model */
  description: z.string().nullish().default(''),

  /** Icon identifier from @lobehub/icons */
  icon: z.string().nullish().default(''),

  /** Comma-separated list of tags for categorization */
  tags: z.string().nullish().default(''),

  /** Associated vendor ID */
  vendor_id: z.number().nullish(),

  /** Vendor name (denormalized for display) */
  vendor: z.string().nullish().default(''),

  /** Vendor icon (denormalized for display) */
  vendor_icon: z.string().nullish().default(''),

  /** Custom endpoint configurations as JSON string */
  endpoints: z.string().nullish().default(''),

  /** Model status: 0=disabled, 1=enabled */
  status: z.number(),

  /** Whether to participate in official sync: 0=no, 1=yes */
  sync_official: z.number(),

  /** Number of matched model variants (for fuzzy matching) */
  matched_count: z.number().optional(),

  /** List of matched model names (for fuzzy matching) */
  matched_models: z.array(z.string()).optional(),

  /** Channels that use this model */
  bound_channels: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        type: z.number(),
      })
    )
    .optional(),

  /** User groups that have access to this model */
  enable_groups: z.array(z.string()).optional(),

  /** Billing types: 0=per-use, 1=per-call */
  quota_types: z.array(z.number()).optional(),

  /** Creation timestamp (Unix seconds) */
  created_time: z.number(),

  /** Last update timestamp (Unix seconds) */
  updated_time: z.number(),
})

export type Model = z.infer<typeof modelSchema>

// ============================================================================
// Vendor Schema & Types
// ============================================================================

/**
 * Vendor entity schema
 * Represents a model provider/vendor (e.g., OpenAI, Anthropic)
 */
export const vendorSchema = z.object({
  /** Unique vendor identifier */
  id: z.number(),

  /** Vendor name (e.g., "OpenAI", "Anthropic") */
  name: z.string(),

  /** Human-readable description of the vendor */
  description: z.string().nullish().default(''),

  /** Icon identifier from @lobehub/icons */
  icon: z.string().nullish().default(''),

  /** Vendor status: 0=disabled, 1=enabled */
  status: z.number(),

  /** Creation timestamp (Unix seconds) */
  created_time: z.number().optional(),

  /** Last update timestamp (Unix seconds) */
  updated_time: z.number().optional(),
})

export type Vendor = z.infer<typeof vendorSchema>

// ============================================================================
// Prefill Group Schema & Types
// ============================================================================

/**
 * Prefill group entity schema
 * Used for quick-filling model form fields with predefined values
 */
export const prefillGroupSchema = z.object({
  /** Unique prefill group identifier */
  id: z.number(),

  /** Group name displayed in UI */
  name: z.string(),

  /** Type of prefill: model names, tags, or endpoint configurations */
  type: z.enum(['model', 'tag', 'endpoint']),

  /** Human-readable description of the group */
  description: z.string().nullish().default(''),

  /** Prefill items: JSON string for endpoints, array for model/tag */
  items: z.union([z.string(), z.array(z.string())]),

  /** Creation timestamp (Unix seconds) */
  created_time: z.number().optional(),

  /** Last update timestamp (Unix seconds) */
  updated_time: z.number().optional(),
})

export type PrefillGroup = z.infer<typeof prefillGroupSchema>

export type PrefillGroupType = 'model' | 'tag' | 'endpoint'

// ============================================================================
// Name Rule Enum
// ============================================================================

/**
 * Model name matching rules
 * Determines how model names are matched against incoming requests
 * Priority: EXACT > PREFIX > SUFFIX > CONTAINS
 */
export const NAME_RULE = {
  /** Exact match: model_name must exactly match request */
  EXACT: 0,

  /** Prefix match: request must start with model_name */
  PREFIX: 1,

  /** Contains match: model_name can appear anywhere in request */
  CONTAINS: 2,

  /** Suffix match: request must end with model_name */
  SUFFIX: 3,
} as const

export type NameRule = (typeof NAME_RULE)[keyof typeof NAME_RULE]

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Generic API response wrapper
 * All API endpoints return this structure
 */
export interface ApiResponse<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean

  /** Optional message (error or success details) */
  message?: string

  /** Response data payload */
  data?: T
}

// ============================================================================
// Model API Types
// ============================================================================

/**
 * Parameters for fetching models list
 */
export interface GetModelsParams {
  /** Page number (1-indexed) */
  p?: number

  /** Number of items per page */
  page_size?: number

  /** Filter by vendor ID or name */
  vendor?: string | number
}

/**
 * Response structure for models list endpoint
 */
export interface GetModelsResponse {
  success: boolean
  message?: string
  data?: {
    /** Array of model entities */
    items: Model[]

    /** Total number of models matching filters */
    total: number

    /** Current page number */
    page: number

    /** Number of items per page */
    page_size: number

    /** Count of models per vendor (for tab display) */
    vendor_counts?: Record<string, number>
  }
}

/**
 * Parameters for searching models
 */
export interface SearchModelsParams {
  /** Search keyword (matches name/description) */
  keyword?: string

  /** Filter by vendor */
  vendor?: string

  /** Page number */
  p?: number

  /** Items per page */
  page_size?: number
}

/**
 * Model form submission data
 * Used for create/update operations
 */
export interface ModelFormData {
  /** Model identifier */
  model_name: string

  /** Name matching rule (0-3) */
  name_rule: number

  /** Model description */
  description: string

  /** Icon identifier */
  icon: string

  /** Comma-separated tags */
  tags: string

  /** Associated vendor ID */
  vendor_id?: number

  /** Vendor name (optional, for display) */
  vendor?: string

  /** Vendor icon (optional, for display) */
  vendor_icon?: string

  /** Endpoint configurations (JSON string) */
  endpoints: string

  /** Status (0=disabled, 1=enabled) */
  status: number

  /** Sync official flag (0=no, 1=yes) */
  sync_official: number
}

// ============================================================================
// Vendor API Types
// ============================================================================

/**
 * Parameters for fetching vendors list
 */
export interface GetVendorsParams {
  /** Number of items to fetch (default: 1000 for full list) */
  page_size?: number
}

/**
 * Vendor form submission data
 */
export interface VendorFormData {
  /** Vendor name */
  name: string

  /** Vendor description */
  description: string

  /** Icon identifier */
  icon: string

  /** Status (0=disabled, 1=enabled) */
  status: number
}

// ============================================================================
// Prefill Group API Types
// ============================================================================

/**
 * Parameters for fetching prefill groups
 */
export interface GetPrefillGroupsParams {
  /** Filter by group type */
  type?: PrefillGroupType
}

/**
 * Prefill group form submission data
 */
export interface PrefillGroupFormData {
  /** Group name */
  name: string

  /** Group type */
  type: PrefillGroupType

  /** Group description */
  description: string

  /** Items: JSON string for endpoints, array for model/tag */
  items: string | string[]
}

// ============================================================================
// Sync API Types
// ============================================================================

/**
 * Parameters for upstream sync operation
 */
export interface SyncUpstreamParams {
  /** Language locale for metadata (zh/en/ja) */
  locale?: string

  /** Conflict resolution: fields to overwrite per model */
  overwrite?: {
    model_name: string
    fields: string[]
  }[]
}

/**
 * Response from upstream sync operation
 */
export interface SyncUpstreamResponse {
  success: boolean
  message?: string
  data?: {
    /** Number of new models created */
    created_models: number

    /** Number of existing models updated */
    updated_models: number

    /** Number of new vendors created */
    created_vendors: number

    /** Models that were skipped (e.g., conflicts) */
    skipped_models: string[]
  }
}

/**
 * Response from upstream sync preview/diff
 */
export interface UpstreamDiffResponse {
  success: boolean
  message?: string
  data?: {
    /** Models that exist upstream but not locally */
    missing: string[]

    /** Models with conflicting fields */
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

/**
 * All possible dialog/drawer states in models feature
 * Controls which modal/drawer is currently open
 * null = all closed
 */
export type ModelsDialogType =
  | 'create-model' // Create new model drawer
  | 'update-model' // Edit existing model drawer
  | 'create-vendor' // Create new vendor dialog
  | 'update-vendor' // Edit existing vendor dialog
  | 'prefill-groups' // Manage prefill groups drawer
  | 'create-prefill-group' // Create new prefill group drawer
  | 'update-prefill-group' // Edit existing prefill group drawer
  | 'missing-models' // View/configure missing models dialog
  | 'sync-wizard' // Upstream sync wizard dialog
  | 'upstream-conflict' // Conflict resolution dialog
  | 'batch-delete-models' // Batch delete confirmation dialog
  | null // No dialog open

// ============================================================================
// Context Types
// ============================================================================

/**
 * Union type for currently selected row in tables
 * Used by ModelsProvider to track which entity is being edited
 */
export type CurrentRowType = Model | Vendor | PrefillGroup | null
