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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { ChannelFormValues } from '../../lib'

export type ModelMappingGuardrail = {
  invalidJson: boolean
  entries: Array<{ source: string; target: string }>
  missingSourceModels: string[]
  exposedTargetModels: string[]
}

export type ChannelEditorSectionStatus =
  | 'complete'
  | 'configured'
  | 'error'
  | 'idle'

export type ChannelEditorNavChildItem = {
  id: string
  title: string
  configured?: boolean
}

export type ChannelEditorNavItem = {
  id: string
  title: string
  description?: string
  statusLabel: string
  status: ChannelEditorSectionStatus
  icon: ReactNode
  configured?: boolean
  children?: ChannelEditorNavChildItem[]
}

export const createEmptyModelMappingGuardrail = (): ModelMappingGuardrail => ({
  invalidJson: false,
  entries: [],
  missingSourceModels: [],
  exposedTargetModels: [],
})

export const formatModelNames = (models: string[]): string =>
  models.map((model) => `"${model}"`).join(', ')

export const MODEL_MAPPING_PREVIEW_FALLBACK: Array<{
  source: string
  target: string
}> = [{ source: 'client-model', target: 'upstream-model' }]

export const ADVANCED_SETTINGS_EXPANDED_KEY =
  'channel-advanced-settings-expanded'
export const CHANNEL_EDITOR_SECTION_IDS = {
  identity: 'channel-section-identity',
  credentials: 'channel-section-credentials',
  models: 'channel-section-models',
  advanced: 'channel-section-advanced',
} as const
export const CHANNEL_EDITOR_MAIN_SECTION_IDS = [
  CHANNEL_EDITOR_SECTION_IDS.identity,
  CHANNEL_EDITOR_SECTION_IDS.credentials,
  CHANNEL_EDITOR_SECTION_IDS.models,
  CHANNEL_EDITOR_SECTION_IDS.advanced,
]
export const ADVANCED_SETTINGS_SECTION_IDS = {
  routingStrategy: 'channel-section-advanced-routing-strategy',
  internalNotes: 'channel-section-advanced-internal-notes',
  overrideRules: 'channel-section-advanced-override-rules',
  extraSettings: 'channel-section-advanced-extra-settings',
  fieldPassthrough: 'channel-section-advanced-field-passthrough',
  upstreamModelDetection: 'channel-section-advanced-upstream-model-detection',
} as const
export const ADVANCED_SETTINGS_CHILD_SECTION_IDS: string[] = Object.values(
  ADVANCED_SETTINGS_SECTION_IDS
)

export function readAdvancedSettingsPreference(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ADVANCED_SETTINGS_EXPANDED_KEY) === 'true'
}

export function hasConfiguredOverrideValue(value: unknown): boolean {
  if (typeof value !== 'string') return false

  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null') return false

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed === null) return false
    if (Array.isArray(parsed)) return parsed.length > 0
    if (typeof parsed === 'object') return Object.keys(parsed).length > 0
  } catch {
    return true
  }

  return true
}

export function hasAdvancedSettingsValues(values: ChannelFormValues): boolean {
  return Boolean(
    hasConfiguredOverrideValue(values.param_override) ||
    hasConfiguredOverrideValue(values.header_override) ||
    values.advanced_custom?.trim() ||
    hasConfiguredOverrideValue(values.status_code_mapping) ||
    values.tag?.trim() ||
    values.remark?.trim() ||
    values.priority ||
    values.weight ||
    values.proxy?.trim() ||
    values.system_prompt?.trim() ||
    values.force_format ||
    values.thinking_to_content ||
    values.pass_through_body_enabled ||
    values.system_prompt_override ||
    values.claude_beta_query ||
    values.upstream_model_update_check_enabled ||
    values.upstream_model_update_auto_sync_enabled ||
    values.upstream_model_update_ignored_models?.trim()
  )
}

export function parseSettingsRecord(
  settings: string | undefined
): Record<string, unknown> {
  if (!settings?.trim()) return {}
  try {
    const parsed = JSON.parse(settings)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

export function formatUnixTime(timestamp: unknown): string {
  const seconds = Number(timestamp)
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  return new Date(seconds * 1000).toLocaleString()
}

export function configuredAdvancedSectionClassName(
  className: string,
  configured: boolean
) {
  return cn(
    className,
    'border-border/60 rounded-lg border p-3 transition-colors',
    configured && 'border-primary/35 ring-primary/20 ring-1'
  )
}

export function getCompletionStatus(
  hasErrors: boolean,
  isComplete: boolean
): ChannelEditorSectionStatus {
  if (hasErrors) return 'error'
  if (isComplete) return 'complete'
  return 'idle'
}

export function getSectionStatusLabel(
  status: ChannelEditorSectionStatus,
  t: (key: string) => string
): string {
  if (status === 'error') return t('Error')
  if (status === 'complete' || status === 'configured') return t('Ready')
  return t('Incomplete')
}
