/**
 * Utility functions for usage logs filters
 */
import type { LogCategory } from '../components/usage-logs-tabs'

// ============================================================================
// Type Definitions
// ============================================================================

// Common filters (shared across all log types)
export interface CommonFilters {
  startTime?: Date
  endTime?: Date
  channel?: string
}

// Common logs specific filters
export interface CommonLogFilters extends CommonFilters {
  model?: string
  token?: string
  group?: string
  username?: string
}

// Drawing logs specific filters
export interface DrawingLogFilters extends CommonFilters {
  mjId?: string
}

// Task logs specific filters
export interface TaskLogFilters extends CommonFilters {
  taskId?: string
}

export type LogFilters = CommonLogFilters | DrawingLogFilters | TaskLogFilters

// ============================================================================
// Filter Building Functions
// ============================================================================

/**
 * Build search params from filters based on log category
 */
export function buildSearchParams(
  filters: LogFilters,
  logCategory: LogCategory
): Record<string, any> {
  const baseParams: Record<string, any> = {
    ...(filters.startTime && { startTime: filters.startTime.getTime() }),
    ...(filters.endTime && { endTime: filters.endTime.getTime() }),
    ...(filters.channel && { channel: filters.channel }),
  }

  switch (logCategory) {
    case 'common': {
      const commonFilters = filters as CommonLogFilters
      return {
        ...baseParams,
        ...(commonFilters.model && { model: commonFilters.model }),
        ...(commonFilters.token && { token: commonFilters.token }),
        ...(commonFilters.group && { group: commonFilters.group }),
        ...(commonFilters.username && { username: commonFilters.username }),
      }
    }
    case 'drawing': {
      const drawingFilters = filters as DrawingLogFilters
      return {
        ...baseParams,
        ...(drawingFilters.mjId && { filter: drawingFilters.mjId }),
      }
    }
    case 'task': {
      const taskFilters = filters as TaskLogFilters
      return {
        ...baseParams,
        ...(taskFilters.taskId && { filter: taskFilters.taskId }),
      }
    }
    default:
      return baseParams
  }
}

/**
 * Get log category display name
 */
export function getLogCategoryLabel(category: LogCategory): string {
  const labels: Record<LogCategory, string> = {
    common: 'Common',
    drawing: 'Drawing',
    task: 'Task',
  }
  return labels[category]
}
