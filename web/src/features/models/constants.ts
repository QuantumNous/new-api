import { type StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Model Status Configuration
// ============================================================================

export const MODEL_STATUS = {
  DISABLED: 0,
  ENABLED: 1,
} as const

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

export const NAME_RULE_OPTIONS = [
  { label: 'Exact Match', value: 0, color: 'green' },
  { label: 'Prefix Match', value: 1, color: 'blue' },
  { label: 'Contains Match', value: 2, color: 'orange' },
  { label: 'Suffix Match', value: 3, color: 'purple' },
] as const

// ============================================================================
// Prefill Group Type Configuration
// ============================================================================

export const PREFILL_GROUP_TYPE_OPTIONS = [
  { label: 'Model Group', value: 'model' as const },
  { label: 'Tag Group', value: 'tag' as const },
  { label: 'Endpoint Group', value: 'endpoint' as const },
] as const

// ============================================================================
// Endpoint Template
// ============================================================================

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

export const SYNC_LOCALES = [
  { label: 'English', value: 'en', extra: 'English' },
  { label: 'Chinese', value: 'zh', extra: '中文' },
  { label: 'Japanese', value: 'ja', extra: '日本語' },
] as const

// ============================================================================
// Quota Type Configuration
// ============================================================================

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

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load models',
  SEARCH_FAILED: 'Failed to search models',
  CREATE_FAILED: 'Failed to create model',
  UPDATE_FAILED: 'Failed to update model',
  DELETE_FAILED: 'Failed to delete model',
  BATCH_DELETE_FAILED: 'Failed to delete models',
  STATUS_UPDATE_FAILED: 'Failed to update model status',

  // Vendor
  VENDOR_LOAD_FAILED: 'Failed to load vendors',
  VENDOR_CREATE_FAILED: 'Failed to create vendor',
  VENDOR_UPDATE_FAILED: 'Failed to update vendor',
  VENDOR_DELETE_FAILED: 'Failed to delete vendor',

  // Prefill Group
  PREFILL_GROUP_LOAD_FAILED: 'Failed to load prefill groups',
  PREFILL_GROUP_CREATE_FAILED: 'Failed to create prefill group',
  PREFILL_GROUP_UPDATE_FAILED: 'Failed to update prefill group',
  PREFILL_GROUP_DELETE_FAILED: 'Failed to delete prefill group',

  // Sync
  SYNC_FAILED: 'Failed to sync upstream',
  PREVIEW_FAILED: 'Failed to preview sync differences',
  MISSING_MODELS_LOAD_FAILED: 'Failed to load missing models',
} as const

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  MODEL_CREATED: 'Model created successfully',
  MODEL_UPDATED: 'Model updated successfully',
  MODEL_DELETED: 'Model deleted successfully',
  MODEL_ENABLED: 'Model enabled successfully',
  MODEL_DISABLED: 'Model disabled successfully',
  MODELS_DELETED: 'Models deleted successfully',

  // Vendor
  VENDOR_CREATED: 'Vendor created successfully',
  VENDOR_UPDATED: 'Vendor updated successfully',
  VENDOR_DELETED: 'Vendor deleted successfully',

  // Prefill Group
  PREFILL_GROUP_CREATED: 'Prefill group created successfully',
  PREFILL_GROUP_UPDATED: 'Prefill group updated successfully',
  PREFILL_GROUP_DELETED: 'Prefill group deleted successfully',

  // Sync
  SYNC_COMPLETED: 'Sync completed successfully',
} as const

// ============================================================================
// Field Labels for Conflict Resolution
// ============================================================================

export const CONFLICT_FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  icon: 'Icon',
  tags: 'Tags',
  vendor: 'Vendor',
  name_rule: 'Name Rule',
  status: 'Status',
} as const
