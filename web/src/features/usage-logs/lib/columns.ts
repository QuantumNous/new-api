/**
 * Column definitions factory
 */
import { useCommonLogsColumns } from '../components/columns/common-logs-columns'
import { useDrawingLogsColumns } from '../components/columns/drawing-logs-columns'
import { useTaskLogsColumns } from '../components/columns/task-logs-columns'
import type { LogCategory } from '../types'

/**
 * Get column definitions based on log category
 * Returns any[] due to different log types (UsageLog, MidjourneyLog, TaskLog)
 */
export function useColumnsByCategory(
  logCategory: LogCategory,
  isAdmin: boolean
): any[] {
  const commonColumns = useCommonLogsColumns(isAdmin)
  const drawingColumns = useDrawingLogsColumns(isAdmin)
  const taskColumns = useTaskLogsColumns(isAdmin)

  switch (logCategory) {
    case 'common':
      return commonColumns
    case 'drawing':
      return drawingColumns
    case 'task':
      return taskColumns
    default:
      return commonColumns
  }
}
