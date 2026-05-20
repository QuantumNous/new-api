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
import { type TFunction } from 'i18next'
import { formatWalletPaymentAmount } from '@/lib/ops-billing-display'
import type { NameRule, ModelStatus, SyncSource } from './types'

// ============================================================================
// Pagination
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20

// ============================================================================
// Name Rule Options
// ============================================================================

export function getNameRuleOptions(t: TFunction) {
  return [
    { label: t('Exact Match'), value: 0 as NameRule },
    { label: t('Prefix Match'), value: 1 as NameRule },
    { label: t('Contains Match'), value: 2 as NameRule },
    { label: t('Suffix Match'), value: 3 as NameRule },
  ] as const
}

export function getNameRuleConfig(
  t: TFunction
): Record<NameRule, { label: string; color: string; description: string }> {
  return {
    0: {
      label: t('Exact'),
      color: 'green',
      description: t('Match model resource name exactly'),
    },
    1: {
      label: t('Prefix'),
      color: 'blue',
      description: t('Match model resources starting with this name'),
    },
    2: {
      label: t('Contains'),
      color: 'orange',
      description: t('Match model resources containing this name'),
    },
    3: {
      label: t('Suffix'),
      color: 'purple',
      description: t('Match model resources ending with this name'),
    },
  }
}

// ============================================================================
// Model Status
// ============================================================================

export function getModelStatusOptions(t: TFunction) {
  return [
    { label: t('All Status'), value: 'all' },
    { label: t('Enabled'), value: 'enabled' },
    { label: t('Disabled'), value: 'disabled' },
  ] as const
}

export function getModelStatusConfig(
  t: TFunction
): Record<
  ModelStatus,
  { label: string; variant: 'success' | 'neutral'; showDot?: boolean }
> {
  return {
    1: { label: t('Enabled'), variant: 'success', showDot: true },
    0: { label: t('Disabled'), variant: 'neutral' },
  }
}

// ============================================================================
// Sync Status Options
// ============================================================================

export function getSyncStatusOptions(t: TFunction) {
  return [
    { label: t('All Sync Status'), value: 'all' },
    { label: t('Official Sync'), value: 'yes' },
    { label: t('No Sync'), value: 'no' },
  ] as const
}

// ============================================================================
// Deployment Status
// ============================================================================

export function getDeploymentStatusOptions(t: TFunction) {
  return [
    { label: t('All Status'), value: 'all' },
    { label: t('Running'), value: 'running' },
    { label: t('Completed'), value: 'completed' },
    { label: t('Failed'), value: 'failed' },
    { label: t('Deployment requested'), value: 'deployment requested' },
    { label: t('Termination requested'), value: 'termination requested' },
    { label: t('Destroyed'), value: 'destroyed' },
  ] as const
}

export function getDeploymentStatusConfig(t: TFunction): Record<
  string,
  {
    label: string
    variant: 'success' | 'neutral' | 'warning' | 'danger'
    showDot?: boolean
  }
> {
  return {
    running: { label: t('Running'), variant: 'success', showDot: true },
    completed: { label: t('Completed'), variant: 'success' },
    failed: { label: t('Failed'), variant: 'danger' },
    error: { label: t('Failed'), variant: 'danger' },
    destroyed: { label: t('Destroyed'), variant: 'danger' },
    'deployment requested': {
      label: t('Deployment requested'),
      variant: 'warning',
      showDot: true,
    },
    'termination requested': {
      label: t('Termination requested'),
      variant: 'warning',
      showDot: true,
    },
  }
}

// ============================================================================
// Quota Type
// ============================================================================

export function getQuotaTypeConfig(
  t: TFunction
): Record<number, { label: string; color: string }> {
  return {
    0: { label: t('Usage-based'), color: 'violet' },
    1: { label: t('Per-call'), color: 'teal' },
  }
}

// ============================================================================
// Endpoint Templates
// ============================================================================

// ============================================================================
// Toast / form message keys
// ============================================================================

export const MODEL_NAME_REQUIRED_KEY = 'Model name is required'

export const ERROR_MESSAGES = {
  UNEXPECTED: 'Model operation failed',
  ENABLE_FAILED: 'Failed to enable model resource',
  DISABLE_FAILED: 'Failed to disable model resource',
  DELETE_FAILED: 'Failed to delete model resource',
  CREATE_FAILED: 'Failed to create model resource',
  UPDATE_FAILED: 'Failed to update model resource',
  BATCH_DELETE_FAILED: 'Failed to delete model resource',
  BATCH_ENABLE_FAILED: 'Failed to enable model resource',
  BATCH_DISABLE_FAILED: 'Failed to disable model resource',
  SELECT_AT_LEAST_ONE: 'Please select at least one model resource',
  SYNC_PREVIEW_FAILED: 'Failed to preview upstream diff',
  SYNC_FAILED: 'Sync failed',
  VENDOR_OPERATION_FAILED: 'Operation failed, please check and try again',
  PREFILL_OPERATION_FAILED: 'Operation failed, please check and try again',
  PREFILL_DELETE_FAILED: 'Failed to delete prefill tenant group',
} as const

/** Upstream conflict field keys — maps API field names to i18n label keys. */
export const CONFLICT_FIELD_LABEL_KEYS: Record<string, string> = {
  description: 'Resource description',
  icon: 'Icon',
  tags: 'Resource tags',
  vendor: 'Service source',
  name_rule: 'Name Rule',
  status: 'Model status',
  endpoints: 'Access endpoints',
  quota_types: 'Resource billing method',
  enable_groups: 'Tenant groups',
}

export function getConflictFieldLabel(
  field: string,
  t: (key: string) => string
): string {
  const key = CONFLICT_FIELD_LABEL_KEYS[field]
  return key ? t(key) : field
}

export function formatModelEstimatedMillionTokenPrice(
  amount: number,
  t: TFunction
): string {
  return t('Estimated price: {{price}} per million tokens', {
    price: formatWalletPaymentAmount(amount),
  })
}

export function formatModelCalculatedRatio(ratio: number, t: TFunction): string {
  return t('Calculated ratio: {{ratio}}', { ratio: ratio.toFixed(4) })
}

/**
 * Prefer localized fallback for user-facing toasts; use API message only if it
 * matches a known i18n key.
 */
export function resolveModelToastMessage(
  message: string | undefined,
  fallbackKey: string,
  t: (key: string) => string
): string {
  if (message) {
    const translated = t(message)
    if (translated !== message) {
      return translated
    }
    console.warn('[models] API error:', message)
  }

  return t(fallbackKey)
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

export function getSyncLocaleOptions(t: TFunction) {
  return [
    { label: t('Chinese'), value: 'zh' },
    { label: t('English'), value: 'en' },
    { label: t('Japanese'), value: 'ja' },
  ] as const
}

export function getSyncSourceOptions(t: TFunction) {
  return [
    {
      label: t('Official Repository'),
      value: 'official' as SyncSource,
      description: t(
        'Sync model resources and service sources from the public upstream metadata repository.'
      ),
      disabled: false,
    },
    {
      label: t('Configuration File'),
      value: 'config' as SyncSource,
      description: t('Upload or reference a local configuration file.'),
      disabled: true,
    },
  ] as const
}
