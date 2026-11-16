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
/**
 * Shared constants for usage logs feature
 */
import type { StatusBadgeProps } from '@/components/status-badge'

import type { LogStatistics, LogCategory } from './types'

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default log statistics when no data is available
 */
export const DEFAULT_LOG_STATS: LogStatistics = {
  quota: 0,
  rpm: 0,
  tpm: 0,
}

/**
 * Default empty logs data
 */
export const DEFAULT_LOGS_DATA = {
  items: [],
  total: 0,
}

// ============================================================================
// Log Type Enum
// ============================================================================

/**
 * Log type enum values
 */
export const LOG_TYPE_ENUM = {
  UNKNOWN: 0,
  TOPUP: 1,
  CONSUME: 2,
  MANAGE: 3,
  SYSTEM: 4,
  ERROR: 5,
  REFUND: 6,
  LOGIN: 7,
} as const

/**
 * The log list/stat backend uses type=0 as the "all types" sentinel.
 * Row rendering still displays records with type=0 as "Unknown".
 */
export const LOG_TYPE_ALL_VALUE = '0' as const

// ============================================================================
// Time Range Presets
// ============================================================================

/**
 * Quick time range presets for filter dialog
 */
export const TIME_RANGE_PRESETS = [
  { days: 1, label: '24 Hours' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: '30 Days' },
] as const

// ============================================================================
// Common Logs Configuration
// ============================================================================

/**
 * Log types configuration for filtering and display
 */
export const LOG_TYPES = [
  { value: 0, label: 'Unknown', color: 'default' },
  { value: 1, label: 'Top-up', color: 'cyan' },
  { value: 2, label: 'Consume', color: 'green' },
  { value: 3, label: 'Manage', color: 'orange' },
  { value: 4, label: 'System', color: 'purple' },
  { value: 5, label: 'Error', color: 'red' },
  { value: 6, label: 'Refund', color: 'blue' },
  { value: 7, label: 'Login', color: 'teal' },
] as const

/**
 * Log types for DataTableToolbar filters (single select mode)
 * Backend treats type=0 as "all logs" in list/stat endpoints, so the filter
 * must not expose the display-only "Unknown" label for that value.
 */
export const LOG_TYPE_FILTERS = [
  { label: 'All Types', value: LOG_TYPE_ALL_VALUE, deprecated: false },
  ...LOG_TYPES.filter((type) => type.value !== LOG_TYPE_ENUM.UNKNOWN).map(
    (type) => ({
      label: type.label,
      value: String(type.value),
      deprecated:
        type.value === LOG_TYPE_ENUM.MANAGE ||
        type.value === LOG_TYPE_ENUM.LOGIN,
    })
  ),
] as const

// ============================================================================
// Drawing Logs (MjProxy) Constants
// ============================================================================

/**
 * MjProxy task types
 * Must match backend constants in constant/midjourney.go
 */
export const MJ_TASK_TYPES = {
  IMAGINE: 'IMAGINE', // Drawing
  UPSCALE: 'UPSCALE', // Zoom in
  VIDEO: 'VIDEO', // video
  EDITS: 'EDITS', // Edit
  VARIATION: 'VARIATION', // transform
  HIGH_VARIATION: 'HIGH_VARIATION', // strong transformation
  LOW_VARIATION: 'LOW_VARIATION', // weak transformation
  PAN: 'PAN', // Pan
  DESCRIBE: 'DESCRIBE', // Illustrated text
  BLEND: 'BLEND', // graph mix
  UPLOAD: 'UPLOAD', // Upload files
  SHORTEN: 'SHORTEN', // abbreviation
  REROLL: 'REROLL', // Redraw
  INPAINT: 'INPAINT', // partial redraw
  SWAP_FACE: 'SWAP_FACE', // Face changing
  ZOOM: 'ZOOM', // Zoom
  CUSTOM_ZOOM: 'CUSTOM_ZOOM', // Custom zoom
  MODAL: 'MODAL', // window
} as const

/**
 * MjProxy task status
 */
export const MJ_TASK_STATUS = {
  NOT_START: 'NOT_START', // Not started
  SUBMITTED: 'SUBMITTED', // in queue
  IN_PROGRESS: 'IN_PROGRESS', // Executing
  SUCCESS: 'SUCCESS', // success
  FAILURE: 'FAILURE', // failed
  MODAL: 'MODAL', // Wait for the window
} as const

/**
 * MjProxy submit result codes
 */
export const MJ_SUBMIT_RESULT_CODES = {
  NOT_SUBMITTED: 0, // Not submitted
  SUBMITTED: 1, // Submitted
  WAITING: 21, // Waiting
  DUPLICATE: 22, // Repeat tasks
} as const

// ============================================================================
// Task Logs Constants
// ============================================================================

/**
 * Task action types
 * Must match backend constants in constant/task.go
 */
export const TASK_ACTIONS = {
  // Suno (uppercase)
  MUSIC: 'MUSIC', // generate music
  LYRICS: 'LYRICS', // Generate lyrics

  // Video generation (camelCase)
  GENERATE: 'generate', // tusheng video
  TEXT_GENERATE: 'textGenerate', // Vincent Video
  FIRST_TAIL_GENERATE: 'firstTailGenerate', // First and last life video
  REFERENCE_GENERATE: 'referenceGenerate', // Reference video
  REMIX_GENERATE: 'remixGenerate', // video Remix
} as const

/**
 * Task status
 */
export const TASK_STATUS = {
  NOT_START: 'NOT_START', // Not started
  SUBMITTED: 'SUBMITTED', // in queue
  IN_PROGRESS: 'IN_PROGRESS', // Executing
  SUCCESS: 'SUCCESS', // success
  FAILURE: 'FAILURE', // failed
  QUEUED: 'QUEUED', // Queuing
  UNKNOWN: 'UNKNOWN', // unknown
} as const

/**
 * Task platforms
 */
export const TASK_PLATFORMS = {
  SUNO: 'suno',
  SUNOAPI: 'sunoapi',
  KLING: 'kling',
  RUNWAY: 'runway',
  LUMA: 'luma',
  VIGGLE: 'viggle',
} as const

// ============================================================================
// Status Mappings
// ============================================================================

/**
 * Status mapping configuration type
 */
export interface StatusMapping {
  label: string
  variant: StatusBadgeProps['variant']
}

/**
 * MjProxy task type mappings
 */
export const MJ_TASK_TYPE_MAPPINGS: Record<string, StatusMapping> = {
  [MJ_TASK_TYPES.IMAGINE]: { label: 'Draw', variant: 'blue' },
  [MJ_TASK_TYPES.UPSCALE]: { label: 'Upscale', variant: 'orange' },
  [MJ_TASK_TYPES.VIDEO]: { label: 'Video', variant: 'orange' },
  [MJ_TASK_TYPES.EDITS]: { label: 'Edit', variant: 'orange' },
  [MJ_TASK_TYPES.VARIATION]: { label: 'Vary', variant: 'violet' },
  [MJ_TASK_TYPES.HIGH_VARIATION]: { label: 'Vary (Strong)', variant: 'violet' },
  [MJ_TASK_TYPES.LOW_VARIATION]: { label: 'Vary (Subtle)', variant: 'violet' },
  [MJ_TASK_TYPES.PAN]: { label: 'Pan', variant: 'cyan' },
  [MJ_TASK_TYPES.DESCRIBE]: { label: 'Describe', variant: 'yellow' },
  [MJ_TASK_TYPES.BLEND]: { label: 'Blend', variant: 'lime' },
  [MJ_TASK_TYPES.UPLOAD]: { label: 'Upload', variant: 'blue' },
  [MJ_TASK_TYPES.SHORTEN]: { label: 'Shorten', variant: 'pink' },
  [MJ_TASK_TYPES.REROLL]: { label: 'Reroll', variant: 'indigo' },
  [MJ_TASK_TYPES.INPAINT]: { label: 'Inpaint', variant: 'teal' },
  [MJ_TASK_TYPES.SWAP_FACE]: { label: 'Swap Face', variant: 'purple' },
  [MJ_TASK_TYPES.ZOOM]: { label: 'Zoom', variant: 'green' },
  [MJ_TASK_TYPES.CUSTOM_ZOOM]: { label: 'Custom Zoom', variant: 'green' },
}

/**
 * MjProxy task status mappings
 */
export const MJ_STATUS_MAPPINGS: Record<string, StatusMapping> = {
  [MJ_TASK_STATUS.SUCCESS]: { label: 'Success', variant: 'green' },
  [MJ_TASK_STATUS.NOT_START]: { label: 'Not Started', variant: 'neutral' },
  [MJ_TASK_STATUS.SUBMITTED]: { label: 'Queued', variant: 'yellow' },
  [MJ_TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', variant: 'blue' },
  [MJ_TASK_STATUS.FAILURE]: { label: 'Failed', variant: 'red' },
  [MJ_TASK_STATUS.MODAL]: { label: 'Waiting', variant: 'amber' },
}

/**
 * MjProxy submit result mappings
 */
export const MJ_SUBMIT_RESULT_MAPPINGS: Record<string, StatusMapping> = {
  [String(MJ_SUBMIT_RESULT_CODES.SUBMITTED)]: {
    label: 'Submitted',
    variant: 'green',
  },
  [String(MJ_SUBMIT_RESULT_CODES.WAITING)]: {
    label: 'Waiting',
    variant: 'lime',
  },
  [String(MJ_SUBMIT_RESULT_CODES.DUPLICATE)]: {
    label: 'Duplicate',
    variant: 'orange',
  },
  [String(MJ_SUBMIT_RESULT_CODES.NOT_SUBMITTED)]: {
    label: 'Not Submitted',
    variant: 'yellow',
  },
}

/**
 * Task action type mappings
 */
export const TASK_ACTION_MAPPINGS: Record<string, StatusMapping> = {
  [TASK_ACTIONS.MUSIC]: { label: 'Generate Music', variant: 'neutral' },
  [TASK_ACTIONS.LYRICS]: { label: 'Generate Lyrics', variant: 'pink' },
  [TASK_ACTIONS.GENERATE]: { label: 'Image to Video', variant: 'blue' },
  [TASK_ACTIONS.TEXT_GENERATE]: { label: 'Text to Video', variant: 'blue' },
  [TASK_ACTIONS.FIRST_TAIL_GENERATE]: {
    label: 'First/Last Frame to Video',
    variant: 'blue',
  },
  [TASK_ACTIONS.REFERENCE_GENERATE]: {
    label: 'Reference Video',
    variant: 'blue',
  },
  [TASK_ACTIONS.REMIX_GENERATE]: {
    label: 'Video Remix',
    variant: 'blue',
  },
}

/**
 * Task status mappings
 */
export const TASK_STATUS_MAPPINGS: Record<string, StatusMapping> = {
  [TASK_STATUS.SUCCESS]: { label: 'Success', variant: 'green' },
  [TASK_STATUS.NOT_START]: { label: 'Not Started', variant: 'neutral' },
  [TASK_STATUS.SUBMITTED]: { label: 'Queued', variant: 'yellow' },
  [TASK_STATUS.IN_PROGRESS]: { label: 'In Progress', variant: 'blue' },
  [TASK_STATUS.FAILURE]: { label: 'Failed', variant: 'red' },
  [TASK_STATUS.QUEUED]: { label: 'Queued', variant: 'orange' },
  [TASK_STATUS.UNKNOWN]: { label: 'Unknown', variant: 'neutral' },
}

/**
 * Task platform mappings
 */
export const TASK_PLATFORM_MAPPINGS: Record<string, StatusMapping> = {
  [TASK_PLATFORMS.SUNO]: { label: 'suno', variant: 'green' },
  [TASK_PLATFORMS.SUNOAPI]: { label: 'sunoapi', variant: 'green' },
  [TASK_PLATFORMS.KLING]: { label: 'kling', variant: 'blue' },
  [TASK_PLATFORMS.RUNWAY]: { label: 'runway', variant: 'violet' },
  [TASK_PLATFORMS.LUMA]: { label: 'luma', variant: 'orange' },
  [TASK_PLATFORMS.VIGGLE]: { label: 'viggle', variant: 'pink' },
}

// ============================================================================
// Log Category Labels
// ============================================================================

/**
 * Log category display labels
 */
export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  common: 'Common',
  drawing: 'Drawing',
  task: 'Task',
}

// ============================================================================
// Log Type Checkers (Constants)
// ============================================================================

/**
 * Log types that are displayable (have detailed info)
 */
export const DISPLAYABLE_LOG_TYPES = [0, 2, 5, 6] as const

/**
 * Log types that show timing info
 */
export const TIMING_LOG_TYPES = [2, 5] as const
