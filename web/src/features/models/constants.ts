import type { NameRule, ModelStatus, SyncSource } from './types'

// ============================================================================
// Pagination
// ============================================================================

export const DEFAULT_PAGE_SIZE = 10

// ============================================================================
// Name Rule Options
// ============================================================================

export const NAME_RULE_OPTIONS = [
  { label: 'Exact Match', value: 0 as NameRule },
  { label: 'Prefix Match', value: 1 as NameRule },
  { label: 'Contains Match', value: 2 as NameRule },
  { label: 'Suffix Match', value: 3 as NameRule },
] as const

export const NAME_RULE_CONFIG: Record<
  NameRule,
  { label: string; color: string; description: string }
> = {
  0: {
    label: 'Exact',
    color: 'green',
    description: 'Match model name exactly',
  },
  1: {
    label: 'Prefix',
    color: 'blue',
    description: 'Match models starting with this name',
  },
  2: {
    label: 'Contains',
    color: 'orange',
    description: 'Match models containing this name',
  },
  3: {
    label: 'Suffix',
    color: 'purple',
    description: 'Match models ending with this name',
  },
}

// ============================================================================
// Model Status
// ============================================================================

export const MODEL_STATUS_OPTIONS = [
  { label: 'All Status', value: 'all' },
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
] as const

export const MODEL_STATUS_CONFIG: Record<
  ModelStatus,
  { label: string; variant: 'success' | 'neutral'; showDot?: boolean }
> = {
  1: { label: 'Enabled', variant: 'success', showDot: true },
  0: { label: 'Disabled', variant: 'neutral' },
}

// ============================================================================
// Sync Status Options
// ============================================================================

export const SYNC_STATUS_OPTIONS = [
  { label: 'All Sync Status', value: 'all' },
  { label: 'Official Sync', value: 'yes' },
  { label: 'No Sync', value: 'no' },
] as const

// ============================================================================
// Quota Type
// ============================================================================

export const QUOTA_TYPE_CONFIG: Record<
  number,
  { label: string; color: string }
> = {
  0: { label: 'Usage-based', color: 'violet' },
  1: { label: 'Per-call', color: 'teal' },
}

// ============================================================================
// Endpoint Templates
// ============================================================================

export const ENDPOINT_TEMPLATES: Record<
  string,
  { path: string; method: string }
> = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
  embeddings: { path: '/v1/embeddings', method: 'POST' },
}

// ============================================================================
// Sync Locale Options
// ============================================================================

export const SYNC_LOCALE_OPTIONS = [
  { label: 'Chinese', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: 'Japanese', value: 'ja' },
] as const

export const SYNC_SOURCE_OPTIONS = [
  {
    label: 'Official Repository',
    value: 'official' as SyncSource,
    description: 'Sync from the public upstream metadata repository.',
    disabled: false,
  },
  {
    label: 'Configuration File',
    value: 'config' as SyncSource,
    description: 'Upload or reference a local configuration file.',
    disabled: true,
  },
] as const
