import { type StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Model Status Configuration
// ============================================================================

/**
 * Model status enum
 * 0 = Disabled: Model is not available for use
 * 1 = Enabled: Model is active and available
 */
export const MODEL_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
} as const

/**
 * Model status display configuration
 * Maps status codes to UI presentation properties
 */
export const MODEL_STATUSES: Record<
  number,
  Pick<StatusBadgeProps, 'variant' | 'showDot'> & {
    label: string
    value: number
  }
> = {
  [MODEL_STATUS.ENABLED]: {
    label: 'Enabled',
    variant: 'success',
    value: MODEL_STATUS.ENABLED,
    showDot: true,
  },
  [MODEL_STATUS.DISABLED]: {
    label: 'Disabled',
    variant: 'neutral',
    value: MODEL_STATUS.DISABLED,
    showDot: true,
  },
} as const

// ============================================================================
// Name Rule Configuration
// ============================================================================

/**
 * Model name matching rule options
 * Controls how model names are matched against incoming requests
 *
 * Priority: Exact > Prefix > Suffix > Contains
 *
 * - Exact Match (0): Matches only when model name is exactly the same
 * - Prefix Match (1): Matches when request starts with model name
 * - Contains Match (2): Matches when model name appears anywhere in request
 * - Suffix Match (3): Matches when request ends with model name
 */
export const NAME_RULE_OPTIONS = [
  { label: 'Exact Match', value: 0, color: 'green' },
  { label: 'Prefix Match', value: 1, color: 'blue' },
  { label: 'Contains Match', value: 2, color: 'orange' },
  { label: 'Suffix Match', value: 3, color: 'purple' },
] as const

// ============================================================================
// Prefill Group Type Configuration
// ============================================================================

/**
 * Prefill group type options for quick-filling model forms
 *
 * - Model Group: Predefined list of model names
 * - Tag Group: Predefined list of tags for categorization
 * - Endpoint Group: Predefined endpoint configurations (JSON format)
 */
export const PREFILL_GROUP_TYPE_OPTIONS = [
  { label: 'Model Group', value: 'model' as const },
  { label: 'Tag Group', value: 'tag' as const },
  { label: 'Endpoint Group', value: 'endpoint' as const },
] as const

// ============================================================================
// Endpoint Template
// ============================================================================

/**
 * Default endpoint configurations for common API types
 * Used as template for endpoint field in model forms
 *
 * Structure: { [endpointType]: { path, method } }
 * - path: API endpoint path (may include {model} placeholder)
 * - method: HTTP method (usually POST)
 */
export const ENDPOINT_TEMPLATE = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
} as const

// ============================================================================
// Sync Locale Options
// ============================================================================

/**
 * Available language options for upstream model/vendor metadata sync
 * Controls which language version of descriptions and documentation to fetch
 */
export const SYNC_LOCALES = [
  { label: 'English', value: 'en', extra: 'English' },
  { label: 'Chinese', value: 'zh', extra: '中文' },
  { label: 'Japanese', value: 'ja', extra: '日本語' },
] as const

// ============================================================================
// Quota Type Configuration
// ============================================================================

/**
 * Model billing/quota type configuration
 *
 * - Pay per Use (0): Charged based on token usage
 * - Pay per Call (1): Charged per API request regardless of tokens
 */
export const QUOTA_TYPE_CONFIG: Record<
  number,
  { label: string; color: string }
> = {
  0: { label: 'Pay per Use', color: 'violet' },
  1: { label: 'Pay per Call', color: 'teal' },
} as const

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Error messages for model-related operations
 * Used for consistent error reporting across the feature
 */
export const ERROR_MESSAGES = {
  // General
  UNEXPECTED: 'An unexpected error occurred',

  // Model operations
  LOAD_FAILED: 'Failed to load models',
  SEARCH_FAILED: 'Failed to search models',
  CREATE_FAILED: 'Failed to create model',
  UPDATE_FAILED: 'Failed to update model',
  DELETE_FAILED: 'Failed to delete model',
  BATCH_DELETE_FAILED: 'Failed to delete models',
  STATUS_UPDATE_FAILED: 'Failed to update model status',

  // Vendor operations
  VENDOR_LOAD_FAILED: 'Failed to load vendors',
  VENDOR_CREATE_FAILED: 'Failed to create vendor',
  VENDOR_UPDATE_FAILED: 'Failed to update vendor',
  VENDOR_DELETE_FAILED: 'Failed to delete vendor',

  // Prefill group operations
  PREFILL_GROUP_LOAD_FAILED: 'Failed to load prefill groups',
  PREFILL_GROUP_CREATE_FAILED: 'Failed to create prefill group',
  PREFILL_GROUP_UPDATE_FAILED: 'Failed to update prefill group',
  PREFILL_GROUP_DELETE_FAILED: 'Failed to delete prefill group',

  // Sync operations
  SYNC_FAILED: 'Failed to sync upstream',
  PREVIEW_FAILED: 'Failed to preview sync differences',
  MISSING_MODELS_LOAD_FAILED: 'Failed to load missing models',
} as const

// ============================================================================
// Success Messages
// ============================================================================

/**
 * Success messages for model-related operations
 * Used for consistent success notifications across the feature
 */
export const SUCCESS_MESSAGES = {
  // Model operations
  MODEL_CREATED: 'Model created successfully',
  MODEL_UPDATED: 'Model updated successfully',
  MODEL_DELETED: 'Model deleted successfully',
  MODEL_ENABLED: 'Model enabled successfully',
  MODEL_DISABLED: 'Model disabled successfully',
  MODELS_DELETED: 'Models deleted successfully',

  // Vendor operations
  VENDOR_CREATED: 'Vendor created successfully',
  VENDOR_UPDATED: 'Vendor updated successfully',
  VENDOR_DELETED: 'Vendor deleted successfully',

  // Prefill group operations
  PREFILL_GROUP_CREATED: 'Prefill group created successfully',
  PREFILL_GROUP_UPDATED: 'Prefill group updated successfully',
  PREFILL_GROUP_DELETED: 'Prefill group deleted successfully',

  // Sync operations
  SYNC_COMPLETED: 'Sync completed successfully',
} as const

// ============================================================================
// Field Labels for Conflict Resolution
// ============================================================================

/**
 * Human-readable labels for model fields in conflict resolution UI
 * Maps internal field names to display names
 */
export const CONFLICT_FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  icon: 'Icon',
  tags: 'Tags',
  vendor: 'Vendor',
  name_rule: 'Name Rule',
  status: 'Status',
} as const
