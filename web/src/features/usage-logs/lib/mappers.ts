/**
 * Status mappers for different log types
 * Centralized mapper instances for consistent usage across components
 */
import {
  MJ_TASK_TYPE_MAPPINGS,
  MJ_STATUS_MAPPINGS,
  MJ_SUBMIT_RESULT_MAPPINGS,
  TASK_ACTION_MAPPINGS,
  TASK_STATUS_MAPPINGS,
  TASK_PLATFORM_MAPPINGS,
} from '../constants'
import { createStatusMapper } from './status'

// ============================================================================
// Midjourney (Drawing) Logs Mappers
// ============================================================================

/**
 * Midjourney task type mapper
 */
export const mjTaskTypeMapper = createStatusMapper(MJ_TASK_TYPE_MAPPINGS)

/**
 * Midjourney task status mapper
 */
export const mjStatusMapper = createStatusMapper(MJ_STATUS_MAPPINGS)

/**
 * Midjourney submit result mapper
 */
export const mjSubmitResultMapper = createStatusMapper(
  MJ_SUBMIT_RESULT_MAPPINGS
)

// ============================================================================
// Task Logs Mappers
// ============================================================================

/**
 * Task action type mapper
 */
export const taskActionMapper = createStatusMapper(TASK_ACTION_MAPPINGS)

/**
 * Task status mapper
 */
export const taskStatusMapper = createStatusMapper(TASK_STATUS_MAPPINGS)

/**
 * Task platform mapper
 */
export const taskPlatformMapper = createStatusMapper(TASK_PLATFORM_MAPPINGS)
