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

// ============================================================================
// React Query Keys
// ============================================================================

export const QUERY_KEYS = {
  RULES: ['auto-group-rules'] as const,
  CONFIG: ['auto-group-config'] as const,
  GROUPS: ['groups'] as const,
}

// ============================================================================
// Validation Constants
// ============================================================================

export const RULE_VALIDATION = {
  JOB_TITLE_MIN_LENGTH: 1,
  JOB_TITLE_MAX_LENGTH: 100,
  REMARK_MAX_LENGTH: 200,
  PRIORITY_MIN: -9999,
  PRIORITY_MAX: 9999,
} as const

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  RULE_CREATED: 'Rule created successfully',
  RULE_UPDATED: 'Rule updated successfully',
  RULE_DELETED: 'Rule deleted successfully',
  RULE_ENABLED: 'Rule enabled successfully',
  RULE_DISABLED: 'Rule disabled successfully',
  CONFIG_UPDATED: 'Protected groups updated successfully',
  INITIALIZE_APPLIED: 'Saved {{count}} rules successfully',
} as const

// ============================================================================
// Error Messages (i18n keys; use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load auto group rules',
  CREATE_FAILED: 'Failed to create rule',
  UPDATE_FAILED: 'Failed to update rule',
  DELETE_FAILED: 'Failed to delete rule',
  CONFIG_LOAD_FAILED: 'Failed to load protected groups config',
  CONFIG_UPDATE_FAILED: 'Failed to update protected groups',
  RESOLVE_FAILED: 'Failed to resolve job title',
  INITIALIZE_PREVIEW_FAILED: 'Failed to load initialization preview',
  INITIALIZE_APPLY_FAILED: 'Failed to apply initialization',
  JOB_TITLE_REQUIRED: 'Job title is required',
  TARGET_GROUP_REQUIRED: 'Target group is required',
  JOB_TITLE_LENGTH_INVALID:
    'Job title must be between {{min}} and {{max}} characters',
} as const
