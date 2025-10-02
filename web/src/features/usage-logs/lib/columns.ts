/**
 * Column definitions factory
 */
import { getCommonLogsColumns } from '../components/columns/common-logs-columns'
import { getDrawingLogsColumns } from '../components/columns/drawing-logs-columns'
import { getTaskLogsColumns } from '../components/columns/task-logs-columns'
import type { LogCategory } from '../types'

/**
 * Get column definitions based on log category
 * Returns any[] due to different log types (UsageLog, MidjourneyLog, TaskLog)
 */
export function getColumnsByCategory(
  logCategory: LogCategory,
  isAdmin: boolean
): any[] {
  switch (logCategory) {
    case 'common':
      return getCommonLogsColumns(isAdmin)
    case 'drawing':
      return getDrawingLogsColumns(isAdmin)
    case 'task':
      return getTaskLogsColumns(isAdmin)
    default:
      return getCommonLogsColumns(isAdmin)
  }
}
